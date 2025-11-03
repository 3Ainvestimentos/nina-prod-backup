
"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { Employee, Interaction, InteractionStatus, PDIAction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { isWithinInterval, startOfMonth, endOfMonth, getMonth, getYear, parseISO, differenceInMonths } from "date-fns";
import { DateRange } from "react-day-picker";

import {
  Card,
  CardContent,
  CardDescription,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker";


interface TrackedEmployee extends Employee {
  lastInteraction?: string;
  interactionStatus: InteractionStatus;
  nextInteraction?: string;
}

const interactionTypes: { value: "1:1" | "PDI" | "Índice de Risco" | "N3 Individual" | "Feedback", label: string, description: string }[] = [
    { value: "1:1", label: "1:1", description: "Trimestral (Mar, Jun, Set, Dez)" },
    { value: "PDI", label: "PDI", description: "Semestral (Jan, Jul)" },
    { value: "Índice de Risco", label: "Índice de Risco", description: "Mensal" },
    { value: "N3 Individual", label: "N3 Individual", description: "Segmento" },
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


export default function LeadershipDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const [interactions, setInteractions] = useState<Map<string, Interaction[]>>(new Map());
  const [pdiActionsMap, setPdiActionsMap] = useState<Map<string, PDIAction[]>>(new Map());
  const [loadingData, setLoadingData] = useState(true);

  const [leaderFilter, setLeaderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InteractionStatus>("all");
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<"1:1" | "PDI" | "Índice de Risco" | "N3 Individual" | "Feedback">("1:1");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });


  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;

    if (user.email === 'matheus@3ainvestimentos.com.br') {
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
    }
  }, [currentUserEmployee]);


  useEffect(() => {
    const fetchData = async () => {
      if (!firestore || !employees || !currentUserEmployee) return;
  
      setLoadingData(true);
      const managedEmployeeIds = employees
        .filter(e => e.isUnderManagement && (currentUserEmployee.isAdmin || currentUserEmployee.isDirector || e.leaderId === currentUserEmployee.id))
        .map(e => e.id);
  
      const interactionsMap = new Map<string, Interaction[]>();
      const pdiActionsMap = new Map<string, PDIAction[]>();
  
      for (const id of managedEmployeeIds) {
        const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
        const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));
  
        const [interactionsSnapshot, pdiActionsSnapshot] = await Promise.all([
          getDocs(interactionsQuery),
          getDocs(pdiActionsQuery)
        ]);
  
        const employeeInteractions = interactionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Interaction);
        interactionsMap.set(id, employeeInteractions);
  
        const employeePdiActions = pdiActionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as PDIAction);
        pdiActionsMap.set(id, employeePdiActions);
      }
      
      setInteractions(interactionsMap);
      setPdiActionsMap(pdiActionsMap);
      setLoadingData(false);
    };
  
    fetchData();
  }, [employees, firestore, currentUserEmployee]);
  
  const trackedEmployees = useMemo((): TrackedEmployee[] => {
    if (!employees || !currentUserEmployee || !dateRange?.from || !dateRange?.to) return [];
  
    const range = { start: dateRange.from, end: dateRange.to };
  
    return employees
      .filter(e => {
        if (!e.isUnderManagement) return false;
        if (currentUserEmployee.isAdmin || currentUserEmployee.isDirector) return true;
        if (currentUserEmployee.role === 'Líder') return e.leaderId === currentUserEmployee.id;
        return false;
      })
      .map(employee => {
        let status: InteractionStatus = "Pendente";
        let lastInteractionDate: string | undefined;
        let nextInteractionDate: string | undefined;
  
        const schedule = interactionSchedules[interactionTypeFilter as keyof typeof interactionSchedules];
        
        if (interactionTypeFilter === 'N3 Individual') {
            const segment = employee.segment as keyof typeof n3IndividualSchedule | undefined;
            const requiredCountPerMonth = segment ? n3IndividualSchedule[segment] : 0;
            
            if (requiredCountPerMonth === 0) {
                status = "N/A";
            } else {
                const monthsInRange = differenceInMonths(range.end, range.start) + 1;
                const totalRequired = requiredCountPerMonth * monthsInRange;
                const employeeInteractions = interactions.get(employee.id) || [];
                const executedCount = employeeInteractions.filter(int =>
                    int.type === 'N3 Individual' && isWithinInterval(parseISO(int.date), range)
                ).length;

                if (executedCount >= totalRequired) {
                    status = "Executada";
                } else {
                    status = `Realizado ${executedCount}/${totalRequired}`;
                }
            }

        } else if (schedule) {
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
  
            if (requiredCountInPeriod === 0) {
                 status = "N/A";
            } else {
                let executedCount = 0;
                if (interactionTypeFilter === 'PDI') {
                    const employeePdiActions = pdiActionsMap.get(employee.id) || [];
                    executedCount = employeePdiActions.filter(action => isWithinInterval(parseISO(action.startDate), range)).length;
                } else {
                    const employeeInteractions = interactions.get(employee.id) || [];
                    executedCount = employeeInteractions.filter(int => 
                        int.type === interactionTypeFilter && isWithinInterval(parseISO(int.date), range)
                    ).length;
                }
                
                if (executedCount >= requiredCountInPeriod) {
                    status = "Executada";
                } else {
                    status = `Realizado ${executedCount}/${requiredCountInPeriod}`;
                }
            }
        } else {
          // Logic for interactions without a fixed schedule (e.g., Feedback)
          const employeeInteractions = interactions.get(employee.id) || [];
          const wasExecuted = employeeInteractions.some(int =>
            int.type === interactionTypeFilter && isWithinInterval(parseISO(int.date), range)
          );
           if (wasExecuted) {
                status = "Executada";
           } else {
                status = "Realizado 0/1";
           }
        }
  
        // Find the last interaction and next date for display, regardless of status
        if (interactionTypeFilter === 'PDI') {
          const allActions = (pdiActionsMap.get(employee.id) || [])
            .sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());
          lastInteractionDate = allActions.length > 0 ? allActions[0].startDate : undefined;
        } else {
          const allTypedInteractions = (interactions.get(employee.id) || [])
            .filter(int => int.type === interactionTypeFilter)
            .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
          lastInteractionDate = allTypedInteractions.length > 0 ? allTypedInteractions[0].date : undefined;
          nextInteractionDate = allTypedInteractions.length > 0 ? allTypedInteractions[0].nextInteractionDate : undefined;
        }
  
        return {
          ...employee,
          lastInteraction: lastInteractionDate,
          interactionStatus: status,
          nextInteraction: nextInteractionDate,
        };
      });
  }, [employees, interactions, pdiActionsMap, currentUserEmployee, interactionTypeFilter, dateRange]);


  const groupedAndFilteredEmployees = useMemo(() => {
    const filtered = trackedEmployees.filter(member => {
        const leaderMatch = leaderFilter === 'all' || member.leaderId === leaderFilter;
        const statusMatch = statusFilter === 'all' || member.interactionStatus === statusFilter;
        return leaderMatch && statusMatch;
    });

    const grouped = filtered.reduce((acc, employee) => {
        const area = employee.area || "Sem Área";
        if (!acc[area]) {
            acc[area] = [];
        }
        acc[area].push(employee);
        return acc;
    }, {} as { [key: string]: TrackedEmployee[] });

    // Sort employees within each group by name
    for (const area in grouped) {
        grouped[area].sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });
    }
    
    // Sort the groups (areas) alphabetically, keeping "Sem Área" last
    return Object.entries(grouped).sort(([areaA], [areaB]) => {
        if (areaA === "Sem Área") return 1;
        if (areaB === "Sem Área") return -1;
        return areaA.localeCompare(areaB);
    });

  }, [trackedEmployees, leaderFilter, statusFilter]);

  const leadersWithTeams = useMemo(() => {
    if (!employees) return [];
    
    return employees
      .filter(e => e.role === 'Líder')
      .sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
      
  }, [employees]);


  const getBadgeVariant = (status: InteractionStatus) => {
    if (status === "Executada") return "default";
    if (status === "Pendente") return "destructive";
    if (status.startsWith("Realizado 0/")) return "destructive";
    if (status.startsWith("Realizado")) return "secondary";
    return "outline";
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Select onValueChange={setLeaderFilter} value={leaderFilter} disabled={isLoading || isLeaderOnly}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Equipes" />
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
                <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span>{interactionTypes.find(type => type.value === interactionTypeFilter)?.label}</span>
                        <span className="text-xs text-muted-foreground">{interactionTypes.find(type => type.value === interactionTypeFilter)?.description}</span>
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
              <SelectTrigger>
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Executada">Executada</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequência de Interações</CardTitle>
          <CardDescription>
            Acompanhe a frequência das interações com sua equipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead className="hidden md:table-cell">Líder</TableHead>
                <TableHead className="hidden lg:table-cell">Área</TableHead>
                <TableHead className="hidden sm:table-cell">Última Interação</TableHead>
                <TableHead className="hidden sm:table-cell">Próxima Interação</TableHead>
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
              ) : groupedAndFilteredEmployees.length > 0 ? (
                groupedAndFilteredEmployees.map(([area, members]) => (
                  <React.Fragment key={area}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={6} className="font-bold text-foreground">
                        {area}
                      </TableCell>
                    </TableRow>
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
                    Nenhum colaborador gerenciado encontrado ou correspondente aos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

    