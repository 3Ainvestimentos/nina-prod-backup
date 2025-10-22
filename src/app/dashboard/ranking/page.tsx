
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Employee, Interaction, PDIAction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { isWithinInterval, differenceInMonths, startOfMonth, endOfMonth, getMonth, getYear, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Crown, Medal, Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";


interface LeaderRanking extends Employee {
  adherenceScore: number;
  completedCount: number;
  totalCount: number;
}

const n3IndividualSchedule = {
  'Alfa': 4, // 4 por mês
  'Beta': 2, // 2 por mês
  'Senior': 1, // 1 por mês
};

const interactionSchedules: { [key in "1:1" | "PDI" | "Índice de Risco"]?: number[] } = {
  'PDI': [0, 6], // Janeiro e Julho
  '1:1': [2, 5, 8, 11], // Março, Junho, Setembro, Dezembro
  'Índice de Risco': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Todos os meses
};


export default function RankingPage() {
  const firestore = useFirestore();
  const [axisFilter, setAxisFilter] = useState("Comercial");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });


  const employeesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, "employees") : null),
    [firestore]
  );
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const [interactions, setInteractions] = useState<Map<string, Interaction[]>>(new Map());
  const [pdiActionsMap, setPdiActionsMap] = useState<Map<string, PDIAction[]>>(new Map());
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!firestore || !employees) return;

      setLoadingData(true);
      const allManagedEmployeeIds = employees
        .filter(e => e.isUnderManagement)
        .map(e => e.id);

      const interactionsMap = new Map<string, Interaction[]>();
      const pdiMap = new Map<string, PDIAction[]>();

      for (const id of allManagedEmployeeIds) {
        const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
        const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));
        
        const [interactionsSnapshot, pdiActionsSnapshot] = await Promise.all([
          getDocs(interactionsQuery),
          getDocs(pdiActionsQuery)
        ]);

        const employeeInteractions = interactionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Interaction);
        interactionsMap.set(id, employeeInteractions);

        const employeePdiActions = pdiActionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as PDIAction);
        pdiMap.set(id, employeePdiActions);
      }
      
      setInteractions(interactionsMap);
      setPdiActionsMap(pdiMap);
      setLoadingData(false);
    };

    fetchAllData();
  }, [employees, firestore]);
  
  const { leaderRankings, uniqueAxes } = useMemo(() => {
    if (!employees || loadingData || !dateRange?.from || !dateRange?.to) {
        return { leaderRankings: [], uniqueAxes: [] };
    }
  
    const leaders = employees.filter(e => e.role === 'Líder');
    const axes = [...new Set(leaders.map(l => l.axis).filter(Boolean))].sort();
    
    const range = { start: dateRange.from, end: dateRange.to };
    const fromMonth = getMonth(range.start);
    const fromYear = getYear(range.start);
    const toMonth = getMonth(range.end);
    const toYear = getYear(range.end);
    const monthsInRange = differenceInMonths(range.end, range.start) + 1;

    const rankings = leaders.map(leader => {
      const teamMembers = employees.filter(e => e.leaderId === leader.id && e.isUnderManagement);
      
      if (teamMembers.length === 0) {
        return { ...leader, adherenceScore: 0, completedCount: 0, totalCount: 0 };
      }
  
      let totalCompleted = 0;
      let totalRequired = 0;

      teamMembers.forEach(member => {
        const memberInteractions = interactions.get(member.id) || [];
        const memberPdiActions = pdiActionsMap.get(member.id) || [];

        // N3 Individual
        const n3Segment = member.segment as keyof typeof n3IndividualSchedule | undefined;
        if (n3Segment && n3IndividualSchedule[n3Segment]) {
            const requiredN3 = n3IndividualSchedule[n3Segment] * monthsInRange;
            const completedN3 = memberInteractions.filter(i => i.type === 'N3 Individual' && isWithinInterval(parseISO(i.date), range)).length;
            totalRequired += requiredN3;
            totalCompleted += Math.min(completedN3, requiredN3);
        }

        // 1:1 and Índice de Risco
        (['1:1', 'Índice de Risco'] as const).forEach(type => {
            const schedule = interactionSchedules[type];
            if(schedule) {
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
                    if(i.type === type && isWithinInterval(intDate, range) && requiredMonths.includes(getMonth(intDate))) {
                        executedMonths.add(getMonth(intDate));
                    }
                });
                totalCompleted += executedMonths.size;
            }
        });

        // PDI
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
            if(isWithinInterval(actionDate, range) && requiredPdiMonths.includes(getMonth(actionDate))) {
                executedPdiMonths.add(getMonth(actionDate));
            }
        });
        totalCompleted += executedPdiMonths.size;
      });
  
      const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
      
      return {
        ...leader,
        adherenceScore,
        completedCount: Math.round(totalCompleted),
        totalCount: Math.round(totalRequired),
      };
    }).sort((a, b) => b.adherenceScore - a.adherenceScore);
  
    return { leaderRankings: rankings, uniqueAxes: axes };
  
  }, [employees, interactions, pdiActionsMap, dateRange, loadingData]);
  
  const filteredLeaderRankings = useMemo(() => {
    if (axisFilter === "all") {
        return leaderRankings;
    }
    return leaderRankings.filter(leader => leader.axis === axisFilter);
  }, [leaderRankings, axisFilter]);


  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(" ");
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return names[0]?.substring(0, 2) || '';
  };
  
  const isLoading = areEmployeesLoading || loadingData;

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Medal className="h-6 w-6 text-slate-400" />;
    if (index === 2) return <Trophy className="h-6 w-6 text-amber-700" />;
    return <span className="text-lg font-bold w-6 text-center">{index + 1}</span>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle>Índice de Aderência</CardTitle>
            <CardDescription>
              Percentual de interações anuais realizadas por cada líder com sua equipe.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             <Select onValueChange={setAxisFilter} value={axisFilter} disabled>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por Eixo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Comercial">Comercial</SelectItem>
                {uniqueAxes.filter(axis => axis !== 'Comercial').map((axis) => (
                  <SelectItem key={axis} value={axis} disabled>
                    {axis}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-6 w-6" />
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-4 w-1/4" />
                           <Skeleton className="h-6 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <ul className="space-y-6">
                {filteredLeaderRankings.map((leader, index) => (
                    <li key={leader.id} className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-8 text-center">
                            {getRankIcon(index)}
                        </div>
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={leader.photoURL} alt={leader.name} />
                            <AvatarFallback>{getInitials(leader.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="font-medium">{leader.name}</span>
                                <span className="text-sm font-semibold text-foreground">
                                    {leader.adherenceScore.toFixed(0)}%
                                </span>
                            </div>
                            <Progress value={leader.adherenceScore} className="h-3"/>
                            <div className="text-right text-xs text-muted-foreground mt-1">
                                {leader.completedCount} de {leader.totalCount} interações
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        )}
        {(!isLoading && filteredLeaderRankings.length === 0) && (
            <div className="text-center py-10 text-muted-foreground">
                <p>Nenhum líder encontrado para os filtros selecionados.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
