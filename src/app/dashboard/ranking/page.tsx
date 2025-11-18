
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Employee, Interaction, PDIAction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { isWithinInterval, differenceInMonths, startOfMonth, endOfMonth, getMonth, getYear, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { useRankingCache } from "@/hooks/use-ranking-cache";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Crown, Medal, Trophy, RefreshCw, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface LeaderRanking extends Employee {
  adherenceScore: number;
  completedCount: number;
  totalCount: number;
  bonusPercentage: number;
  totalScore: number;
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

  const { cachedData, saveCache, hasFreshCache, clearCache } = useRankingCache();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefreshCache = async () => {
    console.log('🔄 [RANKING] Forçando atualização de dados...');
    setIsRefreshing(true);
    clearCache();
    // O useEffect vai recarregar automaticamente
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const employeesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, "employees") : null),
    [firestore]
  );
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const [interactions, setInteractions] = useState<Map<string, Interaction[]>>(new Map());
  const [pdiActionsMap, setPdiActionsMap] = useState<Map<string, PDIAction[]>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  
  // Usar cache se disponível
  useEffect(() => {
    if (cachedData && hasFreshCache) {
      console.log('⚡ [RANKING] Usando dados do cache');
      setInteractions(cachedData.interactions);
      setPdiActionsMap(cachedData.pdiActions);
      setLoadingData(false);
    }
  }, [cachedData, hasFreshCache]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!firestore || !employees) return;
      
      // Se já tem cache válido E não está forçando refresh, não recarregar
      if (hasFreshCache && !isRefreshing) {
        console.log('⚡ [RANKING] Usando cache, pulando fetch');
        return;
      }

      console.time('⚡ [RANKING] Carregamento de dados');
      setLoadingData(true);
      
      const allManagedEmployeeIds = employees
        .filter(e => e.isUnderManagement)
        .map(e => e.id);

      console.log(`📊 [RANKING] Carregando dados de ${allManagedEmployeeIds.length} colaboradores em paralelo...`);

      try {
        // 🚀 OTIMIZAÇÃO: Fazer TODAS as requisições em PARALELO
        const allPromises = allManagedEmployeeIds.map(async (id) => {
          const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
          const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));
          
          const [interactionsSnapshot, pdiActionsSnapshot] = await Promise.all([
            getDocs(interactionsQuery),
            getDocs(pdiActionsQuery)
          ]);

          return {
            id,
            interactions: interactionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Interaction),
            pdiActions: pdiActionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as PDIAction),
          };
        });

        // Aguarda TODAS as requisições em paralelo
        const results = await Promise.all(allPromises);

        // Constrói os mapas
        const interactionsMap = new Map<string, Interaction[]>();
        const pdiMap = new Map<string, PDIAction[]>();

        results.forEach(({ id, interactions, pdiActions }) => {
          interactionsMap.set(id, interactions);
          pdiMap.set(id, pdiActions);
        });
        
        setInteractions(interactionsMap);
        setPdiActionsMap(pdiMap);
        
        // 💾 Salvar no cache
        saveCache(interactionsMap, pdiMap, allManagedEmployeeIds);
        
        console.timeEnd('⚡ [RANKING] Carregamento de dados');
        console.log(`✅ [RANKING] ${results.length} colaboradores carregados com sucesso e salvos em cache`);
      } catch (error) {
        console.error('❌ [RANKING] Erro ao carregar dados:', error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllData();
  }, [employees, firestore, hasFreshCache, isRefreshing, saveCache]);
  
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
      
      // 🎯 BÔNUS: A cada 10 interações completadas = +3%
      const bonusPercentage = Math.floor(totalCompleted / 10) * 3;
      const totalScore = adherenceScore + bonusPercentage;
      
      console.log(`📊 [RANKING] ${leader.name}: ${adherenceScore.toFixed(0)}% + ${bonusPercentage}% = ${totalScore.toFixed(0)}%`);
      
      return {
        ...leader,
        adherenceScore: Number(adherenceScore.toFixed(2)),
        bonusPercentage: Number(bonusPercentage),
        totalScore: Number(totalScore.toFixed(2)),
        completedCount: Math.round(totalCompleted),
        totalCount: Math.round(totalRequired),
      };
    }).sort((a, b) => {
      // Ordenar por score total (com bônus), depois por aderência como desempate
      if (Math.abs(b.totalScore - a.totalScore) < 0.01) {
        return b.adherenceScore - a.adherenceScore;
      }
      return b.totalScore - a.totalScore;
    });
  
    return { leaderRankings: rankings, uniqueAxes: axes };
  
  }, [employees, interactions, pdiActionsMap, dateRange, loadingData]);
  
  const filteredLeaderRankings = useMemo(() => {
    const filtered = axisFilter === "all" 
      ? leaderRankings 
      : leaderRankings.filter(leader => leader.axis === axisFilter);
    
    // Garantir que está ordenado por totalScore
    const sorted = [...filtered].sort((a, b) => {
      if (Math.abs(b.totalScore - a.totalScore) < 0.01) {
        return b.adherenceScore - a.adherenceScore;
      }
      return b.totalScore - a.totalScore;
    });
    
    console.log('🏆 [RANKING] Top 3:', sorted.slice(0, 3).map(l => `${l.name}: ${l.totalScore.toFixed(0)}%`));
    
    return sorted;
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
            <CardTitle className="flex items-center gap-2">
              Índice de Aderência
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Como funciona:</p>
                    <p className="text-xs mb-2">
                      • <span className="text-green-600">Verde</span>: Aderência às interações obrigatórias
                    </p>
                    <p className="text-xs mb-2">
                      • <span className="text-red-600">Vermelho</span>: Bônus (+3% a cada 10 interações)
                    </p>
                    <p className="text-xs">
                      O ranking é ordenado pelo score total (aderência + bônus)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Percentual de interações realizadas + bônus por volume. A cada 10 interações completadas, o líder ganha +3% extra.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshCache}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {hasFreshCache ? 'Atualizar' : 'Recarregar'}
            </Button>
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
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="font-medium">{leader.name}</span>
                                <span className="text-sm font-semibold text-foreground">
                                    {leader.adherenceScore.toFixed(0)}%
                                    {leader.bonusPercentage > 0 && (
                                        <>
                                            <span className="text-red-600"> + {leader.bonusPercentage}%</span>
                                            <span className="text-muted-foreground"> = {leader.totalScore.toFixed(0)}%</span>
                                        </>
                                    )}
                                </span>
                            </div>
                            
                            {/* Barras de Progresso Empilhadas */}
                            <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                                {/* Barra Verde (Aderência) */}
                                <div
                                    className="absolute top-0 left-0 h-full bg-green-600 transition-all"
                                    style={{ width: `${Math.min(leader.adherenceScore, 100)}%` }}
                                />
                                {/* Barra Vermelha (Bônus) */}
                                {leader.bonusPercentage > 0 && (
                                    <div
                                        className="absolute top-0 h-full bg-red-600 transition-all"
                                        style={{ 
                                            left: `${Math.min(leader.adherenceScore, 100)}%`,
                                            width: `${Math.min(leader.bonusPercentage, 100 - leader.adherenceScore)}%` 
                                        }}
                                    />
                                )}
                            </div>
                            
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
