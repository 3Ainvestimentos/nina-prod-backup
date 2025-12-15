"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { Employee, N2IndividualNotes, Interaction, PDIAction } from "@/lib/types";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { isWithinInterval, differenceInMonths, startOfMonth, endOfMonth, getMonth, getYear, parseISO } from "date-fns";
import { useAppConfig } from "@/hooks/use-app-config";

const n3IndividualSchedule = {
  'Alfa': 4, // 4 por mês
  'Beta': 2,
  'Senior': 1,
};

const interactionSchedules: { [key in "1:1" | "PDI" | "Índice de Risco"]?: number[] } = {
  'PDI': [0, 6],                  // Jan, Jul
  '1:1': [2, 5, 8, 11],         // Mar, Jun, Sep, Dec
  'Índice de Risco': [0,1,2,3,4,5,6,7,8,9,10,11], // Monthly
};

interface N2IndividualFormProps {
  employee: Employee;
  onSave: (notes: N2IndividualNotes) => Promise<void>;
  isSaving: boolean;
  id?: string;
}

export function N2IndividualForm({ employee, onSave, isSaving, id }: N2IndividualFormProps) {
  const firestore = useFirestore();
  const { rankingBonusEnabled } = useAppConfig();
  const [captacaoTIME, setCaptacaoTIME] = useState("");
  const [churnPFTIME, setChurnPFTIME] = useState("");
  const [roaTIME, setRoaTIME] = useState("");
  const [notaRanking, setNotaRanking] = useState<number | null>(null);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [planoAcao, setPlanoAcao] = useState("");
  const [anotacoes, setAnotacoes] = useState("");

  // Buscar employees para calcular o ranking
  const employeesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, "employees") : null),
    [firestore]
  );
  const { data: employees } = useCollection<Employee>(employeesCollection);

  // Calcular nota do ranking quando o componente montar
  useEffect(() => {
    if (firestore && employee?.id && employees) {
      setIsLoadingRanking(true);
      const calculateRankingScore = async () => {
        try {
          const now = new Date();
          const range = { start: startOfMonth(now), end: endOfMonth(now) };
          const fromMonth = getMonth(range.start);
          const fromYear = getYear(range.start);
          const toMonth = getMonth(range.end);
          const toYear = getYear(range.end);
          const monthsInRange = differenceInMonths(range.end, range.start) + 1;

          const teamMembers = employees.filter(e => e.leaderId === employee.id && e.isUnderManagement);
          
          if (teamMembers.length === 0) {
            setNotaRanking(0);
            setIsLoadingRanking(false);
            return;
          }

          let totalCompleted = 0;
          let totalRequired = 0;

          const fetchPromises = teamMembers.map(async (member) => {
            const [interactionsSnap, pdiActionsSnap] = await Promise.all([
              getDocs(collection(firestore, "employees", member.id, "interactions")),
              getDocs(collection(firestore, "employees", member.id, "pdiActions"))
            ]);

            const memberInteractions = interactionsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Interaction));
            const memberPdiActions = pdiActionsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as PDIAction));

            return { member, memberInteractions, memberPdiActions };
          });

          const teamData = await Promise.all(fetchPromises);

          teamData.forEach(({ member, memberInteractions, memberPdiActions }) => {
            const n3Segment = member.segment as keyof typeof n3IndividualSchedule | undefined;
            if (n3Segment && n3IndividualSchedule[n3Segment]) {
              const requiredN3 = n3IndividualSchedule[n3Segment] * monthsInRange;
              const completedN3 = memberInteractions.filter(i => i.type === 'N3 Individual' && isWithinInterval(parseISO(i.date), range)).length;
              totalRequired += requiredN3;
              totalCompleted += Math.min(completedN3, requiredN3);
            }

            (['1:1', 'Índice de Risco'] as const).forEach(type => {
              const schedule = interactionSchedules[type];
              if (schedule) {
                const requiredMonths = schedule.filter(month => {
                  for (let y = fromYear; y <= toYear; y++) {
                    const startM = (y === fromYear) ? fromMonth : 0;
                    const endM = (y === toYear) ? toMonth : 11;
                    if (month >= startM && month <= endM) return true;
                  }
                  return false;
                });
                const requiredCount = requiredMonths.length;
                totalRequired += requiredCount;

                const executedMonths = new Set<number>();
                memberInteractions.forEach(i => {
                  const intDate = parseISO(i.date);
                  if (i.type === type && isWithinInterval(intDate, range) && requiredMonths.includes(getMonth(intDate))) {
                    executedMonths.add(getMonth(intDate));
                  }
                });
                totalCompleted += executedMonths.size;
              }
            });

            const pdiSchedule = interactionSchedules['PDI'] || [];
            const requiredPdiMonths = pdiSchedule.filter(month => {
              for (let y = fromYear; y <= toYear; y++) {
                const startM = (y === fromYear) ? fromMonth : 0;
                const endM = (y === toYear) ? toMonth : 11;
                if (month >= startM && month <= endM) return true;
              }
              return false;
            });
            const requiredPdiCount = requiredPdiMonths.length;
            totalRequired += requiredPdiCount;
            
            const executedPdiMonths = new Set<number>();
            memberPdiActions.forEach(action => {
              const actionDate = parseISO(action.startDate);
              if (isWithinInterval(actionDate, range) && requiredPdiMonths.includes(getMonth(actionDate))) {
                executedPdiMonths.add(getMonth(actionDate));
              }
            });
            totalCompleted += executedPdiMonths.size;
          });

          const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
          const bonusPercentage = rankingBonusEnabled ? Math.floor(totalCompleted / 10) * 3 : 0;
          const totalScore = adherenceScore + bonusPercentage;
          const totalScoreRounded = Math.round(totalScore);

          setNotaRanking(totalScoreRounded);
        } catch (error) {
          console.error("[N2] Erro ao calcular nota do ranking:", error);
          setNotaRanking(0);
        } finally {
          setIsLoadingRanking(false);
        }
      };
      
      calculateRankingScore();
    }
  }, [firestore, employee?.id, employees, rankingBonusEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const notes: N2IndividualNotes = {
      captacaoTIME,
      churnPFTIME,
      roaTIME,
      notaRanking: notaRanking ?? 0,
      planoAcao,
      anotacoes,
    };
    onSave(notes);
  };

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="captacao-time">Captação TIME</Label>
        <Input
          id="captacao-time"
          placeholder="R$ 0,00"
          value={captacaoTIME}
          onChange={(e) => setCaptacaoTIME(e.target.value)}
          disabled={isSaving}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="churn-pf-time">Churn PF TIME</Label>
        <Input
          id="churn-pf-time"
          placeholder="0,00%"
          value={churnPFTIME}
          onChange={(e) => setChurnPFTIME(e.target.value)}
          disabled={isSaving}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="roa-time">ROA TIME</Label>
        <Input
          id="roa-time"
          placeholder="0,00%"
          value={roaTIME}
          onChange={(e) => setRoaTIME(e.target.value)}
          disabled={isSaving}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nota-ranking">Nota Ranking</Label>
        {isLoadingRanking ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Input
            id="nota-ranking"
            value={notaRanking !== null ? `${notaRanking}%` : "0%"}
            readOnly
            disabled
            className="bg-muted"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Pontuação do Ranking de Líderes (Índice de Aderência em %).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plano-acao">Plano de Ação</Label>
        <Textarea
          id="plano-acao"
          placeholder="Descreva o plano de ação..."
          value={planoAcao}
          onChange={(e) => setPlanoAcao(e.target.value)}
          disabled={isSaving}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="anotacoes">Anotações</Label>
        <Textarea
          id="anotacoes"
          placeholder="Anotações adicionais..."
          value={anotacoes}
          onChange={(e) => setAnotacoes(e.target.value)}
          disabled={isSaving}
          rows={4}
        />
      </div>
    </form>
  );
}

