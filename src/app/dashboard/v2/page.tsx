
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { Employee, Interaction, InteractionStatus, PDIAction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { isWithinInterval, startOfMonth, endOfMonth, getMonth, getYear, parseISO, differenceInMonths } from "date-fns";
import { DateRange } from "react-day-picker";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

export const dynamic = 'force-dynamic';

interface TrackedEmployee extends Employee {
  lastInteraction?: string;
  interactionStatus: InteractionStatus;
  nextInteraction?: string;
  allInteractionsStatus?: { [key: string]: InteractionStatus };
  adherence?: number;
}

type SortConfig = {
  key: keyof TrackedEmployee;
  direction: "ascending" | "descending";
} | null;

type InteractionFilterType = "all" | "1:1" | "PDI" | "Índice de Risco" | "N3 Individual" | "Feedback";

const interactionTypes: { value: InteractionFilterType, label: string, description: string }[] = [
    { value: "all", label: "Todas as Interações", description: "Visão geral" },
    { value: "N3 Individual", label: "N3 Individual", description: "Segmento" },
    { value: "Índice de Risco", label: "Índice de Risco", description: "Mensal" },
    { value: "1:1", label: "1:1", description: "Trimestral (Mar, Jun, Set, Dez)" },
    { value: "PDI", label: "PDI", description: "Semestral (Jan, Jul)" },
    { value: "Feedback", label: "Feedback", description: "Sob demanda" },
];


// Definição dos meses obrigatórios para cada tipo de interação (0-indexed: Janeiro=0)
const interactionSchedules: { [key in "1:1" | "PDI" | "Índice de Risco"]?: number[] } = {
    'PDI': [0, 6], // Janeiro e Julho
    '1:1': [2, 5, 8, 11], // Março, Junho, Setembro, Dezembro
    'Índice de Risco': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Todos os meses
};

const n3IndividualSchedule = {
    'Alfa': 4, // 4 por mês
    'Beta': 2, // 2 por mês
    'Senior': 1, // 1 por mês
};

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br'];


export default function LeadershipDashboardV2() {
  const firestore = useFirestore();
  const { user } = useUser();

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const [interactions, setInteractions] = useState<Map<string, Interaction[]>>(new Map());
  const [pdiActionsMap, setPdiActionsMap] = useState<Map<string, PDIAction[]>>(new Map());
  const [loadingData, setLoadingData] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [leaderFilter, setLeaderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InteractionStatus>("all");
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<InteractionFilterType>("all");
  const [axisFilter, setAxisFilter] = useState("Comercial");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });


  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;

    if (user.email && adminEmails.includes(user.email)) {
        const employeeData = employees.find(e => e.email === user.email) || {};
        return {
            ...employeeData,
            name: user.displayName || 'Admin',
            email: user.email,
            isAdmin: true,
            isDirector: true,
            role: 'Líder',
        } as Employee;
    }

    const employeeData = employees.find(e => e.email === user.email);

    if (!employeeData) return null;

    if (employeeData.isAdmin) {
      return {
        ...employeeData,
        role: 'Líder',
        isDirector: true,
      };
    }

    return employeeData;
  }, [user, employees]);

  useEffect(() => {
    if (currentUserEmployee?.role === 'Líder' && !currentUserEmployee.isDirector && !currentUserEmployee.isAdmin) {
      setLeaderFilter(currentUserEmployee.id);
      fetchDataForLeader(currentUserEmployee.id);
    }
  }, [currentUserEmployee]);


  const fetchDataForLeader = useCallback(async (leaderId: string) => {
    if (!firestore || !employees || !currentUserEmployee) return;

    setLoadingData(true);
    setHasSearched(true);
    
    const targetEmployees = employees.filter(e => {
        if (!e.isUnderManagement) return false;
        
        const axisMatches = axisFilter === 'all' || e.axis === axisFilter;
        if (!axisMatches) return false;

        if (leaderId === 'all') {
            return currentUserEmployee.isAdmin || currentUserEmployee.isDirector;
        }
        return e.leaderId === leaderId;
    });

    const targetIds = targetEmployees.map(e => e.id);

    const interactionsMap = new Map<string, Interaction[]>();
    const pdiActionsMap = new Map<string, PDIAction[]>();

    for (const id of targetIds) {
      const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
      const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));

      const [interactionsSnapshot, pdiActionsSnapshot] = await Promise.all([
        getDocs(interactionsQuery),
        getDocs(pdiActionsQuery)
      ]);

      const employeeInteractions = interactionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Interaction));
      interactionsMap.set(id, employeeInteractions);

      const employeePdiActions = pdiActionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PDIAction));
      pdiActionsMap.set(id, employeePdiActions);
    }
    
    setInteractions(interactionsMap);
    setPdiActionsMap(pdiActionsMap);
    setLoadingData(false);
  }, [employees, firestore, currentUserEmployee, axisFilter]);

  const handleLeaderFilterChange = (leaderId: string) => {
    setLeaderFilter(leaderId);
    if (leaderId) {
        fetchDataForLeader(leaderId);
    } else {
        // Clear data if no leader is selected
        setInteractions(new Map());
        setPdiActionsMap(new Map());
        setHasSearched(false);
    }
  };

  const handleAxisFilterChange = (newAxis: string) => {
    setAxisFilter(newAxis);
    setLeaderFilter(""); // Reset leader filter when axis changes
    setInteractions(new Map());
    setPdiActionsMap(new Map());
    setHasSearched(false);
  }
  
const getInteractionStatus = useCallback((
    employee: Employee,
    type: InteractionFilterType,
    range: { start: Date, end: Date },
    employeeInteractions: Interaction[],
    employeePdiActions: PDIAction[]
): InteractionStatus => {
    const schedule = interactionSchedules[type as keyof typeof interactionSchedules];

    if (type === 'N3 Individual') {
        const segment = employee.segment as keyof typeof n3IndividualSchedule | undefined;
        const requiredCountPerMonth = segment ? n3IndividualSchedule[segment] : 0;
        if (requiredCountPerMonth === 0) return "N/A";
        
        const monthsInRange = differenceInMonths(range.end, range.start) + 1;
        const totalRequired = requiredCountPerMonth * monthsInRange;
        const executedCount = employeeInteractions.filter(int =>
            int.type === 'N3 Individual' && isWithinInterval(parseISO(int.date), range)
        ).length;

        if (executedCount >= totalRequired) return "Executada";
        if (executedCount > 0) return `Realizado ${executedCount}/${totalRequired}`;
        return "Realizado 0/" + totalRequired;
    }

    if (schedule) {
        const fromMonth = getMonth(range.start);
        const fromYear = getYear(range.start);
        const toMonth = getMonth(range.end);
        const toYear = getYear(range.end);

        let requiredCountInPeriod = 0;
        for (let y = fromYear; y <= toYear; y++) {
            const startMonth = (y === fromYear) ? fromMonth : 0;
            const endMonth = (y === toYear) ? toMonth : 11;
            requiredCountInPeriod += schedule.filter(month => month >= startMonth && month <= endMonth).length;
        }

        if (requiredCountInPeriod === 0) return "N/A";

        let executedCount = 0;
        if (type === 'PDI') {
            executedCount = employeePdiActions.filter(action => isWithinInterval(parseISO(action.startDate), range)).length;
        } else {
            executedCount = employeeInteractions.filter(int => 
                int.type === type && isWithinInterval(parseISO(int.date), range)
            ).length;
        }
        
        if (executedCount >= requiredCountInPeriod) return "Executada";
        if (executedCount > 0) return `Realizado ${executedCount}/${requiredCountInPeriod}`;
        return "Realizado 0/" + requiredCountInPeriod;
    }

    // Fallback for types without a fixed schedule (e.g., Feedback)
    const wasExecuted = employeeInteractions.some(int =>
        int.type === type && isWithinInterval(parseISO(int.date), range)
    );
    return wasExecuted ? "Executada" : "Pendente";
}, []);

  
  const trackedEmployees = useMemo((): TrackedEmployee[] => {
    if (!employees || !currentUserEmployee || !dateRange?.from || !dateRange?.to || !hasSearched) return [];
  
    const range = { start: dateRange.from, end: dateRange.to };
  
    return employees
      .filter(e => {
        if (!e.isUnderManagement) return false;
        const axisMatches = axisFilter === 'all' || e.axis === axisFilter;
        if (!axisMatches) return false;
        if (leaderFilter === 'all') return currentUserEmployee.isAdmin || currentUserEmployee.isDirector;
        return e.leaderId === leaderFilter;
      })
      .map(employee => {
            const employeeInteractions = interactions.get(employee.id) || [];
            const employeePdiActions = pdiActionsMap.get(employee.id) || [];
            
            const allInteractionsStatus: { [key: string]: InteractionStatus } = {};
            let totalRequired = 0;
            let totalExecuted = 0;

            const allInteractionTypes: InteractionFilterType[] = ["N3 Individual", "Índice de Risco", "1:1", "PDI"];

            allInteractionTypes.forEach(type => {
                const status = getInteractionStatus(employee, type, range, employeeInteractions, employeePdiActions);
                allInteractionsStatus[type] = status;

                if (status.startsWith("Realizado")) {
                    const match = status.match(/(\d+)\/(\d+)/);
                    if (match) {
                        totalExecuted += parseInt(match[1], 10);
                        totalRequired += parseInt(match[2], 10);
                    }
                } else if (status === "Executada") {
                    let required = 1;
                    if (type === 'N3 Individual') {
                        const segment = employee.segment as keyof typeof n3IndividualSchedule | undefined;
                        const requiredCountPerMonth = segment ? n3IndividualSchedule[segment] : 0;
                        const monthsInRange = differenceInMonths(range.end, range.start) + 1;
                        required = requiredCountPerMonth * monthsInRange;
                    } else if (type === '1:1' || type === 'PDI' || type === 'Índice de Risco') {
                        const schedule = interactionSchedules[type];
                        if(schedule) {
                            const fromMonth = getMonth(range.start);
                            const fromYear = getYear(range.start);
                            const toMonth = getMonth(range.end);
                            const toYear = getYear(range.end);
                            let requiredCountInPeriod = 0;
                            for (let y = fromYear; y <= toYear; y++) {
                                const startMonth = (y === fromYear) ? fromMonth : 0;
                                const endMonth = (y === toYear) ? toMonth : 11;
                                requiredCountInPeriod += schedule.filter(month => month >= startMonth && month <= endMonth).length;
                            }
                            required = requiredCountInPeriod;
                        }
                    }
                    totalExecuted += required;
                    totalRequired += required;
                }
            });

            const adherence = totalRequired > 0 ? (totalExecuted / totalRequired) * 100 : 100;
            const interactionStatus = getInteractionStatus(employee, interactionTypeFilter, range, employeeInteractions, employeePdiActions);

            let lastInteractionDate: string | undefined;
            let nextInteractionDate: string | undefined;

            if(interactionTypeFilter !== 'all' && interactionTypeFilter !== 'PDI') {
                const allTypedInteractions = employeeInteractions
                    .filter(int => int.type === interactionTypeFilter)
                    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
                lastInteractionDate = allTypedInteractions.length > 0 ? allTypedInteractions[0].date : undefined;
                nextInteractionDate = allTypedInteractions.length > 0 ? allTypedInteractions[0].nextInteractionDate : undefined;
            } else if (interactionTypeFilter === 'PDI') {
                const allActions = employeePdiActions
                    .sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());
                lastInteractionDate = allActions.length > 0 ? allActions[0].startDate : undefined;
            }
  
        return {
          ...employee,
          lastInteraction: lastInteractionDate,
          interactionStatus,
          nextInteraction: nextInteractionDate,
          allInteractionsStatus,
          adherence,
        };
      });
  }, [employees, interactions, pdiActionsMap, currentUserEmployee, interactionTypeFilter, dateRange, hasSearched, leaderFilter, axisFilter, getInteractionStatus]);


  const groupedAndFilteredEmployees = useMemo(() => {
    let filtered = trackedEmployees.filter(member => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'Pendente') return member.interactionStatus.startsWith("Realizado 0/") || member.interactionStatus === 'Pendente';
        return member.interactionStatus === statusFilter;
    });

    if (sortConfig !== null) {
        filtered.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            
            if (sortConfig.key === 'lastInteraction' || sortConfig.key === 'nextInteraction') {
                const dateA = aValue ? parseISO(aValue as string).getTime() : 0;
                const dateB = bValue ? parseISO(bValue as string).getTime() : 0;
                if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }

            if (aValue === undefined || bValue === undefined || aValue === null || bValue === null) return 0;
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                 if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                 if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            }
             if (typeof aValue === 'number' && typeof bValue === 'number') {
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
           }
            return 0;
        });
    }

    const grouped = filtered.reduce((acc, employee) => {
        const area = employee.area || "Sem Área";
        if (!acc[area]) {
            acc[area] = [];
        }
        acc[area].push(employee);
        return acc;
    }, {} as { [key: string]: TrackedEmployee[] });

    // Do not sort employees within group if a sort is active
    if (!sortConfig || sortConfig.key !== 'name') {
      for (const area in grouped) {
          grouped[area].sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    
    // Sort the groups (areas) alphabetically, keeping "Sem Área" last
    return Object.entries(grouped).sort(([areaA], [areaB]) => {
        if (areaA === "Sem Área") return 1;
        if (areaB === "Sem Área") return -1;
        return areaA.localeCompare(areaB);
    });

  }, [trackedEmployees, statusFilter, sortConfig]);

  const defaultExpandedItems = useMemo(() => {
    return trackedEmployees.map(e => e.id);
  }, [trackedEmployees]);

  const requestSort = (key: keyof TrackedEmployee) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };


  const { leadersWithTeams, uniqueAxes } = useMemo(() => {
    if (!employees) return { leadersWithTeams: [], uniqueAxes: [] };
    
    const leaders = employees
      .filter(e => e.role === 'Líder' && (axisFilter === 'all' || e.axis === axisFilter || (axisFilter === 'Comercial' && e.axis === 'Comercial')))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const axes = [...new Set(employees.filter(e => e.role === 'Líder').map(e => e.axis).filter(Boolean))].sort();
      
    return { leadersWithTeams: leaders, uniqueAxes: axes };
  }, [employees, axisFilter]);


  const getBadgeVariant = (status: InteractionStatus) => {
    if (status.startsWith("Realizado 0/") || status === "Pendente") return "destructive"; // Vermelho
    if (status === "Executada") return "default"; // Verde
    if (status.startsWith("Realizado")) return "secondary"; // Cinza
    return "outline"; // N/A
  };

  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(" ");
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return names[0]?.substring(0, 2) || '';
  };
  
  const formatDate = (dateString?: string) => {
      if (!dateString) return "N/A";
      try {
        return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch (e) {
        return "Data inválida";
      }
  }
  
  const isLoading = areEmployeesLoading || loadingData;
  const isLeaderOnly = currentUserEmployee?.role === 'Líder' && !currentUserEmployee.isDirector && !currentUserEmployee.isAdmin;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre as interações por equipe, tipo, status e período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Select onValueChange={handleAxisFilterChange} value={axisFilter} disabled>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todos os Eixos" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="Comercial">Comercial</SelectItem>
                 {uniqueAxes.filter(axis => axis !== 'Comercial').map(axis => (
                    <SelectItem key={axis} value={axis} disabled>
                        {axis}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={handleLeaderFilterChange} value={leaderFilter} disabled={isLoading || isLeaderOnly}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectContent>
                {!isLeaderOnly && <SelectItem value="all">Todas as Equipes</SelectItem>}
                {leadersWithTeams.map((leader) => (
                  <SelectItem key={leader.id} value={leader.id}>
                    {leader.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={value => setInteractionTypeFilter(value as any)} value={interactionTypeFilter} disabled={isLoading}>
                <SelectTrigger className="text-xs">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span>{interactionTypes.find(type => type.value === interactionTypeFilter)?.label}</span>
                        <span className="text-xs text-muted-foreground truncate">{interactionTypes.find(type => type.value === interactionTypeFilter)?.description}</span>
                      </div>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {interactionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                                <span>{type.label}</span>
                                <span className="text-xs text-muted-foreground">{type.description}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select onValueChange={value => setStatusFilter(value as any)} value={statusFilter} disabled={isLoading}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Executada">Executada</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} className="text-xs" />
          </div>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground">
                Lembrete de Limites Mensais: <strong>N3 (Alfa/Beta/Senior):</strong> 4/2/1; <strong>Feedback:</strong> 10; <strong>Índice de Risco:</strong> 1; <strong>1:1:</strong> 1. Para registros adicionais, use a interação 'Feedback'.
            </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequência de Interações</CardTitle>
          <CardDescription>
            Acompanhe a frequência das interações com sua equipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {interactionTypeFilter === 'all' ? (
            <div role="table" className="w-full text-sm">
                <div role="rowgroup">
                    <div role="row" className="flex border-b">
                        <div role="columnheader" className="h-12 px-4 flex-1 flex items-center font-medium text-muted-foreground">Membro</div>
                        <div role="columnheader" className="h-12 px-4 w-48 flex items-center justify-end font-medium text-muted-foreground">Aderência</div>
                    </div>
                </div>
                {isLoading ? (
                    <div role="rowgroup">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} role="row" className="flex items-center p-4 border-b">
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ))}
                    </div>
                ) : hasSearched && groupedAndFilteredEmployees.length > 0 ? (
                    <Accordion type="multiple" className="w-full" defaultValue={defaultExpandedItems}>
                        {groupedAndFilteredEmployees.map(([area, members]) => (
                            <div role="rowgroup" key={area}>
                                <div role="row" className="flex bg-muted/50">
                                    <div role="cell" className="px-4 py-2 flex-1 font-bold text-foreground">{area}</div>
                                </div>
                                {members.map(member => (
                                    <AccordionItem value={member.id} key={member.id} className="border-b">
                                        <AccordionTrigger className="flex justify-between w-full p-4 hover:no-underline hover:bg-muted/50">
                                            <div className="flex items-center gap-3 text-left flex-1">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={member.photoURL} alt={member.name} />
                                                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                                </Avatar>
                                                <div className="grid gap-0.5">
                                                    <span className="font-medium">{member.name}</span>
                                                    <span className="text-xs text-muted-foreground hidden lg:inline">{member.position}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 w-48 justify-end pr-4">
                                                <span className="text-sm font-medium text-muted-foreground">Aderência:</span>
                                                <span className="text-sm font-bold">{member.adherence?.toFixed(0) ?? 0}%</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="pb-4 px-4">
                                                <div role="table" className="w-full bg-background rounded-md border">
                                                    <div role="rowgroup">
                                                      <div role="row" className="flex border-b">
                                                          <div role="columnheader" className="h-10 px-4 flex-1 flex items-center font-medium text-muted-foreground">Tipo de Interação</div>
                                                          <div role="columnheader" className="h-10 px-4 w-40 flex items-center justify-end font-medium text-muted-foreground">Status</div>
                                                      </div>
                                                    </div>
                                                    <div role="rowgroup">
                                                      {member.allInteractionsStatus && Object.entries(member.allInteractionsStatus).map(([type, status]) => (
                                                          <div role="row" className="flex items-center border-b" key={type}>
                                                              <div role="cell" className="px-4 py-2 flex-1 font-medium">{type}</div>
                                                              <div role="cell" className="px-4 py-2 w-40 flex justify-end">
                                                                  <Badge variant={getBadgeVariant(status)}>{status}</Badge>
                                                              </div>
                                                          </div>
                                                      ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </div>
                        ))}
                    </Accordion>
                ) : (
                    <div role="rowgroup">
                        <div role="row" className="flex">
                            <div role="cell" className="flex-1 text-center h-24 flex items-center justify-center text-muted-foreground">
                                {hasSearched ? "Nenhum colaborador encontrado para os filtros selecionados." : "Por favor, selecione uma equipe para visualizar os dados."}
                            </div>
                        </div>
                    </div>
                )}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                 <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('name')} className="px-1">
                        Membro
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Líder</TableHead>
                <TableHead className="hidden lg:table-cell">Área</TableHead>
                <TableHead className="hidden sm:table-cell">
                     <Button variant="ghost" onClick={() => requestSort('lastInteraction')} className="px-1">
                        Última Interação
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                    <Button variant="ghost" onClick={() => requestSort('nextInteraction')} className="px-1">
                        Próxima Interação
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-9 w-9 rounded-full" />
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    </TableRow>
                ))
              ) : hasSearched && groupedAndFilteredEmployees.length > 0 ? (
                groupedAndFilteredEmployees.map(([area, members]) => (
                  <React.Fragment key={area}>
                    {(!sortConfig || sortConfig.key !== 'name') && 
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={6} className="font-bold text-foreground">
                          {area}
                        </TableCell>
                      </TableRow>
                    }
                    {members.map((member) => (
                        <TableRow key={member.id}>
                            <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                <AvatarImage src={member.photoURL} alt={member.name} />
                                <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                </Avatar>
                                <div className="grid gap-0.5">
                                <span className="font-medium">{member.name}</span>
                                <span className="text-xs text-muted-foreground hidden lg:inline">
                                    {member.position}
                                </span>
                                </div>
                            </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{member.leader}</TableCell>
                            <TableCell className="hidden lg:table-cell">{member.area || 'N/A'}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                            {formatDate(member.lastInteraction)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                                {formatDate(member.nextInteraction)}
                            </TableCell>
                            <TableCell>
                            <Badge variant={getBadgeVariant(member.interactionStatus)}>
                                {member.interactionStatus}
                            </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                     {hasSearched ? "Nenhum colaborador encontrado para os filtros selecionados." : "Por favor, selecione uma equipe para visualizar os dados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
