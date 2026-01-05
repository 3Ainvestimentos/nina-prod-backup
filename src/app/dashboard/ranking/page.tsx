
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Employee, Interaction, PDIAction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { isWithinInterval, differenceInMonths, startOfMonth, endOfMonth, getMonth, getYear, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { useRankingCache } from "@/hooks/use-ranking-cache";
import { useAppConfig } from "@/hooks/use-app-config";

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
import { Crown, Medal, Trophy, RefreshCw, Info, History, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { subMonths, format } from "date-fns";


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

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type ChartConfig = {
  [key: string]: {
    label: string;
    color: string;
  };
};


export default function RankingPage() {
  const firestore = useFirestore();
  const { rankingBonusEnabled } = useAppConfig();
  const [axisFilter, setAxisFilter] = useState("Comercial");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [viewMode, setViewMode] = useState<'ranking' | 'historical'>('ranking');

  const { cachedData, saveCache, hasFreshCache, clearCache } = useRankingCache(rankingBonusEnabled);
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
        
        // 💾 Salvar no cache com o estado atual do bônus
        saveCache(interactionsMap, pdiMap, allManagedEmployeeIds, rankingBonusEnabled);
        
        console.timeEnd('⚡ [RANKING] Carregamento de dados');
        console.log(`✅ [RANKING] ${results.length} colaboradores carregados com sucesso e salvos em cache`);
      } catch (error) {
        console.error('❌ [RANKING] Erro ao carregar dados:', error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllData();
  }, [employees, firestore, hasFreshCache, isRefreshing, saveCache, rankingBonusEnabled]);
  
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

    const rankings: LeaderRanking[] = leaders.map(leader => {
      const teamMembers = employees.filter(e => e.leaderId === leader.id && e.isUnderManagement);
      
      if (teamMembers.length === 0) {
        return { 
          ...leader, 
          adherenceScore: 0, 
          bonusPercentage: 0,
          totalScore: 0,
          completedCount: 0, 
          totalCount: 0 
        };
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
      
      // 🎯 BÔNUS: A cada 10 interações completadas = +3% (se habilitado)
      const bonusPercentage = rankingBonusEnabled ? Math.floor(totalCompleted / 10) * 3 : 0;
      const totalScore = adherenceScore + bonusPercentage;
      
      console.log(`📊 [RANKING] ${leader.name}: ${adherenceScore.toFixed(0)}% + ${bonusPercentage}% (bonus ${rankingBonusEnabled ? 'ON' : 'OFF'}) = ${totalScore.toFixed(0)}%`);
      
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
  
  }, [employees, interactions, pdiActionsMap, dateRange, loadingData, rankingBonusEnabled]);
  
  const filteredLeaderRankings: LeaderRanking[] = useMemo(() => {
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

  // Função para calcular aderência de um líder para um período específico
  const calculateLeaderAdherence = useCallback((
    leader: Employee,
    range: { start: Date; end: Date },
    interactions: Map<string, Interaction[]>,
    pdiActionsMap: Map<string, PDIAction[]>,
    employees: Employee[]
  ): number => {
    const teamMembers = employees.filter(e => e.leaderId === leader.id && e.isUnderManagement);
    
    if (teamMembers.length === 0) return 0;

    let totalCompleted = 0;
    let totalRequired = 0;

    const fromMonth = getMonth(range.start);
    const fromYear = getYear(range.start);
    const toMonth = getMonth(range.end);
    const toYear = getYear(range.end);
    const monthsInRange = differenceInMonths(range.end, range.start) + 1;

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

    return totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
  }, []);

  const [historicalChartData, setHistoricalChartData] = useState<Array<Record<string, number | string>>>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // Calcular histórico dos últimos 12 meses em paralelo
  useEffect(() => {
    console.log('🔄 [HISTÓRICO] useEffect chamado', { 
      viewMode, 
      hasEmployees: !!employees, 
      employeesCount: employees?.length,
      loadingData,
      interactionsSize: interactions.size,
      pdiActionsMapSize: pdiActionsMap.size
    });
    
    if (viewMode !== 'historical') {
      console.log('🔄 [HISTÓRICO] Não está em modo histórico, limpando dados');
      setHistoricalChartData([]);
      setIsLoadingHistorical(false);
      return;
    }

    if (!employees) {
      console.log('🔄 [HISTÓRICO] Sem employees, aguardando...');
      setHistoricalChartData([]);
      setIsLoadingHistorical(false);
      return;
    }

    // Se ainda está carregando dados, aguardar
    if (loadingData) {
      console.log('🔄 [HISTÓRICO] Ainda carregando dados, aguardando...');
      setIsLoadingHistorical(true);
      return;
    }

    setIsLoadingHistorical(true);

    // Usar setTimeout para não bloquear a UI imediatamente
    const calculateHistorical = async () => {
      // Dar tempo para a UI atualizar o estado de loading
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        const startTime = performance.now();
        console.log('📊 [HISTÓRICO] Iniciando cálculo do histórico...');
        const leaders = employees.filter(e => e.role === 'Líder');
        const filteredLeaders = axisFilter === "all" 
          ? leaders 
          : leaders.filter(leader => leader.axis === axisFilter);

        // Gerar array dos meses a partir de outubro de 2025
        const currentDate = new Date();
        const october2025 = new Date(2025, 9, 1); // Outubro é mês 9 (0-indexed)
        
        // Calcular quantos meses desde outubro até hoje
        const monthsSinceOctober = differenceInMonths(currentDate, october2025) + 1;
        const totalMonths = Math.max(1, Math.min(monthsSinceOctober, 12)); // Máximo 12 meses, mínimo 1
        
        console.log(`📊 [HISTÓRICO] ${filteredLeaders.length} líderes x ${totalMonths} meses = ${filteredLeaders.length * totalMonths} cálculos`);
        
        const months = Array.from({ length: totalMonths }, (_, i) => {
          const monthDate = new Date(october2025);
          monthDate.setMonth(october2025.getMonth() + i);
          return {
            date: monthDate,
            start: startOfMonth(monthDate),
            end: endOfMonth(monthDate),
          };
        });

        // Calcular TODOS os meses e líderes em paralelo (máxima performance)
        const calcStartTime = performance.now();
        const allCalculations = months.flatMap(month => 
          filteredLeaders.map(leader => ({
            month,
            leader,
            key: `${month.date.getTime()}-${leader.id}`
          }))
        );

        // Calcular tudo em paralelo usando Promise.all
        const calculationPromises = allCalculations.map(async ({ month, leader }) => {
          const adherence = calculateLeaderAdherence(
            leader,
            { start: month.start, end: month.end },
            interactions,
            pdiActionsMap,
            employees
          );
          return {
            monthKey: format(month.date, 'MMM/yy'),
            monthDate: month.date,
            leaderId: leader.id,
            adherence: Number(adherence.toFixed(2))
          };
        });

        const results = await Promise.all(calculationPromises);
        const calcEndTime = performance.now();
        console.log(`⚡ [HISTÓRICO] Cálculo paralelo concluído em ${(calcEndTime - calcStartTime).toFixed(2)}ms`);

        // Agrupar resultados por mês mantendo a ordem original
        const monthDataMap = new Map<string, { date: string; data: Record<string, number | string>; sortKey: number }>();
        
        results.forEach(({ monthKey, monthDate, leaderId, adherence }) => {
          if (!monthDataMap.has(monthKey)) {
            monthDataMap.set(monthKey, {
              date: monthKey,
              data: { date: monthKey },
              sortKey: monthDate.getTime()
            });
          }
          const monthEntry = monthDataMap.get(monthKey)!;
          monthEntry.data[leaderId] = adherence;
        });

        // Converter para array e ordenar por data (mais antigo primeiro)
        const data = Array.from(monthDataMap.values())
          .sort((a, b) => a.sortKey - b.sortKey)
          .map(entry => entry.data);
        console.log('📊 [HISTÓRICO] Dados calculados:', data.length, 'meses');

        // Filtrar apenas líderes que têm dados em pelo menos um mês (incluindo 0%)
        const leadersWithData = new Set<string>();
        data.forEach(month => {
          Object.keys(month).forEach(key => {
            if (key !== 'date' && month[key] !== undefined && month[key] !== null) {
              leadersWithData.add(key);
            }
          });
        });

        console.log('📊 [HISTÓRICO] Líderes com dados:', leadersWithData.size);
        console.log('📊 [HISTÓRICO] Sample data:', data.slice(0, 2));

        // Filtrar dados para mostrar apenas líderes com dados
        const filteredData = data.map(month => {
          const filtered: Record<string, number | string> = { date: month.date };
          leadersWithData.forEach(leaderId => {
            if (month[leaderId] !== undefined && month[leaderId] !== null) {
              filtered[leaderId] = month[leaderId];
            }
          });
          return filtered;
        });

        console.log('📊 [HISTÓRICO] Dados filtrados:', filteredData.length, 'meses');
        console.log('📊 [HISTÓRICO] Sample filtered:', filteredData.slice(0, 2));
        const totalEndTime = performance.now();
        console.log(`✅ [HISTÓRICO] Processo completo em ${(totalEndTime - startTime).toFixed(2)}ms`);
        
        if (filteredData.length === 0) {
          console.warn('⚠️ [HISTÓRICO] Nenhum dado foi gerado!');
        }
        
        setHistoricalChartData(filteredData);
        setIsLoadingHistorical(false);
      } catch (error) {
        console.error('❌ [HISTÓRICO] Erro ao calcular histórico:', error);
        console.error('❌ [HISTÓRICO] Stack:', error instanceof Error ? error.stack : 'N/A');
        setHistoricalChartData([]);
        setIsLoadingHistorical(false);
      }
    };

    calculateHistorical();
  }, [viewMode, employees, interactions, pdiActionsMap, loadingData, axisFilter, calculateLeaderAdherence]);

  const historicalChartConfig = useMemo(() => {
    if (!employees || viewMode !== 'historical') return {};
    
    const leaders = employees.filter(e => e.role === 'Líder');
    const filteredLeaders = axisFilter === "all" 
      ? leaders 
      : leaders.filter(leader => leader.axis === axisFilter);

    const config: ChartConfig = {};
    filteredLeaders.forEach((leader, index) => {
      // Verificar se o líder tem dados no histórico
      const hasData = historicalChartData.some(month => 
        month[leader.id] !== undefined && month[leader.id] !== null
      );
      
      if (hasData) {
        config[leader.id] = {
          label: leader.name,
          color: chartColors[index % chartColors.length],
        };
      }
    });
    return config;
  }, [employees, axisFilter, historicalChartData, viewMode]);

  const leadersWithHistoricalData = useMemo(() => {
    if (!employees || viewMode !== 'historical') return [];
    
    const leaders = employees.filter(e => e.role === 'Líder');
    const filteredLeaders = axisFilter === "all" 
      ? leaders 
      : leaders.filter(leader => leader.axis === axisFilter);

    const leadersWithData = filteredLeaders.filter(leader => {
      return historicalChartData.some(month => 
        month[leader.id] !== undefined && month[leader.id] !== null
      );
    });
    
    console.log('📊 [HISTÓRICO] leadersWithHistoricalData:', leadersWithData.length, 'de', filteredLeaders.length);
    
    return leadersWithData;
  }, [employees, axisFilter, historicalChartData, viewMode]);

  // State para controlar qual linha está em hover
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  
  // State para controlar qual linha está selecionada (clicada na legenda)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // Tooltip customizado para mostrar apenas a linha sob o cursor
  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    // Filtra apenas itens com valor (remove undefined/null)
    let validPayload = payload.filter((item: any) => item.value != null);
    
    if (hoveredLineId) {
      // Se há uma linha específica em hover, mostra apenas ela
      validPayload = validPayload.filter((item: any) => item.dataKey === hoveredLineId);
    } else {
      // Caso contrário, ordena por valor (maior aderência no topo)
      validPayload = [...validPayload].sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));
    }
    
    if (validPayload.length === 0) return null;
    
    return (
      <div className="rounded-lg border bg-background px-2 py-1.5 shadow-md text-xs">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <div className="space-y-0.5">
          {validPayload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-1.5">
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: item.stroke || item.color }}
              />
              <span className="text-xs font-medium truncate max-w-[120px]">{item.name}</span>
              <span className="text-xs font-bold ml-auto">{item.value?.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const toggleView = () => {
    setViewMode(prev => prev === 'ranking' ? 'historical' : 'ranking');
  };

  return (
    <Card className="overflow-hidden" style={{ scrollbarGutter: 'stable' }}>
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
                      • <span className="text-green-400">Verde Claro</span>: Aderência às interações obrigatórias
                    </p>
                    {rankingBonusEnabled && (
                      <>
                        <p className="text-xs mb-2">
                          • <span className="text-green-700">Verde Escuro</span>: Bônus (+3% a cada 10 interações)
                        </p>
                        <p className="text-xs">
                          O ranking é ordenado pelo score total (aderência + bônus)
                        </p>
                      </>
                    )}
                    {!rankingBonusEnabled && (
                      <p className="text-xs">
                        O ranking é ordenado pela % de aderência
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Percentual de interações realizadas por cada líder com sua equipe.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={toggleView}
              className="font-semibold text-white"
              style={{ 
                backgroundColor: 'hsl(170, 60%, 50%)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(170, 60%, 45%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(170, 60%, 50%)';
              }}
            >
              {viewMode === 'ranking' ? (
                <>
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </>
              ) : (
                <>
                  <List className="h-4 w-4 mr-2" />
                  Ranking
                </>
              )}
            </Button>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             <Select onValueChange={setAxisFilter} value={axisFilter} disabled>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por Eixo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Comercial">Comercial</SelectItem>
                {uniqueAxes.filter(axis => axis && axis !== 'Comercial').map((axis) => (
                  <SelectItem key={axis} value={axis!} disabled>
                    {axis}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-hidden">
        {viewMode === 'ranking' ? (
          <>
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
              <ul className="space-y-6 overflow-x-hidden">
                {filteredLeaderRankings.map((leader, index) => (
                  <li key={leader.id} className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0 w-8 text-center">
                      {getRankIcon(index)}
                    </div>
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={leader.photoURL} alt={leader.name} />
                      <AvatarFallback>{getInitials(leader.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-2 gap-2">
                        <span className="font-medium truncate">{leader.name}</span>
                        {rankingBonusEnabled ? (
                          <span className="text-sm font-semibold">
                            <span className="text-muted-foreground">{leader.adherenceScore.toFixed(0)}%</span>
                            <span className="text-muted-foreground"> + </span>
                            <span className="text-muted-foreground">{leader.bonusPercentage}% bônus</span>
                            <span className="text-foreground"> = </span>
                            <span className="text-foreground">{leader.totalScore.toFixed(0)}%</span>
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-foreground">
                            {leader.adherenceScore.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      
                      {/* Barras de Progresso Empilhadas */}
                      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                        {/* Barra Verde Claro (Aderência) */}
                        <div
                          className="absolute top-0 left-0 h-full bg-green-400 transition-all"
                          style={{ width: `${Math.min(leader.adherenceScore, 100)}%` }}
                        />
                        {/* Barra Verde Escuro (Bônus) - apenas se habilitado */}
                        {rankingBonusEnabled && leader.bonusPercentage > 0 && (
                          <div
                            className="absolute top-0 h-full bg-green-700 transition-all"
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
          </>
        ) : (
          <>
            {(isLoadingHistorical || isLoading) ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Skeleton className="h-full w-full min-h-[400px]" />
                <p className="text-sm text-muted-foreground">Calculando histórico dos últimos 12 meses...</p>
              </div>
            ) : historicalChartData.length > 0 ? (
              (() => {
                // Garantir que temos líderes com dados antes de renderizar
                const leadersToShow = leadersWithHistoricalData.length > 0 
                  ? leadersWithHistoricalData 
                  : (() => {
                      // Se ainda não temos leadersWithHistoricalData, extrair dos dados
                      const leaderIds = new Set<string>();
                      historicalChartData.forEach(month => {
                        Object.keys(month).forEach(key => {
                          if (key !== 'date') leaderIds.add(key);
                        });
                      });
                      return employees?.filter(e => e.role === 'Líder' && leaderIds.has(e.id)) || [];
                    })();
                
                // Criar config dinamicamente se necessário
                const finalConfig: ChartConfig = {};
                leadersToShow.forEach((leader, index) => {
                  finalConfig[leader.id] = {
                    label: leader.name,
                    color: historicalChartConfig[leader.id]?.color || chartColors[index % chartColors.length],
                  };
                });
                
                console.log('🎨 [HISTÓRICO] Renderizando gráfico:', {
                  chartDataLength: historicalChartData.length,
                  leadersToShow: leadersToShow.length,
                  configKeys: Object.keys(finalConfig).length,
                  sampleData: historicalChartData[0]
                });
                
                if (leadersToShow.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground text-sm gap-2">
                      <p>Dados calculados, mas nenhum líder encontrado para exibir.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="w-full overflow-x-hidden" style={{ height: '400px', maxWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={historicalChartData} 
                        margin={{ top: 5, right: 20, left: 10, bottom: 40 }}
                        style={{ maxWidth: '100%' }}
                      >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickMargin={10} padding={{ left: 12, right: 12 }} />
                      <YAxis domain={[0, 100]} />
                      <ChartTooltip content={<CustomLineTooltip />} />
                      <Legend 
                        content={({ payload }) => {
                          if (!payload) return null;
                          return (
                            <div className="flex flex-wrap gap-4 justify-center mt-4">
                              {payload.map((entry: any, index: number) => {
                                const leaderId = leadersToShow[index]?.id;
                                const isSelected = selectedLineId === leaderId;
                                return (
                                  <div
                                    key={entry.value}
                                    onClick={() => setSelectedLineId(isSelected ? null : leaderId || null)}
                                    className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                                      selectedLineId && !isSelected ? 'opacity-30' : 'opacity-100'
                                    } hover:opacity-100`}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: entry.color,
                                        borderRadius: '2px',
                                        transform: 'rotate(45deg)',
                                      }}
                                    />
                                    <span className="text-xs">{entry.value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }}
                      />
                      {leadersToShow.map((leader, index) => {
                        const isSelected = selectedLineId === leader.id;
                        const isDimmed = selectedLineId !== null && !isSelected;
                        const color = finalConfig[leader.id]?.color || chartColors[index % chartColors.length];
                        return (
                          <Line 
                            key={leader.id} 
                            type="monotone" 
                            dataKey={leader.id} 
                            stroke={color} 
                            name={leader.name}
                            strokeWidth={isSelected ? 4 : 3}
                            strokeOpacity={isDimmed ? 0.3 : 1}
                            dot={false}
                            activeDot={{ r: 6 }}
                            connectNulls
                            onMouseEnter={() => setHoveredLineId(leader.id)}
                            onMouseLeave={() => setHoveredLineId(null)}
                          />
                        );
                      })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground text-sm gap-2">
                <p>Nenhum dado histórico disponível para os filtros selecionados.</p>
                <p className="text-xs">Verifique se há líderes com interações nos últimos 12 meses.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
