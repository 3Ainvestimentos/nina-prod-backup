
"use client";

import type { Employee, Role, Interaction, PDIAction, Project, PremissasConfig } from "@/lib/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, PlusCircle, Upload, ArrowUpDown, X, Filter, User, ShieldCheck, FileDown, HelpCircle, Copy, Pen, Trash, Briefcase } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CsvUploadDialog } from "@/components/csv-upload-dialog";
import { InteractionCsvUploadDialog } from "@/components/interaction-csv-upload-dialog";
import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useCollection, useFirestore, useMemoFirebase, useUser, useFirebase, softDeleteDocument } from "@/firebase";
import { collection, doc, deleteDoc, updateDoc, setDoc, getDocs, query } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, differenceInMonths, differenceInWeeks, getMonth, getYear, parseISO, isWithinInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { BarChart3, TrendingUp, Users, Target, ChevronDown, ChevronUp } from "lucide-react";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { exportData } from "@/lib/export";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useSearchParams } from "next/navigation";

const superAdminEmails = ['lucas.nogueira@3ainvestimentos.com.br', 'matheus@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];
const emailsToPromote = [
    'lucas.nogueira@3ainvestimentos.com.br',
    'matheus@3ainvestimentos.com.br',
    'henrique.peixoto@3ainvestimentos.com.br'
];

const roles: Role[] = ["Colaborador", "Líder", "Líder de Projeto", "Diretor"];
const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];


type SortConfig = {
  key: keyof Employee;
  direction: "ascending" | "descending";
} | null;

import { useIsConfigAdmin } from "@/hooks/use-is-config-admin";
import { useAppConfig } from "@/hooks/use-app-config";
import { usePremissasConfig } from "@/hooks/use-premissas-config";

type AdminPageProps = {
  forceMetricsOnly?: boolean;
};

function AdminPageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    </div>
  );
}

function AdminPageContent({ forceMetricsOnly = false }: AdminPageProps = {}) {
  // ========================================
  // TODOS OS HOOKS DEVEM VIR ANTES DE QUALQUER RETURN CONDICIONAL!
  // ========================================
  const { isConfigAdmin } = useIsConfigAdmin();
  const { firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const { rankingBonusEnabled, maintenanceMode, isLoading: isConfigLoading } = useAppConfig();
  const { config: premissasConfigFromDB, isLoading: isPremissasConfigLoading } = usePremissasConfig();
  
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isInteractionCsvDialogOpen, setIsInteractionCsvDialogOpen] = useState(false);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [selectedForBackup, setSelectedForBackup] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [setupLoading, setSetupLoading] = useState<{[key: string]: boolean}>({});
  const [loadingReports, setLoadingReports] = useState(true);
  const [newAdminId, setNewAdminId] = useState<string>("");
  const [invalidEmployees, setInvalidEmployees] = useState<Employee[]>([]);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  
  // Estados para Projetos
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Estados para Configurações de Premissas
  const [premissasConfig, setPremissasConfig] = useState<PremissasConfig>({
    cdiAnual: 15,
    impostoRepasse: 19.33,
    multiplicadorB2B: 0.50,
    multiplicadorMINST: 0.25,
  });
  const [premissasLoading, setPremissasLoading] = useState(false);
  
  const searchParams = useSearchParams();
  const isMetricsOnlyMode = forceMetricsOnly || searchParams?.get("mode") === "metrics-only";

  // Estado para controlar aba ativa (permite trocar antes de carregar)
  const [activeTab, setActiveTab] = useState<string>(isMetricsOnlyMode ? "metrics" : "employees");
  // #region agent log
  typeof window!=='undefined'&&fetch('http://127.0.0.1:7319/ingest/47f83980-17ff-478b-92ce-f77a99eb0a35',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e80b'},body:JSON.stringify({sessionId:'96e80b',location:'admin/page.tsx:145',message:'[HYP A+B] isMetricsOnlyMode e activeTab iniciais',data:{forceMetricsOnly,isMetricsOnlyMode,activeTabInit:isMetricsOnlyMode?'metrics':'employees'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // ========================================
  // ESTADOS PARA ABA DE MÉTRICAS
  // ========================================
  const [metricsInteractions, setMetricsInteractions] = useState<Map<string, Interaction[]>>(new Map());
  const [metricsPdiActions, setMetricsPdiActions] = useState<Map<string, PDIAction[]>>(new Map());
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsDateRange, setMetricsDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());
  const [expandedDirectors, setExpandedDirectors] = useState<Set<string>>(new Set());
  
  // Estados para histórico e média ponderada
  const [leadersHistory, setLeadersHistory] = useState<MonthlyHistory[]>([]);
  const [directorsHistory, setDirectorsHistory] = useState<MonthlyHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Estados para progresso semanal
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgressSummary | null>(null);
  const [weeklyProgressLoading, setWeeklyProgressLoading] = useState(false);

  // Estados para métricas de risco
  const [riskMetrics, setRiskMetrics] = useState<{
    history: RiskHistoryPoint[];
    currentHighRisk: HighRiskAdvisor[];
  } | null>(null);
  const [riskMetricsLoading, setRiskMetricsLoading] = useState(false);

  // Constantes para cálculo de métricas (mesmo padrão do ranking)
  const METRICS_GOAL = 80; // Meta de 80%
  
  const n3IndividualSchedule: { [key: string]: number } = {
    'Alfa': 4,
    'Beta': 2,
    'Senior': 1,
  };

  const interactionSchedules: { [key: string]: number[] } = {
    'PDI': [0, 6], // Janeiro e Julho
    '1:1': [2, 5, 8, 11], // Março, Junho, Setembro, Dezembro
    'Índice de Risco': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Todos os meses
  };

  // Frequência de N2 Individual para diretores (baseado no líder)
  const leaderMeetingFrequencies: { [key: string]: { frequency: 'semanal' | 'quinzenal' | 'mensal'; requiredPerMonth: number } } = {
    // Semanal (4 por mês)
    'Samuel Leite': { frequency: 'semanal', requiredPerMonth: 4 },
    'Samuel Coelho Leite': { frequency: 'semanal', requiredPerMonth: 4 },
    'Ivan Paes': { frequency: 'semanal', requiredPerMonth: 4 },
    'Mateus Galhardo': { frequency: 'semanal', requiredPerMonth: 4 },
    'Rodrigo Alcantara': { frequency: 'semanal', requiredPerMonth: 4 },
    // Quinzenal (2 por mês)
    'Thais Andrade': { frequency: 'quinzenal', requiredPerMonth: 2 },
    'Rui Fontoura': { frequency: 'quinzenal', requiredPerMonth: 2 },
    'Fabiana Fracalossi': { frequency: 'quinzenal', requiredPerMonth: 2 },
    // Mensal (1 por mês)
    'Fernando Guimaraes': { frequency: 'mensal', requiredPerMonth: 1 },
    'Flavio Bicalho': { frequency: 'mensal', requiredPerMonth: 1 },
    'Jaqueline Reis': { frequency: 'mensal', requiredPerMonth: 1 },
    'Mauricio': { frequency: 'mensal', requiredPerMonth: 1 },
    'Victor Arcuri': { frequency: 'mensal', requiredPerMonth: 1 },
    'Sarita': { frequency: 'mensal', requiredPerMonth: 1 },
  };

  const getLeaderN2Frequency = (leaderName: string): number => {
    if (!leaderName) {
      return 1; // Padrão: 1 por mês
    }
    
    // Normalizar nomes para comparação (remover acentos e converter para minúsculas)
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const normalizedLeaderName = normalize(leaderName);
    
    // Busca exata primeiro (case-insensitive)
    const exactMatch = Object.keys(leaderMeetingFrequencies).find(key => 
      normalize(key) === normalizedLeaderName
    );
    if (exactMatch) {
      return leaderMeetingFrequencies[exactMatch].requiredPerMonth;
    }
    
    // Busca por primeiro e último nome
    const leaderNameParts = normalizedLeaderName.split(/\s+/).filter(p => p.length > 0);
    if (leaderNameParts.length >= 2) {
      const leaderFirstName = leaderNameParts[0];
      const leaderLastName = leaderNameParts[leaderNameParts.length - 1];
      
      const found = Object.keys(leaderMeetingFrequencies).find(key => {
        const normalizedKey = normalize(key);
        const keyParts = normalizedKey.split(/\s+/).filter(p => p.length > 0);
        
        if (keyParts.length >= 2) {
          const keyFirstName = keyParts[0];
          const keyLastName = keyParts[keyParts.length - 1];
          
          // Verifica se primeiro e último nome coincidem
          if (leaderFirstName === keyFirstName && leaderLastName === keyLastName) {
            return true;
          }
        }
        
        // Fallback: busca por substring
        return normalizedLeaderName.includes(normalizedKey) || normalizedKey.includes(normalizedLeaderName);
      });
      
      if (found) {
        return leaderMeetingFrequencies[found].requiredPerMonth;
      }
    }
    
    // Para nomes com apenas uma palavra, busca exata
    if (leaderNameParts.length === 1) {
      const found = Object.keys(leaderMeetingFrequencies).find(key => 
        normalize(key) === normalizedLeaderName || normalize(key).split(/\s+/)[0] === normalizedLeaderName
      );
      if (found) {
        return leaderMeetingFrequencies[found].requiredPerMonth;
      }
    }
    
    // Default: mensal (1 por mês)
    return 1;
  };

  // Filtros e ordenação
  const initialFilters = useMemo(() => ({
    name: new Set<string>(),
    position: new Set<string>(),
    axis: new Set<string>(),
    area: new Set<string>(),
    segment: new Set<string>(),
    leader: new Set<string>(),
    city: new Set<string>(),
    role: new Set<string>(),
  }), []);

  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);
  const currentEmployee = useMemo(
    () =>
      employees?.find(
        (employee) =>
          employee.email === user?.email &&
          !(employee as any)._isDeleted
      ),
    [employees, user?.email]
  );
  const canAccessMetrics = Boolean(
    isConfigAdmin ||
      currentEmployee?.isAdmin ||
      currentEmployee?.isDirector ||
      currentEmployee?.role === "Diretor"
  );
  // #region agent log
  typeof window!=='undefined'&&isMetricsOnlyMode&&fetch('http://127.0.0.1:7319/ingest/47f83980-17ff-478b-92ce-f77a99eb0a35',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e80b'},body:JSON.stringify({sessionId:'96e80b',location:'admin/page.tsx:308',message:'[HYP C] canAccessMetrics calc',data:{canAccessMetrics,isConfigAdmin,empIsAdmin:currentEmployee?.isAdmin,empIsDirector:currentEmployee?.isDirector,empRole:currentEmployee?.role,userEmail:user?.email},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // Collection de Projetos
  const projectsCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "projects") : null),
    [firestore, user]
  );
  
  const { data: projects, isLoading: areProjectsLoading } = useCollection<Project>(projectsCollection);

  // Carregar Custom Claim isAdmin na montagem
  useEffect(() => {
    let mounted = true;
    const loadClaim = async () => {
      if (!user) {
        setHasAdminClaim(false);
        return;
      }
      try {
        const idTokenResult = await user.getIdTokenResult(true); // força refresh
        if (mounted) setHasAdminClaim(idTokenResult.claims.isAdmin === true);
      } catch (e) {
        console.error('Erro ao verificar custom claim isAdmin:', e);
        if (mounted) setHasAdminClaim(false);
      }
    };
    loadClaim();
    return () => { mounted = false; };
  }, [user]);

  // ========================================
  // INTERFACES E FUNÇÕES DE CÁLCULO DE HISTÓRICO
  // ========================================
  interface MonthlyHistory {
    month: string; // "2024-01"
    monthLabel: string; // "Jan/2024"
    weightedAverage: number;
    totalInteractions: number;
    participants: number;
  }

  interface WeeklyProgress {
    employeeId: string;
    employeeName: string;
    role: 'Líder' | 'Diretor';
    currentWeek: number; // 1-4
    monthlyRequired: number;
    weeklyRequired: number; // monthlyRequired / 4
    expectedAccumulated: number; // Esperado na semana (weeklyRequired)
    completedAccumulated: number; // Realizado na semana
    completedMonthly: number; // Total realizado no mês inteiro
    percentage: number; // (completedWeekly / weeklyRequired) * 100
    status: 'excellent' | 'on-track' | 'behind';
  }

  interface WeeklyProgressSummary {
    leaders: WeeklyProgress[];
    directors: WeeklyProgress[];
    leadersSummary: {
      excellent: number;
      onTrack: number;
      behind: number;
      total: number;
    };
    directorsSummary: {
      excellent: number;
      onTrack: number;
      behind: number;
      total: number;
    };
  }

  interface RiskHistoryPoint {
    month: string;
    count: number;
    year: number;
    monthIndex: number;
  }

  interface HighRiskAdvisor {
    id: string;
    name: string;
    riskScore: number;
    lastAssessmentDate: string;
  }

  // Definir calculateMonthlyHistory depois das constantes
  const calculateMonthlyHistory = useCallback(async (
    firestore: any,
    employees: Employee[],
    type: 'leaders' | 'directors'
  ): Promise<MonthlyHistory[]> => {
    if (!firestore || !employees || employees.length === 0) {
      return [];
    }

    try {
      // Buscar todas as interações desde o início
      const allInteractionsMap = new Map<string, Interaction[]>();
      const allPdiActionsMap = new Map<string, PDIAction[]>();

      // Determinar quais IDs buscar baseado no tipo
      let idsToFetch: string[] = [];
      if (type === 'leaders') {
        // Mesmo padrão do ranking: calcular todos os líderes, depois filtrar por axis
        const allLeaders = employees.filter(e => 
          !(e as any)._isDeleted && 
          e.role === 'Líder' && 
          !e.isDirector
        );
        const leadersList = allLeaders.filter(leader => leader.axis === 'Comercial');
        idsToFetch = leadersList.flatMap(leader => {
          const teamMembers = employees.filter(e => 
            e.leaderId === leader.id && 
            e.isUnderManagement && 
            !(e as any)._isDeleted
          );
          return [leader.id, ...teamMembers.map(m => m.id)];
        });
      } else {
        const directorsList = employees.filter(e => 
          !(e as any)._isDeleted && 
          e.isDirector &&
          e.name?.toLowerCase().includes('gabriel') &&
          e.name?.toLowerCase().includes('ayres')
        );
        const leadersUnderDirector = employees.filter(e => 
          !(e as any)._isDeleted && 
          e.role === 'Líder' &&
          !e.isDirector
        );
        idsToFetch = [...directorsList.map(d => d.id), ...leadersUnderDirector.map(l => l.id)];
      }

      const uniqueIds = [...new Set(idsToFetch)];

      // Carregar todas as interações e PDI actions
      await Promise.all(uniqueIds.map(async (id) => {
        try {
          const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
          const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));
          
          const [interactionsSnap, pdiSnap] = await Promise.all([
            getDocs(interactionsQuery),
            getDocs(pdiActionsQuery)
          ]);

          const interactions = interactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Interaction));
          const pdiActions = pdiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PDIAction));

          if (interactions.length > 0) {
            allInteractionsMap.set(id, interactions);
          }
          if (pdiActions.length > 0) {
            allPdiActionsMap.set(id, pdiActions);
          }
        } catch (error) {
          console.error(`[History] Erro ao carregar dados de ${id}:`, error);
        }
      }));

      // Encontrar a primeira data (início do sistema)
      let earliestDate: Date | null = null;
      allInteractionsMap.forEach(interactions => {
        interactions.forEach(interaction => {
          const date = parseISO(interaction.date);
          if (!earliestDate || date < earliestDate) {
            earliestDate = date;
          }
        });
      });

      if (!earliestDate) {
        return [];
      }

      // Agrupar por mês e calcular média ponderada para cada mês
      const monthlyData = new Map<string, {
        metrics: Array<{ adherenceScore: number; requiredCount: number; completedCount: number }>;
        totalInteractions: number;
        participants: Set<string>;
      }>();

      // Iterar mês a mês desde o início até hoje
      const startMonth = startOfMonth(earliestDate);
      const endMonth = endOfMonth(new Date());
      let currentMonth: Date = startMonth;

      while (currentMonth.getTime() <= endMonth.getTime()) {
        const monthKey = format(currentMonth, 'yyyy-MM');
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const range = { start: monthStart, end: monthEnd };

        const monthMetrics: Array<{ adherenceScore: number; requiredCount: number; completedCount: number }> = [];
        const monthParticipants = new Set<string>();
        let monthTotalInteractions = 0;

        if (type === 'leaders') {
          const leadersList = employees.filter(e => 
            !(e as any)._isDeleted && 
            e.role === 'Líder' && 
            !e.isDirector
          );

          leadersList.forEach(leader => {
            const teamMembers = employees.filter(e => 
              e.leaderId === leader.id && 
              e.isUnderManagement && 
              !(e as any)._isDeleted
            );

            if (teamMembers.length === 0) return;

            let totalCompleted = 0;
            let totalRequired = 0;

            teamMembers.forEach(member => {
              const memberInteractions = allInteractionsMap.get(member.id) || [];
              const memberPdiActions = allPdiActionsMap.get(member.id) || [];

              const fromMonth = getMonth(range.start);
              const fromYear = getYear(range.start);
              const toMonth = getMonth(range.end);
              const toYear = getYear(range.end);
              const monthsInRange = 1; // Um mês por vez

              // N3 Individual
              const n3Segment = member.segment as string | undefined;
              if (n3Segment && n3IndividualSchedule[n3Segment]) {
                const required = n3IndividualSchedule[n3Segment] * monthsInRange;
                const completed = memberInteractions.filter(i => 
                  i.type === 'N3 Individual' && isWithinInterval(parseISO(i.date), range)
                ).length;
                totalRequired += required;
                totalCompleted += Math.min(completed, required);
              }

              // Índice de Risco
              const riscoSchedule = interactionSchedules['Índice de Risco'] || [];
              const requiredRiscoMonths = riscoSchedule.filter(month => {
                for (let y = fromYear; y <= toYear; y++) {
                  const startM = (y === fromYear) ? fromMonth : 0;
                  const endM = (y === toYear) ? toMonth : 11;
                  if (month >= startM && month <= endM) return true;
                }
                return false;
              });
              totalRequired += requiredRiscoMonths.length;

              const executedRiscoMonths = new Set<number>();
              memberInteractions.forEach(i => {
                const intDate = parseISO(i.date);
                if (i.type === 'Índice de Risco' && isWithinInterval(intDate, range) && requiredRiscoMonths.includes(getMonth(intDate))) {
                  executedRiscoMonths.add(getMonth(intDate));
                }
              });
              totalCompleted += executedRiscoMonths.size;

              // 1:1
              const oneOnOneSchedule = interactionSchedules['1:1'] || [];
              const requiredOneOnOneMonths = oneOnOneSchedule.filter(month => {
                for (let y = fromYear; y <= toYear; y++) {
                  const startM = (y === fromYear) ? fromMonth : 0;
                  const endM = (y === toYear) ? toMonth : 11;
                  if (month >= startM && month <= endM) return true;
                }
                return false;
              });
              totalRequired += requiredOneOnOneMonths.length;

              const executedOneOnOneMonths = new Set<number>();
              memberInteractions.forEach(i => {
                const intDate = parseISO(i.date);
                if (i.type === '1:1' && isWithinInterval(intDate, range) && requiredOneOnOneMonths.includes(getMonth(intDate))) {
                  executedOneOnOneMonths.add(getMonth(intDate));
                }
              });
              totalCompleted += executedOneOnOneMonths.size;

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
              totalRequired += requiredPdiMonths.length;

              const executedPdiMonths = new Set<number>();
              memberPdiActions.forEach(action => {
                const actionDate = parseISO(action.startDate);
                if (isWithinInterval(actionDate, range) && requiredPdiMonths.includes(getMonth(actionDate))) {
                  executedPdiMonths.add(getMonth(actionDate));
                }
              });
              totalCompleted += executedPdiMonths.size;

              // Contar interações
              monthTotalInteractions += memberInteractions.filter(i => 
                isWithinInterval(parseISO(i.date), range)
              ).length;
            });

            const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
            
            if (totalRequired > 0) {
              monthMetrics.push({
                adherenceScore: Math.round(adherenceScore * 10) / 10,
                requiredCount: totalRequired,
                completedCount: totalCompleted
              });
              monthParticipants.add(leader.id);
            }
          });
        } else {
          // Diretores
          const directorsList = employees.filter(e => 
            !(e as any)._isDeleted && 
            e.isDirector &&
            e.name?.toLowerCase().includes('gabriel')
          );

          directorsList.forEach(director => {
            const leadersUnderDirector = employees.filter(e => 
              !(e as any)._isDeleted && 
              e.role === 'Líder' &&
              !e.isDirector
            );

            if (leadersUnderDirector.length === 0) return;

            let totalCompleted = 0;
            let totalRequired = 0;

            leadersUnderDirector.forEach(leader => {
              const leaderInteractions = allInteractionsMap.get(leader.id) || [];
              const monthsInRange = 1;

              // N2 Individual
              const n2RequiredForLeader = getLeaderN2Frequency(leader.name) * monthsInRange;
              totalRequired += n2RequiredForLeader;

              const n2Count = leaderInteractions.filter(i => 
                i.type === 'N2 Individual' && isWithinInterval(parseISO(i.date), range)
              ).length;
              totalCompleted += Math.min(n2Count, n2RequiredForLeader);

              // Índice de Qualidade
              const qualidadeRequiredForLeader = monthsInRange;
              totalRequired += qualidadeRequiredForLeader;

              const qualidadeMonths = new Set<number>();
              leaderInteractions.forEach(i => {
                if (i.type === 'Índice de Qualidade' && isWithinInterval(parseISO(i.date), range)) {
                  qualidadeMonths.add(getMonth(parseISO(i.date)));
                }
              });
              totalCompleted += Math.min(qualidadeMonths.size, qualidadeRequiredForLeader);

              // Contar interações
              monthTotalInteractions += leaderInteractions.filter(i => 
                isWithinInterval(parseISO(i.date), range) &&
                (i.type === 'N2 Individual' || i.type === 'Índice de Qualidade' || i.type === 'Feedback')
              ).length;
            });

            const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
            
            if (totalRequired > 0) {
              monthMetrics.push({
                adherenceScore: Math.round(adherenceScore * 10) / 10,
                requiredCount: totalRequired,
                completedCount: totalCompleted
              });
              monthParticipants.add(director.id);
            }
          });
        }

        // Calcular média ponderada do mês
        let weightedSum = 0;
        let totalWeight = 0;
        monthMetrics.forEach(metric => {
          weightedSum += metric.adherenceScore * metric.requiredCount;
          totalWeight += metric.requiredCount;
        });

        const weightedAverage = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

        monthlyData.set(monthKey, {
          metrics: monthMetrics,
          totalInteractions: monthTotalInteractions,
          participants: monthParticipants
        });

        // Avançar para o próximo mês
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      }

      // Converter para array ordenado
      const history: MonthlyHistory[] = Array.from(monthlyData.entries())
        .map(([monthKey, data]) => {
          let weightedSum = 0;
          let totalWeight = 0;
          data.metrics.forEach(metric => {
            weightedSum += metric.adherenceScore * metric.requiredCount;
            totalWeight += metric.requiredCount;
          });
          const weightedAverage = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

          return {
            month: monthKey,
            monthLabel: format(parseISO(`${monthKey}-01`), 'MMM/yyyy', { locale: ptBR }),
            weightedAverage,
            totalInteractions: data.totalInteractions,
            participants: data.participants.size
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      return history;
    } catch (error) {
      console.error('[History] Erro ao calcular histórico:', error);
      return [];
    }
  }, [employees]);

  const calculateRiskMetrics = useCallback(async (
    firestore: any,
    employees: Employee[]
  ) => {
    if (!firestore || !employees || employees.length === 0) {
      return null;
    }

    try {
      // 1. Filtrar Assessores (Colaborador + Comercial)
      const advisors = employees.filter(e => 
        !(e as any)._isDeleted && 
        e.role === 'Colaborador' && 
        e.axis === 'Comercial'
      );

      // 2. Buscar interações de Índice de Risco para cada assessor
      const interactionsMap = new Map<string, Interaction[]>();
      
      await Promise.all(advisors.map(async (advisor) => {
        try {
          const interactionsQuery = query(collection(firestore, "employees", advisor.id, "interactions"));
          const snapshot = await getDocs(interactionsQuery);
          
          const riskInteractions = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Interaction))
            .filter(i => i.type === 'Índice de Risco' && i.riskScore !== undefined);
          
          if (riskInteractions.length > 0) {
            interactionsMap.set(advisor.id, riskInteractions);
          }
        } catch (error) {
          console.error(`Erro ao buscar risco para ${advisor.name}:`, error);
        }
      }));

      // Se não houver dados, retornar vazio
      if (interactionsMap.size === 0) {
        return { history: [], currentHighRisk: [] };
      }

      // Encontrar a data mais antiga para iniciar o histórico
      let earliestDate: Date | null = null;
      interactionsMap.forEach(interactions => {
        interactions.forEach(i => {
          const date = parseISO(i.date);
          if (!earliestDate || date < earliestDate) {
            earliestDate = date;
          }
        });
      });

      if (!earliestDate) earliestDate = new Date();

      // 3. Calcular histórico mensal
      const history: RiskHistoryPoint[] = [];
      const now = new Date();
      const start = startOfMonth(earliestDate);
      const end = endOfMonth(now);
      
      let currentIter = start;
      
      while (currentIter <= end) {
        const monthEnd = endOfMonth(currentIter);
        let highRiskCount = 0;

        // Para este mês, verificar status de cada assessor
        advisors.forEach(advisor => {
          const interactions = interactionsMap.get(advisor.id) || [];
          
          // Pegar a última avaliação até o fim deste mês
          const relevantInteractions = interactions
            .filter(i => parseISO(i.date) <= monthEnd)
            .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
          
          if (relevantInteractions.length > 0) {
            const lastScore = relevantInteractions[0].riskScore || 0;
            if (lastScore > 5) {
              highRiskCount++;
            }
          }
        });

        history.push({
          month: format(currentIter, 'MMM/yy', { locale: ptBR }),
          count: highRiskCount,
          year: getYear(currentIter),
          monthIndex: getMonth(currentIter)
        });

        currentIter = new Date(currentIter.getFullYear(), currentIter.getMonth() + 1, 1);
      }

      // 4. Calcular status atual (baseado na última interação de todas)
      const currentHighRisk: HighRiskAdvisor[] = [];
      
      advisors.forEach(advisor => {
        const interactions = interactionsMap.get(advisor.id) || [];
        
        // Pegar a última avaliação absoluta
        const sortedInteractions = interactions
          .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
        
        if (sortedInteractions.length > 0) {
          const lastInteraction = sortedInteractions[0];
          const lastScore = lastInteraction.riskScore || 0;
          
          if (lastScore > 5) {
            currentHighRisk.push({
              id: advisor.id,
              name: advisor.name,
              riskScore: lastScore,
              lastAssessmentDate: lastInteraction.date
            });
          }
        }
      });

      // Ordenar por score decrescente
      currentHighRisk.sort((a, b) => b.riskScore - a.riskScore);

      return { history, currentHighRisk };

    } catch (error) {
      console.error("Erro ao calcular métricas de risco:", error);
      return null;
    }
  }, []);

  // ========================================
  // CARREGAR DADOS DE MÉTRICAS (quando aba ativa)
  // ========================================
  const loadMetricsData = useCallback(async () => {
    // #region agent log
    typeof window!=='undefined'&&fetch('http://127.0.0.1:7319/ingest/47f83980-17ff-478b-92ce-f77a99eb0a35',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e80b'},body:JSON.stringify({sessionId:'96e80b',location:'admin/page.tsx:loadMetricsData',message:'[HYP D] loadMetricsData chamado',data:{hasFirestore:!!firestore,hasEmployees:!!employees,activeTab,willProceed:!(!firestore||!employees||activeTab!=='metrics')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!firestore || !employees || activeTab !== 'metrics') return;
    
    setMetricsLoading(true);
    console.time('📊 [METRICS] Carregamento de dados');
    
    // Pegar todos os colaboradores sob gestão
    const allManagedEmployeeIds = employees
      .filter(e => e.isUnderManagement && !(e as any)._isDeleted)
      .map(e => e.id);
    
    // Também pegar os líderes para interações de diretores
    const allLeaderIds = employees
      .filter(e => (e.role === 'Líder' || e.role === 'Diretor') && !(e as any)._isDeleted)
      .map(e => e.id);
    
    const allIdsToFetch = [...new Set([...allManagedEmployeeIds, ...allLeaderIds])];
    
    console.log(`📊 [METRICS] Carregando dados de ${allIdsToFetch.length} pessoas...`);
    
    try {
      const allPromises = allIdsToFetch.map(async (id) => {
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

      const results = await Promise.all(allPromises);

      const interactionsMap = new Map<string, Interaction[]>();
      const pdiMap = new Map<string, PDIAction[]>();

      results.forEach(({ id, interactions, pdiActions }) => {
        interactionsMap.set(id, interactions);
        pdiMap.set(id, pdiActions);
      });
      
      setMetricsInteractions(interactionsMap);
      setMetricsPdiActions(pdiMap);
      
      console.timeEnd('📊 [METRICS] Carregamento de dados');
      console.log(`✅ [METRICS] ${results.length} pessoas carregadas com sucesso`);

      // Carregar histórico mensal
      setHistoryLoading(true);
      console.time('📊 [HISTORY] Carregamento de histórico');
      try {
        const [leadersHist, directorsHist] = await Promise.all([
          calculateMonthlyHistory(firestore, employees, 'leaders'),
          calculateMonthlyHistory(firestore, employees, 'directors')
        ]);
        setLeadersHistory(leadersHist);
        setDirectorsHistory(directorsHist);
        console.timeEnd('📊 [HISTORY] Carregamento de histórico');
        console.log(`✅ [HISTORY] Histórico carregado: ${leadersHist.length} meses (líderes), ${directorsHist.length} meses (diretores)`);
      } catch (error) {
        console.error('❌ [HISTORY] Erro ao carregar histórico:', error);
      } finally {
        setHistoryLoading(false);
      }

      // Carregar progresso semanal
      setWeeklyProgressLoading(true);
      console.time('📊 [WEEKLY] Carregamento de progresso semanal');
      try {
        const currentMonth = new Date();
        const [leadersProgress, directorsProgress] = await Promise.all([
          calculateWeeklyProgress(firestore, employees, 'leaders', currentMonth),
          calculateWeeklyProgress(firestore, employees, 'directors', currentMonth)
        ]);
        
        const leadersSummary = {
          excellent: leadersProgress.filter(p => p.status === 'excellent').length,
          onTrack: leadersProgress.filter(p => p.status === 'on-track').length,
          behind: leadersProgress.filter(p => p.status === 'behind').length,
          total: leadersProgress.length
        };
        
        const directorsSummary = {
          excellent: directorsProgress.filter(p => p.status === 'excellent').length,
          onTrack: directorsProgress.filter(p => p.status === 'on-track').length,
          behind: directorsProgress.filter(p => p.status === 'behind').length,
          total: directorsProgress.length
        };
        
        setWeeklyProgress({
          leaders: leadersProgress,
          directors: directorsProgress,
          leadersSummary,
          directorsSummary
        });
        console.timeEnd('📊 [WEEKLY] Carregamento de progresso semanal');
        console.log(`✅ [WEEKLY] Progresso semanal carregado: ${leadersProgress.length} líderes, ${directorsProgress.length} diretores`);
      } catch (error) {
        console.error('❌ [WEEKLY] Erro ao carregar progresso semanal:', error);
      } finally {
        setWeeklyProgressLoading(false);
      }
      // Carregar métricas de risco
      setRiskMetricsLoading(true);
      console.time('📊 [RISK] Carregamento de risco');
      try {
        const riskData = await calculateRiskMetrics(firestore, employees);
        setRiskMetrics(riskData);
        console.timeEnd('📊 [RISK] Carregamento de risco');
      } catch (error) {
        console.error('❌ [RISK] Erro ao carregar risco:', error);
      } finally {
        setRiskMetricsLoading(false);
      }

    } catch (error) {
      console.error('❌ [METRICS] Erro ao carregar dados:', error);
    } finally {
      setMetricsLoading(false);
    }
  }, [firestore, employees, activeTab, calculateMonthlyHistory, calculateRiskMetrics]);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7319/ingest/47f83980-17ff-478b-92ce-f77a99eb0a35',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e80b'},body:JSON.stringify({sessionId:'96e80b',location:'admin/page.tsx:useEffect-metrics',message:'[HYP D] useEffect metrics disparado',data:{activeTab,hasEmployees:!!employees,metricsInteractionsSize:metricsInteractions.size,willCall:activeTab==='metrics'&&!!employees&&metricsInteractions.size===0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (activeTab === 'metrics' && employees && metricsInteractions.size === 0) {
      loadMetricsData();
    }
  }, [activeTab, employees, metricsInteractions.size, loadMetricsData]);
  // NOTE: useEffect já roda somente no cliente — sem guard typeof window necessário

  const checkCustomClaim = async()=>{
    if (!user) {
      console.log ('User not logged in');
      return;
    }
  
    try{
      const idTokenResult = await user.getIdTokenResult();
      console.log('isAdmin: ', idTokenResult.claims.isAdmin);
      console.log('Custom Claims:', idTokenResult.claims);
  
  
      toast({
        title: 'Custom Claims',
        description: `isAdmin: ${idTokenResult.claims.isAdmin}`,
      });
    } catch (error) {
      console.error('Erro ao verificar claim:', error);
    }
  };

  const checkAdminClaims = async () => {
    if (!firebaseApp) {
      toast({ variant: "destructive", title: "Erro", description: "Firebase não inicializado." });
      return;
    }

    try {
      const functions = getFunctions(firebaseApp, 'us-central1');
      const listAdminClaims = httpsCallable(functions, 'listAdminClaims');
      const result: any = await listAdminClaims({});

      console.log('Usuários com Custom Claim isAdmin:', result.data);
      const adminEmails = result.data.admins.map((a: any) => a.email).filter(Boolean).join(', ') || 'Nenhum';
      
      toast({
        title: `Encontrados ${result.data.count} admin(s)`,
        description: adminEmails,
        duration: 10000,
      });
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao verificar claims",
      });
    }
  };

  const handleRoleChange = async (employeeId: string, newRole: Role) => {
    if (!firestore) return;
    const docRef = doc(firestore, "employees", employeeId);
    try {
      const updates: { role: Role, isDirector?: boolean } = { role: newRole };
      if (newRole === 'Diretor') {
        updates.isDirector = true;
      } else if (employees?.find(e => e.id === employeeId)?.isDirector) {
        updates.isDirector = false;
      }

      await updateDoc(docRef, updates);
    } catch (error) {
       console.error("Error updating role:", error);
    }
  };

  useEffect(() => {
    if (!employees) return;
    setLoadingReports(false);
  }, [employees]);
  
    const { leaders, directors, admins, uniqueValues, employeesWithoutDiagnosis } = useMemo(() => {
        if (!employees) return { leaders: [], directors: [], admins: [], uniqueValues: { names: [], positions: [], axes: [], areas: [], segments: [], leaders: [], cities: [], roles: [] }, employeesWithoutDiagnosis: [] };
        
        // Otimização: um único loop ao invés de 8 loops separados
        const namesSet = new Set<string>();
        const positionsSet = new Set<string>();
        const axesSet = new Set<string>();
        const areasSet = new Set<string>();
        const segmentsSet = new Set<string>();
        const leaderNamesSet = new Set<string>();
        const citiesSet = new Set<string>();
        const roleValuesSet = new Set<Role>();
        
        for (const e of employees) {
          if (e.name) namesSet.add(e.name);
          if (e.position) positionsSet.add(e.position);
          if (e.axis) axesSet.add(e.axis);
          if (e.area) areasSet.add(e.area);
          if (e.segment) segmentsSet.add(e.segment);
          if (e.leader) leaderNamesSet.add(e.leader);
          if (e.city) citiesSet.add(e.city);
          if (e.role) roleValuesSet.add(e.role);
        }
        
        const names = [...namesSet].sort() as string[];
        const positions = [...positionsSet].sort() as string[];
        const axes = [...axesSet].sort() as string[];
        const areas = [...areasSet].sort() as string[];
        const segments = [...segmentsSet].sort() as string[];
        const leaderNames = [...leaderNamesSet].sort() as string[];
        const cities = [...citiesSet].sort() as string[];
        const roleValues = [...roleValuesSet].sort() as Role[];

        const leaders = employees.filter(e => !(e as any)._isDeleted && (e.role === 'Líder' || e.role === 'Diretor'));
        const directors = employees.filter(e => !(e as any)._isDeleted && e.isDirector).sort((a,b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });
        
        const adminsFromDb = employees.filter(e => !(e as any)._isDeleted && e.isAdmin);
        const adminMap = new Map(adminsFromDb.map(a => [a.email, a]));

        adminEmails.forEach(email => {
            if (!adminMap.has(email)) {
                const employeeData = employees.find(e => e.email === email);
                if (employeeData) {
                    adminMap.set(email, { ...employeeData, isAdmin: true });
                } else {
                     adminMap.set(email, {
                        id: email,
                        id3a: email,
                        name: email.split('@')[0],
                        email: email,
                        isAdmin: true,
                     } as Employee);
                }
            }
        });
        
        const admins = Array.from(adminMap.values()).sort((a,b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });


        const employeesWithoutDiagnosis = employees.filter(emp => !(emp as any)._isDeleted && emp.isUnderManagement && !(emp as any).diagnosis);


        return { 
          leaders,
          directors,
          admins,
          uniqueValues: { names, positions, axes, areas, segments, leaders: leaderNames, cities, roles: roleValues },
          employeesWithoutDiagnosis,
        };
    }, [employees]);

    // ========================================
    // CÁLCULOS DE MÉTRICAS PARA LÍDERES
    // ========================================
    interface LeaderMetrics {
      leader: Employee;
      teamSize: number;
      totalInteractionsWeek: number;
      totalInteractionsMonth: number;
      adherenceScore: number;
      completedCount: number;
      requiredCount: number;
      byType: {
        n3: { completed: number; required: number; adherence: number };
        risco: { completed: number; required: number; adherence: number };
        oneOnOne: { completed: number; required: number; adherence: number };
        pdi: { completed: number; required: number; adherence: number };
        feedback: { completed: number; required: number };
      };
    }

    interface DirectorMetrics {
      director: Employee;
      leadersCount: number;
      totalInteractionsWeek: number;
      totalInteractionsMonth: number;
      adherenceScore: number;
      completedCount: number;
      requiredCount: number;
      byType: {
        n2: { completed: number; required: number; adherence: number };
        qualidade: { completed: number; required: number; adherence: number };
        feedback: { completed: number; required: number };
      };
    }

    const leaderMetrics = useMemo((): LeaderMetrics[] => {
      if (!employees || !metricsDateRange?.from || !metricsDateRange?.to || metricsLoading) {
        return [];
      }

      const range = { start: metricsDateRange.from, end: metricsDateRange.to };
      const fromMonth = getMonth(range.start);
      const fromYear = getYear(range.start);
      const toMonth = getMonth(range.end);
      const toYear = getYear(range.end);
      const monthsInRange = Math.max(1, differenceInMonths(range.end, range.start) + 1);
      const weeksInRange = Math.max(1, differenceInWeeks(range.end, range.start) + 1);

      // Filtrar apenas líderes (não diretores) - mesmo padrão do ranking
      const allLeaders = employees.filter(e => 
        !(e as any)._isDeleted && 
        e.role === 'Líder' && 
        !e.isDirector
      );
      
      // Filtrar por axis (padrão: Comercial, igual ao ranking)
      const leadersList = allLeaders.filter(leader => leader.axis === 'Comercial');

      return leadersList.map(leader => {
        const teamMembers = employees.filter(e => 
          e.leaderId === leader.id && 
          e.isUnderManagement && 
          !(e as any)._isDeleted
        );

        if (teamMembers.length === 0) {
          return {
            leader,
            teamSize: 0,
            totalInteractionsWeek: 0,
            totalInteractionsMonth: 0,
            adherenceScore: 0,
            completedCount: 0,
            requiredCount: 0,
            byType: {
              n3: { completed: 0, required: 0, adherence: 0 },
              risco: { completed: 0, required: 0, adherence: 0 },
              oneOnOne: { completed: 0, required: 0, adherence: 0 },
              pdi: { completed: 0, required: 0, adherence: 0 },
              feedback: { completed: 0, required: 0 },
            },
          };
        }

        let totalCompleted = 0;
        let totalRequired = 0;
        let totalInteractions = 0;

        // Acumuladores por tipo
        let n3Completed = 0, n3Required = 0;
        let riscoCompleted = 0, riscoRequired = 0;
        let oneOnOneCompleted = 0, oneOnOneRequired = 0;
        let pdiCompleted = 0, pdiRequired = 0;
        let feedbackCount = 0;

        teamMembers.forEach(member => {
          const memberInteractions = metricsInteractions.get(member.id) || [];
          const memberPdiActions = metricsPdiActions.get(member.id) || [];

          // Contar todas as interações no período
          const interactionsInRange = memberInteractions.filter(i => 
            isWithinInterval(parseISO(i.date), range)
          );
          totalInteractions += interactionsInRange.length;

          // N3 Individual
          const n3Segment = member.segment as string | undefined;
          if (n3Segment && n3IndividualSchedule[n3Segment]) {
            const required = n3IndividualSchedule[n3Segment] * monthsInRange;
            const completed = memberInteractions.filter(i => 
              i.type === 'N3 Individual' && isWithinInterval(parseISO(i.date), range)
            ).length;
            n3Required += required;
            n3Completed += Math.min(completed, required);
            totalRequired += required;
            totalCompleted += Math.min(completed, required);
          }

          // Índice de Risco (mensal)
          const riscoSchedule = interactionSchedules['Índice de Risco'] || [];
          const requiredRiscoMonths = riscoSchedule.filter(month => {
            for (let y = fromYear; y <= toYear; y++) {
              const startM = (y === fromYear) ? fromMonth : 0;
              const endM = (y === toYear) ? toMonth : 11;
              if (month >= startM && month <= endM) return true;
            }
            return false;
          });
          riscoRequired += requiredRiscoMonths.length;
          totalRequired += requiredRiscoMonths.length;

          const executedRiscoMonths = new Set<number>();
          memberInteractions.forEach(i => {
            const intDate = parseISO(i.date);
            if (i.type === 'Índice de Risco' && isWithinInterval(intDate, range) && requiredRiscoMonths.includes(getMonth(intDate))) {
              executedRiscoMonths.add(getMonth(intDate));
            }
          });
          riscoCompleted += executedRiscoMonths.size;
          totalCompleted += executedRiscoMonths.size;

          // 1:1 (trimestral)
          const oneOnOneSchedule = interactionSchedules['1:1'] || [];
          const requiredOneOnOneMonths = oneOnOneSchedule.filter(month => {
            for (let y = fromYear; y <= toYear; y++) {
              const startM = (y === fromYear) ? fromMonth : 0;
              const endM = (y === toYear) ? toMonth : 11;
              if (month >= startM && month <= endM) return true;
            }
            return false;
          });
          oneOnOneRequired += requiredOneOnOneMonths.length;
          totalRequired += requiredOneOnOneMonths.length;

          const executedOneOnOneMonths = new Set<number>();
          memberInteractions.forEach(i => {
            const intDate = parseISO(i.date);
            if (i.type === '1:1' && isWithinInterval(intDate, range) && requiredOneOnOneMonths.includes(getMonth(intDate))) {
              executedOneOnOneMonths.add(getMonth(intDate));
            }
          });
          oneOnOneCompleted += executedOneOnOneMonths.size;
          totalCompleted += executedOneOnOneMonths.size;

          // PDI (semestral)
          const pdiSchedule = interactionSchedules['PDI'] || [];
          const requiredPdiMonths = pdiSchedule.filter(month => {
            for (let y = fromYear; y <= toYear; y++) {
              const startM = (y === fromYear) ? fromMonth : 0;
              const endM = (y === toYear) ? toMonth : 11;
              if (month >= startM && month <= endM) return true;
            }
            return false;
          });
          pdiRequired += requiredPdiMonths.length;
          totalRequired += requiredPdiMonths.length;

          const executedPdiMonths = new Set<number>();
          memberPdiActions.forEach(action => {
            const actionDate = parseISO(action.startDate);
            if (isWithinInterval(actionDate, range) && requiredPdiMonths.includes(getMonth(actionDate))) {
              executedPdiMonths.add(getMonth(actionDate));
            }
          });
          pdiCompleted += executedPdiMonths.size;
          totalCompleted += executedPdiMonths.size;

          // Feedback (sob demanda - apenas contagem)
          feedbackCount += memberInteractions.filter(i => 
            i.type === 'Feedback' && isWithinInterval(parseISO(i.date), range)
          ).length;
        });

        const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;

        return {
          leader,
          teamSize: teamMembers.length,
          totalInteractionsWeek: Math.round(totalInteractions / weeksInRange * 10) / 10,
          totalInteractionsMonth: Math.round(totalInteractions / monthsInRange * 10) / 10,
          adherenceScore: Math.round(adherenceScore * 10) / 10,
          completedCount: totalCompleted,
          requiredCount: totalRequired,
          byType: {
            n3: { 
              completed: n3Completed, 
              required: n3Required, 
              adherence: n3Required > 0 ? Math.round((n3Completed / n3Required) * 100) : 0 
            },
            risco: { 
              completed: riscoCompleted, 
              required: riscoRequired, 
              adherence: riscoRequired > 0 ? Math.round((riscoCompleted / riscoRequired) * 100) : 0 
            },
            oneOnOne: { 
              completed: oneOnOneCompleted, 
              required: oneOnOneRequired, 
              adherence: oneOnOneRequired > 0 ? Math.round((oneOnOneCompleted / oneOnOneRequired) * 100) : 0 
            },
            pdi: { 
              completed: pdiCompleted, 
              required: pdiRequired, 
              adherence: pdiRequired > 0 ? Math.round((pdiCompleted / pdiRequired) * 100) : 0 
            },
            feedback: { completed: feedbackCount, required: 0 },
          },
        };
      }).sort((a, b) => b.adherenceScore - a.adherenceScore);
    }, [employees, metricsInteractions, metricsPdiActions, metricsDateRange, metricsLoading]);

    // ========================================
    // CÁLCULOS DE MÉTRICAS PARA DIRETORES
    // ========================================
    const directorMetrics = useMemo((): DirectorMetrics[] => {
      if (!employees || !metricsDateRange?.from || !metricsDateRange?.to || metricsLoading) {
        return [];
      }

      const range = { start: metricsDateRange.from, end: metricsDateRange.to };
      const monthsInRange = Math.max(1, differenceInMonths(range.end, range.start) + 1);
      const weeksInRange = Math.max(1, differenceInWeeks(range.end, range.start) + 1);

      // Filtrar diretores - apenas Gabriel Ayres
      const directorsList = employees.filter(e => 
        !(e as any)._isDeleted && 
        e.isDirector &&
        e.name?.toLowerCase().includes('gabriel') &&
        e.name?.toLowerCase().includes('ayres')
      );

      return directorsList.map(director => {
        // Líderes que reportam ao diretor (ou todos se for admin geral)
        const leadersUnderDirector = employees.filter(e => 
          !(e as any)._isDeleted && 
          e.role === 'Líder' &&
          !e.isDirector
        );

        if (leadersUnderDirector.length === 0) {
          return {
            director,
            leadersCount: 0,
            totalInteractionsWeek: 0,
            totalInteractionsMonth: 0,
            adherenceScore: 0,
            completedCount: 0,
            requiredCount: 0,
            byType: {
              n2: { completed: 0, required: 0, adherence: 0 },
              qualidade: { completed: 0, required: 0, adherence: 0 },
              feedback: { completed: 0, required: 0 },
            },
          };
        }

        let totalCompleted = 0;
        let totalRequired = 0;
        let totalInteractions = 0;

        let n2Completed = 0, n2Required = 0;
        let qualidadeCompleted = 0, qualidadeRequired = 0;
        let feedbackCount = 0;

        leadersUnderDirector.forEach(leader => {
          const leaderInteractions = metricsInteractions.get(leader.id) || [];

          // Contar interações do diretor com este líder
          const interactionsInRange = leaderInteractions.filter(i => 
            isWithinInterval(parseISO(i.date), range) &&
            (i.type === 'N2 Individual' || i.type === 'Índice de Qualidade' || i.type === 'Feedback')
          );
          totalInteractions += interactionsInRange.length;

          // N2 Individual (baseado na frequência)
          const n2RequiredForLeader = getLeaderN2Frequency(leader.name) * monthsInRange;
          n2Required += n2RequiredForLeader;
          totalRequired += n2RequiredForLeader;

          const n2Count = leaderInteractions.filter(i => 
            i.type === 'N2 Individual' && isWithinInterval(parseISO(i.date), range)
          ).length;
          n2Completed += Math.min(n2Count, n2RequiredForLeader);
          totalCompleted += Math.min(n2Count, n2RequiredForLeader);

          // Índice de Qualidade (1 por mês por líder)
          const qualidadeRequiredForLeader = monthsInRange;
          qualidadeRequired += qualidadeRequiredForLeader;
          totalRequired += qualidadeRequiredForLeader;

          const qualidadeMonths = new Set<number>();
          leaderInteractions.forEach(i => {
            if (i.type === 'Índice de Qualidade' && isWithinInterval(parseISO(i.date), range)) {
              qualidadeMonths.add(getMonth(parseISO(i.date)));
            }
          });
          qualidadeCompleted += Math.min(qualidadeMonths.size, qualidadeRequiredForLeader);
          totalCompleted += Math.min(qualidadeMonths.size, qualidadeRequiredForLeader);

          // Feedback (sob demanda)
          feedbackCount += leaderInteractions.filter(i => 
            i.type === 'Feedback' && isWithinInterval(parseISO(i.date), range)
          ).length;
        });

        const adherenceScore = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;

        return {
          director,
          leadersCount: leadersUnderDirector.length,
          totalInteractionsWeek: Math.round(totalInteractions / weeksInRange * 10) / 10,
          totalInteractionsMonth: Math.round(totalInteractions / monthsInRange * 10) / 10,
          adherenceScore: Math.round(adherenceScore * 10) / 10,
          completedCount: totalCompleted,
          requiredCount: totalRequired,
          byType: {
            n2: { 
              completed: n2Completed, 
              required: n2Required, 
              adherence: n2Required > 0 ? Math.round((n2Completed / n2Required) * 100) : 0 
            },
            qualidade: { 
              completed: qualidadeCompleted, 
              required: qualidadeRequired, 
              adherence: qualidadeRequired > 0 ? Math.round((qualidadeCompleted / qualidadeRequired) * 100) : 0 
            },
            feedback: { completed: feedbackCount, required: 0 },
          },
        };
      }).sort((a, b) => b.adherenceScore - a.adherenceScore);
    }, [employees, metricsInteractions, metricsDateRange, metricsLoading]);

    // Função para obter cor da barra de progresso
    const getProgressColor = (value: number): string => {
      if (value >= METRICS_GOAL) return 'bg-green-500';
      if (value >= 60) return 'bg-yellow-500';
      return 'bg-red-500';
    };

    // Função para obter status em texto
    const getStatusBadge = (value: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
      if (value >= METRICS_GOAL) return { label: 'Em dia', variant: 'default' };
      if (value >= 60) return { label: 'Atenção', variant: 'secondary' };
      return { label: 'Atrasado', variant: 'destructive' };
    };

    // ========================================
    // CÁLCULO DE MÉDIA PONDERADA E HISTÓRICO
    // ========================================
    interface WeightedAverageResult {
      weightedAverage: number; // Média ponderada em %
      totalWeight: number; // Soma dos pesos
      totalParticipants: number; // Número de participantes
    }

    interface MonthlyHistory {
      month: string; // "2024-01"
      monthLabel: string; // "Jan/2024"
      weightedAverage: number;
      totalInteractions: number;
      participants: number;
    }

    interface TrendAnalysis {
      currentAverage: number;
      previousAverage: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      percentageChange: number;
      monthsAnalyzed: number;
    }

    // Calcular média ponderada da aderência
    const calculateWeightedAverage = (
      metrics: LeaderMetrics[] | DirectorMetrics[]
    ): WeightedAverageResult => {
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      metrics.forEach(metric => {
        // Peso = número de interações obrigatórias
        const weight = metric.requiredCount;
        
        if (weight > 0) {
          totalWeightedScore += metric.adherenceScore * weight;
          totalWeight += weight;
        }
      });
      
      return {
        weightedAverage: totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10) / 10 : 0,
        totalWeight,
        totalParticipants: metrics.length
      };
    };


    // Calcular tendência - calcula separadamente para líderes e diretores
    const calculateTrend = (history: MonthlyHistory[], type: 'leaders' | 'directors' = 'leaders'): TrendAnalysis => {
      if (history.length < 2) {
        return {
          currentAverage: history.length > 0 ? history[history.length - 1].weightedAverage : 0,
          previousAverage: 0,
          trend: 'stable',
          percentageChange: 0,
          monthsAnalyzed: history.length
        };
      }

      // Filtrar apenas meses com dados válidos (weightedAverage > 0)
      const validHistory = history.filter(h => h.weightedAverage > 0);
      
      if (validHistory.length < 2) {
        return {
          currentAverage: validHistory.length > 0 ? validHistory[validHistory.length - 1].weightedAverage : 0,
          previousAverage: 0,
          trend: 'stable',
          percentageChange: 0,
          monthsAnalyzed: validHistory.length
        };
      }

      // Comparar último mês válido vs mês anterior válido (mais sensível a mudanças recentes)
      const lastMonth = validHistory[validHistory.length - 1];
      const previousMonth = validHistory[validHistory.length - 2];

      const currentAverage = lastMonth.weightedAverage;
      const previousAverage = previousMonth.weightedAverage;

      const percentageChange = previousAverage > 0
        ? Math.round(((currentAverage - previousAverage) / previousAverage) * 100 * 10) / 10
        : 0;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (Math.abs(percentageChange) > 1) {
        trend = percentageChange > 0 ? 'increasing' : 'decreasing';
      }

      console.log(`📊 [TREND ${type.toUpperCase()}] Último mês: ${currentAverage}%, Mês anterior: ${previousAverage}%, Variação: ${percentageChange}%, Tendência: ${trend}`);

      return {
        currentAverage: Math.round(currentAverage * 10) / 10,
        previousAverage: Math.round(previousAverage * 10) / 10,
        trend,
        percentageChange,
        monthsAnalyzed: validHistory.length
      };
    };

    // Calcular semana atual do mês (1-4)
    const getCurrentWeekOfMonth = (date: Date = new Date()): number => {
      const monthStart = startOfMonth(date);
      const startOfCurrentWeek = startOfWeek(date, { weekStartsOn: 1 }); // Segunda-feira
      const weekNumber = Math.floor(differenceInWeeks(startOfCurrentWeek, monthStart, { roundingMethod: 'floor' }) + 1);
      return Math.min(Math.max(weekNumber, 1), 4); // Garantir entre 1 e 4
    };

    // Calcular interações obrigatórias mensais
    const calculateMonthlyRequiredInteractions = useCallback((
      employee: Employee,
      employees: Employee[],
      type: 'leaders' | 'directors',
      month: Date
    ): number => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const fromMonth = getMonth(monthStart);
      const fromYear = getYear(monthStart);
      const toMonth = getMonth(monthEnd);
      const toYear = getYear(monthEnd);
      
      let totalRequired = 0;
      
      if (type === 'leaders') {
        // Líder: interações com seus colaboradores (mesmo padrão do ranking - não filtra por axis)
        const teamMembers = employees.filter(e => 
          e.leaderId === employee.id && 
          e.isUnderManagement && 
          !(e as any)._isDeleted
        );
        
        teamMembers.forEach(member => {
          // N3 Individual
          const n3Segment = member.segment as keyof typeof n3IndividualSchedule | undefined;
          if (n3Segment && n3IndividualSchedule[n3Segment]) {
            totalRequired += n3IndividualSchedule[n3Segment];
          }
          
          // Índice de Risco (mensal)
          const riscoSchedule = interactionSchedules['Índice de Risco'] || [];
          const requiredRiscoMonths = riscoSchedule.filter(monthNum => {
            for (let y = fromYear; y <= toYear; y++) {
              const startM = (y === fromYear) ? fromMonth : 0;
              const endM = (y === toYear) ? toMonth : 11;
              if (monthNum >= startM && monthNum <= endM) return true;
            }
            return false;
          });
          totalRequired += requiredRiscoMonths.length;
          
          // 1:1 (trimestral)
          const oneOnOneSchedule = interactionSchedules['1:1'] || [];
          const requiredOneOnOneMonths = oneOnOneSchedule.filter(monthNum => {
            for (let y = fromYear; y <= toYear; y++) {
              const startM = (y === fromYear) ? fromMonth : 0;
              const endM = (y === toYear) ? toMonth : 11;
              if (monthNum >= startM && monthNum <= endM) return true;
            }
            return false;
          });
          totalRequired += requiredOneOnOneMonths.length;
          
          // PDI (semestral)
          const pdiSchedule = interactionSchedules['PDI'] || [];
          const requiredPdiMonths = pdiSchedule.filter(monthNum => {
            for (let y = fromYear; y <= toYear; y++) {
              const startM = (y === fromYear) ? fromMonth : 0;
              const endM = (y === toYear) ? toMonth : 11;
              if (monthNum >= startM && monthNum <= endM) return true;
            }
            return false;
          });
          totalRequired += requiredPdiMonths.length;
        });
      } else {
        // Diretor: interações com líderes (mesmo padrão do ranking - filtrar depois por axis)
        // N2 Individual (baseado na frequência de cada líder)
        const allLeaders = employees.filter(e => 
          !(e as any)._isDeleted && 
          e.role === 'Líder' && 
          !e.isDirector
        );
        const leadersList = allLeaders.filter(leader => leader.axis === 'Comercial');
        
        leadersList.forEach(leader => {
          // Usar getLeaderN2Frequency
          const freq = getLeaderN2Frequency(leader.name || '');
          totalRequired += freq;
          
          // Índice de Qualidade (1 por mês por líder)
          totalRequired += 1;
        });
        
        // Ações Diretor (2 por mês)
        totalRequired += 2;
      }
      
      return totalRequired;
    }, []);

    // Calcular progresso semanal
    const calculateWeeklyProgress = useCallback(async (
      firestore: any,
      employees: Employee[],
      type: 'leaders' | 'directors',
      currentMonth: Date = new Date()
    ): Promise<WeeklyProgress[]> => {
      const currentWeek = getCurrentWeekOfMonth(currentMonth);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
      const weeklyRange = { start: weekStart, end: weekEnd }; // Range da semana atual
      const monthlyRange = { start: monthStart, end: monthEnd }; // Range do mês inteiro
      
      // Buscar interações do mês atual
      const allInteractionsMap = new Map<string, Interaction[]>();
      const allPdiActionsMap = new Map<string, PDIAction[]>();
      
      // Mesmo padrão do ranking: filtrar líderes por axis depois
      const allLeaders = employees.filter(e => 
        !(e as any)._isDeleted && 
        e.role === 'Líder' && 
        !e.isDirector
      );
      const leadersFiltered = allLeaders.filter(leader => leader.axis === 'Comercial');
      
      const targetEmployees = type === 'leaders' 
        ? leadersFiltered
        : employees.filter(e => 
            !(e as any)._isDeleted && 
            e.isDirector &&
            e.name?.toLowerCase().includes('gabriel') &&
            e.name?.toLowerCase().includes('ayres')
          );
      
      // Carregar interações e PDI actions
      // Para líderes: precisamos carregar interações dos membros do time também
      // Para diretores: carregamos apenas as interações do diretor
      let idsToFetch: string[] = [];
      
      if (type === 'leaders') {
        // Para cada líder, buscar IDs dos membros do time
        targetEmployees.forEach(leader => {
          const teamMembers = employees.filter(e => 
            e.leaderId === leader.id && 
            e.isUnderManagement && 
            !(e as any)._isDeleted
          );
          idsToFetch.push(leader.id); // Líder também (caso tenha interações próprias)
          teamMembers.forEach(member => {
            idsToFetch.push(member.id);
          });
        });
      } else {
        // Para diretores: carregar interações do diretor (N2 Individual, Índice de Qualidade, Ações Diretor)
        // Essas interações são registradas na subcoleção do diretor
        targetEmployees.forEach(director => {
          idsToFetch.push(director.id);
        });
      }
      
      const uniqueIds = [...new Set(idsToFetch)];
      
      await Promise.all(uniqueIds.map(async (id) => {
        try {
          const interactionsQuery = query(collection(firestore, "employees", id, "interactions"));
          const pdiActionsQuery = query(collection(firestore, "employees", id, "pdiActions"));
          
          const [interactionsSnap, pdiSnap] = await Promise.all([
            getDocs(interactionsQuery),
            getDocs(pdiActionsQuery)
          ]);
          
          const interactions = interactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Interaction));
          const pdiActions = pdiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PDIAction));
          
          // Sempre adicionar ao Map, mesmo se vazio (para garantir que o get retorne array vazio)
          allInteractionsMap.set(id, interactions);
          allPdiActionsMap.set(id, pdiActions);
        } catch (error) {
          console.error(`Erro ao carregar dados de ${id}:`, error);
        }
      }));
      
      const progressList: WeeklyProgress[] = [];
      
      targetEmployees.forEach(employee => {
        const monthlyRequired = calculateMonthlyRequiredInteractions(employee, employees, type, currentMonth);
        const weeklyRequired = Math.ceil(monthlyRequired / 4);
        
        // Calcular realizado na semana atual e realizado mensal (mês inteiro)
        let completedWeekly = 0;
        let completedMonthly = 0;
        
        if (type === 'leaders') {
          // Mesmo padrão do ranking - não filtra membros do time por axis
          const teamMembers = employees.filter(e => 
            e.leaderId === employee.id && 
            e.isUnderManagement && 
            !(e as any)._isDeleted
          );
          
          teamMembers.forEach(member => {
            const memberInteractions = allInteractionsMap.get(member.id) || [];
            const memberPdiActions = allPdiActionsMap.get(member.id) || [];
            
            const monthlyFromMonth = getMonth(monthlyRange.start);
            const monthlyFromYear = getYear(monthlyRange.start);
            const monthlyToMonth = getMonth(monthlyRange.end);
            const monthlyToYear = getYear(monthlyRange.end);
            
            // N3 Individual
            const n3Segment = member.segment as keyof typeof n3IndividualSchedule | undefined;
            if (n3Segment && n3IndividualSchedule[n3Segment]) {
              const completedWeek = memberInteractions.filter(i => 
                i.type === 'N3 Individual' && isWithinInterval(parseISO(i.date), weeklyRange)
              ).length;
              const completedMonth = memberInteractions.filter(i => 
                i.type === 'N3 Individual' && isWithinInterval(parseISO(i.date), monthlyRange)
              ).length;
              // Semanal: limitar ao obrigatório mensal (não semanal, pois pode ter mais de 1 por semana)
              completedWeekly += Math.min(completedWeek, n3IndividualSchedule[n3Segment]);
              // Mensal: contar TODAS as interações N3 do mês inteiro
              completedMonthly += completedMonth;
            }
            
            // Índice de Risco
            const riscoSchedule = interactionSchedules['Índice de Risco'] || [];
            const requiredRiscoMonths = riscoSchedule.filter(monthNum => {
              for (let y = monthlyFromYear; y <= monthlyToYear; y++) {
                const startM = (y === monthlyFromYear) ? monthlyFromMonth : 0;
                const endM = (y === monthlyToYear) ? monthlyToMonth : 11;
                if (monthNum >= startM && monthNum <= endM) return true;
              }
              return false;
            });
            
            // Semanal: contar meses únicos na semana
            const executedRiscoMonthsWeekly = new Set<number>();
            memberInteractions.forEach(i => {
              const intDate = parseISO(i.date);
              if (i.type === 'Índice de Risco' && requiredRiscoMonths.includes(getMonth(intDate))) {
                if (isWithinInterval(intDate, weeklyRange)) {
                  executedRiscoMonthsWeekly.add(getMonth(intDate));
                }
              }
            });
            completedWeekly += executedRiscoMonthsWeekly.size;
            
            // Mensal: contar TODAS as interações do mês inteiro
            const riscoInteractionsMonthly = memberInteractions.filter(i => 
              i.type === 'Índice de Risco' && 
              isWithinInterval(parseISO(i.date), monthlyRange) &&
              requiredRiscoMonths.includes(getMonth(parseISO(i.date)))
            );
            completedMonthly += riscoInteractionsMonthly.length;
            
            // 1:1
            const oneOnOneSchedule = interactionSchedules['1:1'] || [];
            const requiredOneOnOneMonths = oneOnOneSchedule.filter(monthNum => {
              for (let y = monthlyFromYear; y <= monthlyToYear; y++) {
                const startM = (y === monthlyFromYear) ? monthlyFromMonth : 0;
                const endM = (y === monthlyToYear) ? monthlyToMonth : 11;
                if (monthNum >= startM && monthNum <= endM) return true;
              }
              return false;
            });
            
            // Semanal: contar meses únicos na semana
            const executedOneOnOneMonthsWeekly = new Set<number>();
            memberInteractions.forEach(i => {
              const intDate = parseISO(i.date);
              if (i.type === '1:1' && requiredOneOnOneMonths.includes(getMonth(intDate))) {
                if (isWithinInterval(intDate, weeklyRange)) {
                  executedOneOnOneMonthsWeekly.add(getMonth(intDate));
                }
              }
            });
            completedWeekly += executedOneOnOneMonthsWeekly.size;
            
            // Mensal: contar TODAS as interações do mês inteiro
            const oneOnOneInteractionsMonthly = memberInteractions.filter(i => 
              i.type === '1:1' && 
              isWithinInterval(parseISO(i.date), monthlyRange) &&
              requiredOneOnOneMonths.includes(getMonth(parseISO(i.date)))
            );
            completedMonthly += oneOnOneInteractionsMonthly.length;
            
            // PDI
            const pdiSchedule = interactionSchedules['PDI'] || [];
            const requiredPdiMonths = pdiSchedule.filter(monthNum => {
              for (let y = monthlyFromYear; y <= monthlyToYear; y++) {
                const startM = (y === monthlyFromYear) ? monthlyFromMonth : 0;
                const endM = (y === monthlyToYear) ? monthlyToMonth : 11;
                if (monthNum >= startM && monthNum <= endM) return true;
              }
              return false;
            });
            
            // Semanal: contar meses únicos na semana
            const executedPdiMonthsWeekly = new Set<number>();
            memberPdiActions.forEach(action => {
              const actionDate = parseISO(action.startDate);
              if (requiredPdiMonths.includes(getMonth(actionDate))) {
                if (isWithinInterval(actionDate, weeklyRange)) {
                  executedPdiMonthsWeekly.add(getMonth(actionDate));
                }
              }
            });
            completedWeekly += executedPdiMonthsWeekly.size;
            
            // Mensal: contar TODAS as ações PDI do mês inteiro
            const pdiActionsMonthly = memberPdiActions.filter(action => {
              const actionDate = parseISO(action.startDate);
              return isWithinInterval(actionDate, monthlyRange) &&
                     requiredPdiMonths.includes(getMonth(actionDate));
            });
            completedMonthly += pdiActionsMonthly.length;
          });
        } else {
          // Diretor: contar N2 Individual, Índice de Qualidade, Ações Diretor
          // N2 Individual e Índice de Qualidade são salvos na coleção do LÍDER
          // Ações Diretor são salvas na coleção do DIRETOR
          
          // Interações do diretor (Ações Diretor)
          const directorInteractions = allInteractionsMap.get(employee.id) || [];
          const directorActionsWeekly = directorInteractions.filter(i => 
            isWithinInterval(parseISO(i.date), weeklyRange) &&
            ['Análise do Índice de Qualidade', 'Análise do Índice de Risco'].includes(i.type)
          );
          const directorActionsMonthly = directorInteractions.filter(i => 
            isWithinInterval(parseISO(i.date), monthlyRange) &&
            ['Análise do Índice de Qualidade', 'Análise do Índice de Risco'].includes(i.type)
          );
          
          // Interações dos líderes (N2 Individual e Índice de Qualidade)
          const leadersList = employees.filter(e => 
            !(e as any)._isDeleted && 
            e.role === 'Líder' && 
            !e.isDirector &&
            e.axis === 'Comercial'
          );
          
          let n2CountWeekly = 0;
          let qualityCountWeekly = 0;
          let n2CountMonthly = 0;
          let qualityCountMonthly = 0;
          
          leadersList.forEach(leader => {
            const leaderInteractions = allInteractionsMap.get(leader.id) || [];
            
            // N2 Individual: limitar ao obrigatório por líder (mesmo padrão do ranking)
            const n2Required = getLeaderN2Frequency(leader.name || '');
            const n2InteractionsWeekly = leaderInteractions.filter(i => 
              i.type === 'N2 Individual' && isWithinInterval(parseISO(i.date), weeklyRange)
            );
            const n2InteractionsMonthly = leaderInteractions.filter(i => 
              i.type === 'N2 Individual' && isWithinInterval(parseISO(i.date), monthlyRange)
            );
            // Semanal: limitar ao obrigatório mensal (não semanal, pois pode ter mais de 1 por semana)
            n2CountWeekly += Math.min(n2InteractionsWeekly.length, n2Required);
            // Mensal: contar TODAS as interações N2 do mês inteiro
            n2CountMonthly += n2InteractionsMonthly.length;
            
            // Índice de Qualidade: 1 por mês por líder (agrupar por mês)
            const qualityInteractionsWeekly = leaderInteractions.filter(i => 
              i.type === 'Índice de Qualidade' && isWithinInterval(parseISO(i.date), weeklyRange)
            );
            const qualityInteractionsMonthly = leaderInteractions.filter(i => 
              i.type === 'Índice de Qualidade' && isWithinInterval(parseISO(i.date), monthlyRange)
            );
            
            // Semanal: agrupar por mês (máximo 1 por mês por líder)
            const qualityMonthsWeekly = new Set<string>(); // Usar string para incluir ano+mês
            qualityInteractionsWeekly.forEach(i => {
              const date = parseISO(i.date);
              qualityMonthsWeekly.add(`${getYear(date)}-${getMonth(date)}`);
            });
            qualityCountWeekly += Math.min(qualityMonthsWeekly.size, 1); // Máximo 1 por mês por líder
            
            // Mensal: contar TODAS as interações de Índice de Qualidade do mês inteiro
            qualityCountMonthly += qualityInteractionsMonthly.length;
          });
          
          completedWeekly = n2CountWeekly + qualityCountWeekly + directorActionsWeekly.length;
          completedMonthly = n2CountMonthly + qualityCountMonthly + directorActionsMonthly.length;
        }
        
        // Porcentagem baseada na semana: (realizado na semana / esperado na semana) * 100
        const percentage = weeklyRequired > 0 
          ? (completedWeekly / weeklyRequired) * 100 
          : 0;
        
        // Status baseado na semana
        const status: 'excellent' | 'on-track' | 'behind' = percentage > 100 
          ? 'excellent' 
          : percentage >= 80 
            ? 'on-track' 
            : 'behind';
        
        progressList.push({
          employeeId: employee.id,
          employeeName: employee.name || 'Sem nome',
          role: type === 'leaders' ? 'Líder' : 'Diretor',
          currentWeek,
          monthlyRequired,
          weeklyRequired,
          expectedAccumulated: weeklyRequired, // Esperado na semana (não acumulado)
          completedAccumulated: completedWeekly, // Realizado na semana
          completedMonthly,
          percentage: Math.round(percentage * 10) / 10,
          status
        });
      });
      
      return progressList.sort((a, b) => b.percentage - a.percentage);
    }, [calculateMonthlyRequiredInteractions]);

    const calculateAnnualInteractions = (employee: Employee) => {
      let total = 0;
      total += 2; // PDI
      total += 4; // 1:1
      total += 12; // Risk
      switch (employee.segment) {
        case 'Alfa':
          total += 48;
          break;
        case 'Beta':
          total += 24;
          break;
        case 'Senior':
            total += 12;
            break;
      }
      return total;
    };

    const getInteractionBreakdown = (employee: Employee) => {
        const breakdown = [
            "PDI: 2",
            "1:1: 4",
            "Índice de Risco: 12"
        ];
        switch (employee.segment) {
            case 'Alfa':
                breakdown.push("N3 Individual: 48");
                break;
            case 'Beta':
                breakdown.push("N3 Individual: 24");
                break;
            case 'Senior':
                breakdown.push("N3 Individual: 12");
                break;
        }
        return breakdown.join(' | ');
    }


  const filteredAndSortedEmployees = useMemo(() => {
    if (!employees) return [];
    
    // Otimização: loop com early return ao invés de filter (mais rápido quando muitos itens são descartados)
    const filtered: Employee[] = [];
    for (const employee of employees) {
      // Ignorar registros marcados como deletados (soft delete)
      if ((employee as any)._isDeleted) continue;
      
      // Early return em cada condição - para assim que uma falhar
      if (filters.name.size > 0 && (!employee.name || !filters.name.has(employee.name))) continue;
      if (filters.position.size > 0 && (!employee.position || !filters.position.has(employee.position))) continue;
      if (filters.axis.size > 0 && (!employee.axis || !filters.axis.has(employee.axis))) continue;
      if (filters.area.size > 0 && (!employee.area || !filters.area.has(employee.area))) continue;
      if (filters.segment.size > 0 && (!employee.segment || !filters.segment.has(employee.segment))) continue;
      if (filters.leader.size > 0 && (!employee.leader || !filters.leader.has(employee.leader))) continue;
      if (filters.city.size > 0 && (!employee.city || !filters.city.has(employee.city))) continue;
      if (filters.role.size > 0 && (!employee.role || !filters.role.has(employee.role))) continue;
      
      filtered.push(employee);
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || bValue === undefined || aValue === null || bValue === null) return 0;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [employees, filters, sortConfig]);

  const teams = useMemo(() => {
    if (!employees) return new Map<string, Employee[]>();
  
    const groupedByLeader = new Map<string, Employee[]>();
  
    employees.forEach(employee => {
      const leaderId = employee.leaderId || "sem-lider";
  
      if (!groupedByLeader.has(leaderId)) {
        groupedByLeader.set(leaderId, []);
      }
      groupedByLeader.get(leaderId)?.push(employee);
    });
  
    const leaderIdToNameMap = new Map<string, string>();
    employees.forEach(e => {
        if(e.role === 'Líder' || e.role === 'Diretor') {
            leaderIdToNameMap.set(e.id, e.name);
        }
    });
    leaderIdToNameMap.set('sem-lider', 'Sem Líder');

    const sortedLeaderIds = [...groupedByLeader.keys()].sort((a, b) => {
      const nameA = leaderIdToNameMap.get(a) || '';
      const nameB = leaderIdToNameMap.get(b) || '';
      return nameA.localeCompare(nameB);
    });
  
    const sortedMap = new Map<string, Employee[]>();
    sortedLeaderIds.forEach(leaderId => {
      const sortedEmployees = groupedByLeader.get(leaderId)?.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
      if (sortedEmployees) {
        sortedMap.set(leaderId, sortedEmployees);
      }
    });
  
    return sortedMap;
  }, [employees]);
  
  const getInitials = (name: string) => {
    if (!name) return "";
    const names = name.split(" ");
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };


  const requestSort = (key: keyof Employee) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleMultiSelectFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const newSet = new Set(prev[filterName] as Set<string>);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return { ...prev, [filterName]: newSet };
    });
  };

  const isFilterActive = useMemo(() => {
    return Object.values(filters).some(value => {
      if (value instanceof Set) return value.size > 0;
      return false;
    });
  }, [filters]);

  const clearFilters = () => setFilters(initialFilters);

  const handleAddEmployee = () => {
    setSelectedEmployee(undefined);
    setIsEmployeeFormOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEmployeeFormOpen(true);
  };

  const handleCopyAndSaveEmployee = async (employee: Employee) => {
    if (!firestore) return;

    const { id, ...employeeData } = employee;
    const newId3a = `${employee.id3a}-${Date.now()}`;
    
    const employeeCopy: Partial<Employee> = { 
        ...employeeData,
        id3a: newId3a,
        email: '',
        name: `${employee.name} (Cópia)`,
        photoURL: '', 
     };

    const newDocRef = doc(collection(firestore, "employees"), newId3a);

    try {
        await setDocumentNonBlocking(newDocRef, employeeCopy);
        toast({
            title: "Funcionário Copiado",
            description: `${employeeCopy.name} foi adicionado à lista.`,
        });
    } catch (e) {
        console.error("Erro ao copiar funcionário:", e);
        toast({
            variant: "destructive",
            title: "Erro ao Copiar",
            description: "Não foi possível criar uma cópia do funcionário.",
        });
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!firestore || !employeeToDelete || !user) return;
    const docRef = doc(firestore, "employees", employeeToDelete.id);
    try {
      await softDeleteDocument(docRef, user.uid);
      toast({
        title: "Funcionário Removido",
        description: `${employeeToDelete.name} foi removido com sucesso (Soft Delete).`,
      });
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Remover",
        description: "Não foi possível remover o funcionário.",
      });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    }
  };


  const handleLeaderChange = async (employeeId: string, newLeaderId: string) => {
    if (!firestore || !employees) return;
    
    const employeeDocRef = doc(firestore, "employees", employeeId);
    
    if (newLeaderId === "no-leader") {
        const dataToSave = {
            leaderId: "",
            leader: "",
            leaderEmail: ""
        };
        try {
            await updateDoc(employeeDocRef, dataToSave);
        } catch(e) {
            console.error(e)
        }
        return;
    }

    const newLeader = leaders.find(l => l.id === newLeaderId);

    const dataToSave = {
        leaderId: newLeader?.id || "",
        leader: newLeader?.name || "",
        leaderEmail: newLeader?.email || ""
    };
    
    try {
        await updateDoc(employeeDocRef, dataToSave);
    } catch (error) {
        console.error(error);
    }
  };
  
  const handleManagementToggle = async (employeeId: string, isUnderManagement: boolean) => {
    if (!firestore) return;
    const docRef = doc(firestore, "employees", employeeId);
    try {
        await updateDoc(docRef, { isUnderManagement });
    } catch (error) {
        console.error(error)
    }
  }

  const handlePermissionToggle = async (employeeId: string, field: 'isAdmin', value: boolean) => {
    if (!hasAdminClaim) {
      toast({
        variant: 'destructive',
        title: 'Permissão negada',
        description: 'Apenas admins com Custom Claim podem alterar permissões de admin.'
      });
      return;
    }
    if (!firestore) return;
    const docRef = doc(firestore, "employees", employeeId);
    try {
        await updateDoc(docRef, { [field]: value });
        toast({
          title: "Permissão atualizada",
          description: `Admin ${value ? 'adicionado' : 'removido'} com sucesso.`,
        });
    } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Erro ao alterar permissão",
          description: "Operação não concluída."
        });
    }
  }

  const handleSelectForBackup = (employeeId: string) => {
    setSelectedForBackup(prev => 
        prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId) 
        : [...prev, employeeId]
    );
  };

  const handleSelectAllForBackup = () => {
    if (!filteredAndSortedEmployees) return;
    if (selectedForBackup.length === filteredAndSortedEmployees.length) {
        setSelectedForBackup([]);
    } else {
        setSelectedForBackup(filteredAndSortedEmployees.map(e => e.id));
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!firestore || selectedForBackup.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum colaborador selecionado',
        description: 'Por favor, selecione pelo menos um colaborador para exportar.',
      });
      return;
    }
  
    setIsExporting(true);
    toast({
      title: 'Exportação Iniciada',
      description: `Gerando arquivo ${format.toUpperCase()} para ${selectedForBackup.length} colaborador(es)...`,
    });
  
    try {
      await exportData(firestore, selectedForBackup, format, employees ?? []);
      toast({
        title: 'Exportação Concluída',
        description: `O download do seu arquivo ${format.toUpperCase()} deve começar em breve.`,
      });
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      toast({
        variant: 'destructive',
        title: `Erro na Exportação para ${format.toUpperCase()}`,
        description: 'Não foi possível gerar o arquivo. Verifique o console para mais detalhes.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const grantAdminAccess = async (email: string) => {
    if (!firebaseApp) {
        toast({ variant: "destructive", title: "Erro", description: "Firebase não inicializado."});
        return;
    }

    setSetupLoading(prev => ({...prev, [email]: true}));
    
    try {
        const functions = getFunctions(firebaseApp, 'us-central1');
        const setupFirstAdmin = httpsCallable(functions, 'setupFirstAdmin');
        
        const result: any = await setupFirstAdmin({ email: email });

        toast({
            title: "Sucesso!",
            description: result.data.message,
        });

    } catch (error: any) {
        console.error("Erro ao chamar a função:", error);
        toast({
            variant: "destructive",
            title: "Erro ao promover usuário",
            description: error.message || "Ocorreu um erro desconhecido.",
        });
    } finally {
        setSetupLoading(prev => ({...prev, [email]: false}));
    }
  };

  const handleConfigToggle = async (field: 'maintenanceMode' | 'rankingBonusEnabled', value: boolean) => {
    if (!firestore) return;
    const configRef = doc(firestore, "configs", "general");
    try {
        // Usar setDoc com merge para criar o documento se não existir
        await setDoc(configRef, { [field]: value }, { merge: true });
        toast({
            title: "Configuração Atualizada",
            description: `${field === 'maintenanceMode' ? 'Modo de Manutenção' : 'Bônus do Ranking'} ${value ? 'ativado' : 'desativado'}.`,
        });
    } catch (error) {
        console.error("Erro ao atualizar configuração:", error);
        toast({
            variant: "destructive",
            title: "Erro ao Atualizar",
            description: "Não foi possível atualizar a configuração.",
        });
    }
  };

  // Atualizar estado local quando as configurações de premissas carregarem do DB
  useEffect(() => {
    if (!isPremissasConfigLoading && premissasConfigFromDB) {
      setPremissasConfig(premissasConfigFromDB);
    }
  }, [premissasConfigFromDB, isPremissasConfigLoading]);

  const handleSavePremissasConfig = async () => {
    if (!firestore) return;
    
    setPremissasLoading(true);
    const configRef = doc(firestore, "configs", "premissas");
    
    try {
      await setDoc(configRef, premissasConfig, { merge: true });
      toast({
        title: "Configurações Salvas",
        description: "As configurações de premissas foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar configurações de premissas:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar as configurações de premissas.",
      });
    } finally {
      setPremissasLoading(false);
    }
  };

  const checkInvalidEmployees = () => {
    if (!employees) return;
    // Critério: Sem nome (que é o que aparece vazio nos dropdowns) E não já deletado
    const ghosts = employees.filter(e => !(e as any)._isDeleted && (!e.name || e.name.trim() === ''));
    
    setInvalidEmployees(ghosts);
    if (ghosts.length === 0) {
        toast({ title: "Nenhum fantasma óbvio", description: "Não encontrei registros sem nome." });
    } else {
        toast({ 
            variant: "destructive",
            title: "Fantasmas Encontrados", 
            description: `${ghosts.length} registros sem nome encontrados.` 
        });
    }
  };

  const cleanInvalidEmployees = async () => {
    if (!firestore || invalidEmployees.length === 0) return;
    
    // VALIDAÇÃO EXTRA DE SEGURANÇA: Garantir que só marcamos como deletados usuários realmente vazios
    const safeToDelete = invalidEmployees.filter(emp => {
        // Critério rigoroso: SEM nome OU nome vazio (após trim)
        const hasNoName = !emp.name || emp.name.trim() === '';
        // Se tiver nome válido, NÃO marcar como deletado
        if (!hasNoName) {
            console.warn(`Proteção: Não marcando ${emp.id} - possui nome: "${emp.name}"`);
            return false;
        }
        return true;
    });

    if (safeToDelete.length === 0) {
        toast({ 
            variant: "destructive",
            title: "Nada para limpar", 
            description: "Nenhum registro atende aos critérios de segurança para limpeza." 
        });
        setInvalidEmployees([]);
        return;
    }

    if (safeToDelete.length < invalidEmployees.length) {
        toast({ 
            title: "Filtro de Segurança", 
            description: `${invalidEmployees.length - safeToDelete.length} registros foram protegidos.` 
        });
    }
    
    // SOFT DELETE: Marcar como deletado em vez de apagar permanentemente
    let markedCount = 0;
    let errorCount = 0;
    const batchPromises = safeToDelete.map(async (emp) => {
        try {
            // Validação final antes de marcar
            if (emp.name && emp.name.trim() !== '') {
                console.warn(`Proteção final: Pulando ${emp.id} - tem nome: "${emp.name}"`);
                return;
            }
            
            // Marcar como deletado (soft delete)
            const docRef = doc(firestore, "employees", emp.id);
            await updateDoc(docRef, { 
                _isDeleted: true,
                _deletedAt: new Date().toISOString(),
                _deletedBy: user?.email || 'system'
            });
            markedCount++;
        } catch (e: any) {
            errorCount++;
            console.error(`Erro ao marcar ${emp.id} como deletado`, e);
            // Se for erro de permissão, tentar apenas marcar o nome como [DELETADO]
            if (e?.code === 'permission-denied') {
                try {
                    // Fallback: tentar apenas atualizar o nome
                    const docRef = doc(firestore, "employees", emp.id);
                    await updateDoc(docRef, { 
                        name: '[DELETADO]',
                        _isDeleted: true 
                    });
                    markedCount++;
                    errorCount--; // Desconta o erro já que conseguimos marcar
                } catch (fallbackError) {
                    console.error(`Erro no fallback para ${emp.id}`, fallbackError);
                }
            }
        }
    });

    await Promise.all(batchPromises);
    
    setInvalidEmployees([]);
    if (markedCount > 0) {
        toast({ 
            title: "Limpeza Concluída", 
            description: `${markedCount} registros foram marcados como deletados e não aparecerão mais nas listas.` 
        });
    }
    if (errorCount > 0) {
        toast({ 
            variant: "destructive",
            title: "Alguns erros ocorreram", 
            description: `${errorCount} registros não puderam ser marcados. Verifique o console.` 
        });
    }
  };

  const isLoading = isUserLoading || areEmployeesLoading || loadingReports;

  const FilterComponent = ({ title, filterKey, options }: { title: string, filterKey: keyof typeof filters, options: string[]}) => (
    <div className="flex items-center gap-1">
      <span>{title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Filter className={`h-4 w-4 ${(filters[filterKey] as Set<string>).size > 0 ? 'text-primary' : ''}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
            {options.map((option, index) => (
              <DropdownMenuCheckboxItem
                key={`${option}-${index}`}
                checked={(filters[filterKey] as Set<string>).has(option)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => handleMultiSelectFilterChange(filterKey, option)}
              >
                {option}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  
  const SortableHeader = ({ title, sortKey }: { title: string, sortKey: keyof Employee }) => (
    <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-1">
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
  

  const ReportTable = ({ title, description, data, isLoading }: { title: string, description: string, data: Employee[], isLoading: boolean }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Líder</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                </TableRow>
                            ))
                        ) : data.length > 0 ? data.map(emp => (
                            <TableRow key={emp.id}>
                                <TableCell className="font-medium">{emp.name}</TableCell>
                                <TableCell>{emp.email}</TableCell>
                                <TableCell>{emp.leader || 'N/A'}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24">
                                    {isLoading ? 'Carregando...' : 'Nenhum colaborador encontrado.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );

  // Guard: renderização condicional em vez de early return
  if (isMetricsOnlyMode && (isUserLoading || areEmployeesLoading)) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Carregando métricas...</h1>
      </main>
    );
  }

  if ((isMetricsOnlyMode && !canAccessMetrics) || (!isMetricsOnlyMode && !isConfigAdmin)) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </main>
    );
  }

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {!isMetricsOnlyMode && (
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="employees">Funcionários</TabsTrigger>
          <TabsTrigger value="teams">Equipes</TabsTrigger>
          <TabsTrigger value="projects">Projetos</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Geral</TabsTrigger>
          <TabsTrigger value="backup">Backup & Import</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="employees" forceMount className={activeTab !== "employees" ? "hidden" : ""}>
        {activeTab === "employees" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Gerenciar Funcionários</CardTitle>
                    <CardDescription>
                        Adicione, edite e gerencie funções e permissões dos funcionários.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {isFilterActive && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Limpar filtros
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setIsCsvDialogOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Funcionários
                    </Button>
                    <Button size="sm" onClick={handleAddEmployee}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar Funcionário
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <SortableHeader title="Nome" sortKey="name" />
                        <FilterComponent title="" filterKey="name" options={uniqueValues.names} />
                      </div>
                    </TableHead>
                    <TableHead>
                       <div className="flex items-center gap-1">
                          <SortableHeader title="Segmento" sortKey="segment" />
                          <FilterComponent title="" filterKey="segment" options={uniqueValues.segments} />
                       </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                          <SortableHeader title="Cargo" sortKey="position" />
                          <FilterComponent title="" filterKey="position" options={uniqueValues.positions} />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                          <SortableHeader title="Líder" sortKey="leader" />
                          <FilterComponent title="" filterKey="leader" options={uniqueValues.leaders} />
                      </div>
                    </TableHead>
                    <TableHead>Interações / Ano</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-center">Gerenciamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-9 w-[180px]" /></TableCell>
                          <TableCell className="flex justify-center"><Skeleton className="h-6 w-12" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      </TableRow>
                  ))}
                  {!isLoading && filteredAndSortedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.segment}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>
                         <Select 
                          value={employee.leaderId || "no-leader"}
                          onValueChange={(newLeaderId) => handleLeaderChange(employee.id, newLeaderId)}
                          disabled={!leaders || leaders.length === 0}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sem Líder" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no-leader">Sem Líder</SelectItem>
                            {leaders
                              .filter(leader => leader.id !== employee.id) // Cannot be their own leader
                              .map((leader) => (
                              <SelectItem key={leader.id} value={leader.id}>
                                 {leader.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                          <TooltipProvider>
                              <UITooltip>
                                  <TooltipTrigger asChild>
                                      <div className="flex items-center justify-center gap-1 font-medium cursor-default">
                                          {calculateAnnualInteractions(employee)}
                                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p className="text-xs">{getInteractionBreakdown(employee)}</p>
                                  </TooltipContent>
                              </UITooltip>
                          </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={employee.role}
                          onValueChange={(newRole) => handleRoleChange(employee.id, newRole as Role)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                          <div className="flex items-center justify-center space-x-2">
                              <Switch 
                                  id={`management-${employee.id}`}
                                  checked={!!employee.isUnderManagement}
                                  onCheckedChange={(checked) => handleManagementToggle(employee.id, checked)}
                              />
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                                    <Pen className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCopyAndSaveEmployee(employee)}>
                                      <Copy className="mr-2 h-4 w-4" />
                                      Copiar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(employee)}>
                                    <Trash className="mr-2 h-4 w-4" />
                                    Remover
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}
      </TabsContent>
       <TabsContent value="teams" forceMount className={activeTab !== "teams" ? "hidden" : ""}>
        {activeTab === "teams" && (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Diretores</CardTitle>
                    <CardDescription>
                        Usuários com permissão para visualizar todos os colaboradores.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-2/3" />
                            <Skeleton className="h-10 w-1/2" />
                        </div>
                    ) : directors.length > 0 ? (
                        <ul className="space-y-3">
                            {directors.map(director => (
                                <li key={director.id} className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={director.photoURL} alt={director.name} />
                                        <AvatarFallback>{getInitials(director.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <span className="font-medium">{director.name}</span>
                                        <p className="text-sm text-muted-foreground">{director.position}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center">Nenhum diretor cadastrado.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
            <CardHeader>
                <CardTitle>Equipes e Colaboradores</CardTitle>
                <CardDescription>Visualize as equipes com base na liderança.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="mb-4">
                            <Skeleton className="h-12 w-1/3 mb-2" />
                            <div className="pl-6 space-y-2">
                                <Skeleton className="h-8 w-2/3" />
                                <Skeleton className="h-8 w-1/2" />
                            </div>
                        </div>
                    ))
                ) : (
                <Accordion type="multiple" className="w-full">
                {[...teams.entries()].map(([leaderId, members]) => {
                    const leaderEmployee = employees?.find(e => e.id === leaderId);
                    const leaderName = leaderEmployee?.name || "Sem Líder";

                    return (
                    <AccordionItem value={leaderId} key={leaderId}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={leaderEmployee?.photoURL} alt={leaderName} />
                                    <AvatarFallback>{getInitials(leaderName)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{leaderName}</span>
                                <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-primary rounded-full">
                                    {members.length}
                                </span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                        <ul className="pl-6 space-y-3">
                            {members.map((member) => (
                            <li key={member.id} className="flex items-center gap-3 text-sm">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{member.name}</span>
                                <span className="text-muted-foreground">({member.position})</span>
                            </li>
                            ))}
                        </ul>
                        </AccordionContent>
                    </AccordionItem>
                    )
                })}
                </Accordion>
                )}
            </CardContent>
            </Card>
        </div>
        )}
      </TabsContent>
      
      {/* TAB DE PROJETOS */}
      <TabsContent value="projects" forceMount className={activeTab !== "projects" ? "hidden" : ""}>
        {activeTab === "projects" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Gerenciar Projetos</CardTitle>
                <CardDescription>
                  Crie, edite e configure projetos independentes com seus líderes e membros.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => { setSelectedProject(null); setIsProjectFormOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Projeto
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {areProjectsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : !projects || projects.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhum projeto criado ainda
                </p>
                <Button className="mt-4" onClick={() => { setSelectedProject(null); setIsProjectFormOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar Primeiro Projeto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.filter(p => !p.isArchived).map((project) => (
                  <Card key={project.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{project.name}</CardTitle>
                            {project.isArchived && (
                              <Badge variant="secondary">Arquivado</Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {project.description}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedProject(project); setIsProjectFormOpen(true); }}>
                              <Pen className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (!firestore) return;
                                const projectRef = doc(firestore, "projects", project.id);
                                await updateDoc(projectRef, { isArchived: true, updatedAt: new Date().toISOString() });
                                toast({ title: "Projeto Arquivado", description: `"${project.name}" foi arquivado.` });
                              }}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Arquivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="grid gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Líder:</span>
                          <span>{project.leaderName}</span>
                          <span className="text-muted-foreground">({project.leaderEmail})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Membros:</span>
                          <span>{project.memberIds?.length || 0} colaborador(es)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </TabsContent>
      
      <TabsContent value="reports" forceMount className={activeTab !== "reports" ? "hidden" : ""}>
        {activeTab === "reports" && (
        <div className="space-y-6">
            <ReportTable
                title="Colaboradores Sem Diagnóstico Profissional"
                description="Colaboradores sob gestão que ainda não têm um diagnóstico registrado."
                data={employeesWithoutDiagnosis}
                isLoading={isLoading}
            />
        </div>
        )}
      </TabsContent>
      <TabsContent value="settings" forceMount className={activeTab !== "settings" ? "hidden" : ""}>
        {activeTab === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>
              Gerencie as configurações globais do aplicativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                    <h3 className="text-base font-medium">Modo de Manutenção</h3>
                    <p className="text-sm text-muted-foreground">
                        Ative para desabilitar o acesso ao aplicativo para todos, exceto administradores.
                    </p>
                </div>
                <Switch 
                  id="maintenance-mode" 
                  checked={maintenanceMode}
                  onCheckedChange={(checked) => handleConfigToggle('maintenanceMode', checked)}
                  disabled={isConfigLoading}
                />
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                    <h3 className="text-base font-medium">Sistema de Bônus do Ranking</h3>
                    <p className="text-sm text-muted-foreground">
                        Ative para habilitar o sistema de bônus (+3% a cada 10 interações) no ranking de líderes.
                    </p>
                </div>
                <Switch 
                  id="ranking-bonus" 
                  checked={rankingBonusEnabled}
                  onCheckedChange={(checked) => handleConfigToggle('rankingBonusEnabled', checked)}
                  disabled={isConfigLoading}
                />
            </div>

            {/* Configurações de Premissas */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Configurações de Premissas</CardTitle>
                <CardDescription>
                  Configure os parâmetros para cálculos de projeções anuais (AUC e Receita).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CDI Anual (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={premissasConfig.cdiAnual}
                      onChange={(e) => setPremissasConfig(prev => ({ ...prev, cdiAnual: parseFloat(e.target.value) || 0 }))}
                      placeholder="15.00"
                      disabled={isPremissasConfigLoading || premissasLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Taxa CDI usada nos cálculos de projeção de AUC
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Imposto Repasse (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={premissasConfig.impostoRepasse}
                      onChange={(e) => setPremissasConfig(prev => ({ ...prev, impostoRepasse: parseFloat(e.target.value) || 0 }))}
                      placeholder="19.33"
                      disabled={isPremissasConfigLoading || premissasLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Porcentagem de imposto sobre o repasse
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Multiplicador B2B</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={premissasConfig.multiplicadorB2B}
                      onChange={(e) => setPremissasConfig(prev => ({ ...prev, multiplicadorB2B: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.50"
                      disabled={isPremissasConfigLoading || premissasLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Multiplicador para assessores B2B (padrão: 0.50)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Multiplicador MINST</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={premissasConfig.multiplicadorMINST}
                      onChange={(e) => setPremissasConfig(prev => ({ ...prev, multiplicadorMINST: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.25"
                      disabled={isPremissasConfigLoading || premissasLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Multiplicador para assessores MINST (padrão: 0.25)
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    onClick={handleSavePremissasConfig}
                    disabled={isPremissasConfigLoading || premissasLoading}
                  >
                    {premissasLoading ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Administradores</CardTitle>
                            <CardDescription>Gerencie quem tem acesso de administrador.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add New Admin Section */}
                    <div className="flex gap-4 items-end border-b pb-6">
                        <div className="flex-1 space-y-2">
                             <p className="text-sm font-medium">Adicionar Administrador</p>
                             <Select value={newAdminId} onValueChange={setNewAdminId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um funcionário..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees
                                        ?.filter(e => !(e as any)._isDeleted && !e.isAdmin)
                                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                        .map(employee => (
                                            <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name}
                                            </SelectItem>
                                        ))
                                    }
                                </SelectContent>
                             </Select>
                        </div>
                        <Button 
                            onClick={() => {
                                if (newAdminId) {
                                    handlePermissionToggle(newAdminId, 'isAdmin', true);
                                    setNewAdminId("");
                                }
                            }}
                            disabled={!newAdminId}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Adicionar
                        </Button>
                    </div>

                    {isLoading ? (
                         <div className="space-y-3">
                            <Skeleton className="h-10 w-2/3" />
                            <Skeleton className="h-10 w-1/2" />
                        </div>
                    ) : admins.length > 0 ? (
                        <ul className="space-y-4">
                            {admins.map(admin => {
                                const isHardcodedAdmin = adminEmails.includes(admin.email || '');
                                return (
                                <li key={admin.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={admin.photoURL} alt={admin.name} />
                                            <AvatarFallback>{getInitials(admin.name)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{admin.name}</span>
                                                {isHardcodedAdmin && (
                                                    <Badge variant="secondary" className="text-xs">Sistema</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                                        </div>
                                    </div>
                                    
                                    {isHardcodedAdmin ? (
                                        <TooltipProvider>
                                            <UITooltip>
                                                <TooltipTrigger asChild>
                                                    <ShieldCheck className="h-5 w-5 text-muted-foreground/50 cursor-not-allowed"/>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Administrador definido pelo sistema.</p>
                                                </TooltipContent>
                                            </UITooltip>
                                        </TooltipProvider>
                                    ) : (
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handlePermissionToggle(admin.id, 'isAdmin', false)}
                                        >
                                            <Trash className="h-4 w-4 mr-2" />
                                            Remover
                                        </Button>
                                    )}
                                </li>
                            )})}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum administrador cadastrado.</p>
                    )}
                </CardContent>
            </Card>
              {superAdminEmails.includes(user?.email || '') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Setup de Administrador</CardTitle>
                    <CardDescription>
                      Use esta seção para conceder permissões de administrador aos usuários.
                      Esta função executa a Cloud Function `setupFirstAdmin`.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>Configuração de Admin</AlertTitle>
                      <AlertDescription>
                        Esta função define o Custom Claim `isAdmin` para o usuário especificado.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-3">
                      {emailsToPromote.map(email => (
                        <div key={email} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">Tornar administrador:</p>
                            <p className="text-sm text-muted-foreground">{email}</p>
                          </div>
                          <Button 
                            onClick={() => grantAdminAccess(email)}
                            disabled={setupLoading[email]}
                          >
                            {setupLoading[email] ? 'Processando...' : 'Executar Função'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <Button onClick={checkCustomClaim} variant="outline" className="w-full">
                    Verificar Meu Custom Claim
                  </Button>
                  <Button onClick={checkAdminClaims} variant="outline" className="w-full">
                    Listar Todos os Admins (Custom Claims)
                  </Button>
                </CardContent>
              </Card>
          </CardContent>
        </Card>
        )}
      </TabsContent>
      <TabsContent value="backup" forceMount className={activeTab !== "backup" ? "hidden" : ""}>
        {activeTab === "backup" && (
        <>
        {/* Card de Backups do Firestore */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Backups Automáticos do Firestore</CardTitle>
            <CardDescription>
              Backups semanais automáticos (todo domingo às 3h AM). Visualize, teste e gerencie os backups disponíveis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info sobre backups automáticos */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Backups Automáticos Configurados
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                • <strong>Frequência:</strong> Toda semana, aos domingos às 3h AM (horário de Brasília)
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                • <strong>Retenção:</strong> 45 dias (backups mais antigos são deletados automaticamente)
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                • <strong>Localização:</strong> Google Cloud Storage (projeto protegido)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card existente de Backup e Importação */}
        <Card>
            <CardHeader>
                <CardTitle>Backup e Importação</CardTitle>
                <CardDescription>
                    Exporte o histórico de colaboradores ou importe interações de um arquivo CSV.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-6">
                    <Button variant="outline" onClick={() => setIsInteractionCsvDialogOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" /> Importar Interações
                    </Button>
                </div>

                <div className="mb-6 border-t pt-6">
                    <h3 className="text-lg font-medium mb-2">Manutenção de Banco de Dados</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Verifique e remova registros de funcionários que estão incompletos (sem nome ou email).
                    </p>
                    <div className="flex gap-2 items-center">
                        <Button variant="secondary" onClick={checkInvalidEmployees}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> 
                            Verificar Usuários Inválidos
                        </Button>
                        
                        {invalidEmployees.length > 0 && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash className="mr-2 h-4 w-4" />
                                        Excluir {invalidEmployees.length} Inválidos
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Exclusão em Massa</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-sm text-muted-foreground space-y-2">
                                                <p>Você está prestes a marcar <strong>{invalidEmployees.length}</strong> registros como deletados (soft delete). Eles não aparecerão mais nas listas, mas permanecerão no banco de dados.</p>
                                                <div className="max-h-48 overflow-y-auto border rounded p-2 bg-muted text-xs font-mono">
                                                    {invalidEmployees.map(e => (
                                                        <div key={e.id}>ID: {e.id} {e.name ? `(${e.name})` : '(SEM NOME)'}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={cleanInvalidEmployees} className="bg-destructive hover:bg-destructive/90">
                                            Confirmar Exclusão
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={filteredAndSortedEmployees && selectedForBackup.length === filteredAndSortedEmployees.length && filteredAndSortedEmployees.length > 0}
                                        onCheckedChange={handleSelectAllForBackup}
                                        aria-label="Selecionar todos"
                                    />
                                </TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Cargo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredAndSortedEmployees.map((employee) => (
                                <TableRow key={employee.id} data-state={selectedForBackup.includes(employee.id) && "selected"}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedForBackup.includes(employee.id)}
                                            onCheckedChange={() => handleSelectForBackup(employee.id)}
                                            aria-label={`Selecionar ${employee.name}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{employee.name}</TableCell>
                                    <TableCell>{employee.email}</TableCell>
                                    <TableCell>{employee.position}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => handleExport('csv')} disabled={selectedForBackup.length === 0 || isExporting}>
                        {isExporting ? 'Exportando...' : <><FileDown className="mr-2 h-4 w-4" /> Exportar para CSV</>}
                    </Button>
                    <Button variant="outline" onClick={() => handleExport('pdf')} disabled={selectedForBackup.length === 0 || isExporting}>
                       {isExporting ? 'Exportando...' : <><FileDown className="mr-2 h-4 w-4" /> Exportar para PDF</>}
                    </Button>
                </div>
            </CardContent>
        </Card>
        </>
        )}
      </TabsContent>

      {/* TAB DE MÉTRICAS */}
      <TabsContent value="metrics" forceMount className={activeTab !== "metrics" ? "hidden" : ""}>
        {activeTab === "metrics" && (
        <div className="space-y-6 pt-2">
          {/* Header com filtro de período */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Métricas de Aderência
              </h2>
              <p className="text-muted-foreground">
                Acompanhe as interações e a aderência dos líderes e diretores.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>Meta: <strong className="text-foreground">{METRICS_GOAL}%</strong></span>
              </div>
              <DateRangePicker 
                date={metricsDateRange} 
                onDateChange={setMetricsDateRange}
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadMetricsData}
                disabled={metricsLoading}
              >
                {metricsLoading ? 'Carregando...' : 'Atualizar'}
              </Button>
            </div>
          </div>

          {/* Card 0: Média Ponderada e Tendência */}
          {(() => {
            const leadersWeightedAvg = calculateWeightedAverage(leaderMetrics);
            const directorsWeightedAvg = calculateWeightedAverage(directorMetrics);
            const leadersTrend = calculateTrend(leadersHistory, 'leaders');
            const directorsTrend = calculateTrend(directorsHistory, 'directors');
            
            // Combinar histórico de líderes e diretores para visualização geral
            const historyMap = new Map<string, { leaders: number; directors: number; total: number }>();
            
            leadersHistory.forEach(h => {
              historyMap.set(h.month, { leaders: h.weightedAverage, directors: 0, total: h.weightedAverage });
            });
            
            directorsHistory.forEach(h => {
              const existing = historyMap.get(h.month);
              if (existing) {
                existing.directors = h.weightedAverage;
                existing.total = (existing.leaders + h.weightedAverage) / 2;
              } else {
                historyMap.set(h.month, { leaders: 0, directors: h.weightedAverage, total: h.weightedAverage });
              }
            });
            
            const combinedHistory = Array.from(historyMap.entries())
              .map(([month, data]) => {
                return {
                  month: format(parseISO(`${month}-01`), 'MMM/yyyy', { locale: ptBR }),
                  monthSortKey: month,
                  'Líderes': Math.round(data.leaders * 10) / 10,
                  'Diretores': Math.round(data.directors * 10) / 10,
                  'Média Geral': Math.round(data.total * 10) / 10,
                };
              })
              .sort((a, b) => (a as any).monthSortKey.localeCompare((b as any).monthSortKey));

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Média Ponderada de Uso do CRM
                  </CardTitle>
                  <CardDescription>
                    Taxa de aderência ponderada pelo número de interações obrigatórias desde o início do sistema.
                    <br />
                    <span className="text-xs text-muted-foreground/80">
                      Cálculo: Média Ponderada = Σ(aderência × peso) / Σ(peso), onde peso = número de interações obrigatórias de cada líder/diretor.
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {historyLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : (
                    <>
                      {/* Médias Ponderadas Atuais */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Líderes</span>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Tendência:</span>
                                    {leadersTrend.trend === 'increasing' && (
                                      <Badge variant="default" className="gap-1 cursor-help">
                                        <ArrowUp className="h-3 w-3" />
                                        +{Math.abs(leadersTrend.percentageChange)}%
                                      </Badge>
                                    )}
                                    {leadersTrend.trend === 'decreasing' && (
                                      <Badge variant="destructive" className="gap-1 cursor-help">
                                        <ArrowDown className="h-3 w-3" />
                                        -{Math.abs(leadersTrend.percentageChange)}%
                                      </Badge>
                                    )}
                                    {leadersTrend.trend === 'stable' && (
                                      <Badge variant="secondary" className="gap-1 cursor-help">
                                        <Minus className="h-3 w-3" />
                                        Estável
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs font-medium mb-1">Variação da Média Ponderada</p>
                                  <p className="text-xs">
                                    {leadersTrend.trend === 'increasing' && `Aumento de ${Math.abs(leadersTrend.percentageChange)}% comparando o último mês (${leadersTrend.currentAverage}%) com o mês anterior (${leadersTrend.previousAverage}%)`}
                                    {leadersTrend.trend === 'decreasing' && `Queda de ${Math.abs(leadersTrend.percentageChange)}% comparando o último mês (${leadersTrend.currentAverage}%) com o mês anterior (${leadersTrend.previousAverage}%)`}
                                    {leadersTrend.trend === 'stable' && `Tendência estável: último mês com ${leadersTrend.currentAverage}% (variação menor que 1% comparado ao mês anterior de ${leadersTrend.previousAverage}%)`}
                                  </p>
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <div className="text-3xl font-bold">
                            {leadersWeightedAvg.weightedAverage.toFixed(1)}%
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{leadersWeightedAvg.totalParticipants} participantes</span>
                            <span>•</span>
                            <span>{leadersWeightedAvg.totalWeight} interações obrigatórias</span>
                          </div>
                          <div className="mt-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div 
                                className={`h-full transition-all ${getProgressColor(leadersWeightedAvg.weightedAverage)}`}
                                style={{ width: `${Math.min(leadersWeightedAvg.weightedAverage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Diretores</span>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Tendência:</span>
                                    {directorsTrend.trend === 'increasing' && (
                                      <Badge variant="default" className="gap-1 cursor-help">
                                        <ArrowUp className="h-3 w-3" />
                                        +{Math.abs(directorsTrend.percentageChange)}%
                                      </Badge>
                                    )}
                                    {directorsTrend.trend === 'decreasing' && (
                                      <Badge variant="destructive" className="gap-1 cursor-help">
                                        <ArrowDown className="h-3 w-3" />
                                        -{Math.abs(directorsTrend.percentageChange)}%
                                      </Badge>
                                    )}
                                    {directorsTrend.trend === 'stable' && (
                                      <Badge variant="secondary" className="gap-1 cursor-help">
                                        <Minus className="h-3 w-3" />
                                        Estável
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs font-medium mb-1">Variação da Média Ponderada</p>
                                  <p className="text-xs">
                                    {directorsTrend.trend === 'increasing' && `Aumento de ${Math.abs(directorsTrend.percentageChange)}% comparando o último mês (${directorsTrend.currentAverage}%) com o mês anterior (${directorsTrend.previousAverage}%)`}
                                    {directorsTrend.trend === 'decreasing' && `Queda de ${Math.abs(directorsTrend.percentageChange)}% comparando o último mês (${directorsTrend.currentAverage}%) com o mês anterior (${directorsTrend.previousAverage}%)`}
                                    {directorsTrend.trend === 'stable' && `Tendência estável: último mês com ${directorsTrend.currentAverage}% (variação menor que 1% comparado ao mês anterior de ${directorsTrend.previousAverage}%)`}
                                  </p>
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <div className="text-3xl font-bold">
                            {directorsWeightedAvg.weightedAverage.toFixed(1)}%
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{directorsWeightedAvg.totalParticipants} participantes</span>
                            <span>•</span>
                            <span>{directorsWeightedAvg.totalWeight} interações obrigatórias</span>
                          </div>
                          <div className="mt-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div 
                                className={`h-full transition-all ${getProgressColor(directorsWeightedAvg.weightedAverage)}`}
                                style={{ width: `${Math.min(directorsWeightedAvg.weightedAverage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gráfico de Histórico */}
                      {combinedHistory.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Histórico Mensal</h3>
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart 
                                data={combinedHistory}
                                margin={{ top: 40, right: 30, left: 60, bottom: 20 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="month" 
                                  angle={-45}
                                  textAnchor="end"
                                  height={80}
                                  interval="preserveStartEnd"
                                />
                                <YAxis 
                                  domain={[0, 100]}
                                  width={40}
                                  label={{ value: 'Aderência', angle: -90, position: 'insideLeft', dx: -5, dy: 30 }}
                                />
                                <RechartsTooltip 
                                  formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                                  labelFormatter={(label: string) => `Mês: ${label}`}
                                />
                                <Legend />
                                <Line 
                                  type="monotone" 
                                  dataKey="Líderes" 
                                  stroke="hsl(170, 60%, 50%)" 
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Diretores" 
                                  stroke="hsl(210, 60%, 50%)" 
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="Média Geral" 
                                  stroke="hsl(0, 0%, 50%)" 
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            {combinedHistory.length} meses analisados desde o início do sistema
                          </p>
                        </div>
                      )}

                      {combinedHistory.length === 0 && !historyLoading && (
                        <div className="text-center py-8 text-muted-foreground">
                          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhum dado histórico disponível ainda.</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Card: Acompanhamento Semanal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Acompanhamento Semanal de Interações
              </CardTitle>
              <CardDescription>
                Status semanal baseado no realizado na semana vs esperado na semana.
                <br />
                <span className="text-xs text-muted-foreground/80">
                  Excelente: &gt;100% | Em dia: 80-100% | Atrasado: &lt;80%
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weeklyProgressLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : weeklyProgress ? (
                <div className="space-y-6">
                  {/* Resumo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Líderes */}
                    <div className="border rounded-lg p-4 space-y-2">
                      <h3 className="font-semibold">Líderes</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Badge variant="default" className="bg-green-500">Excelente</Badge>
                          <span>{weeklyProgress.leadersSummary.excellent}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="default" className="bg-blue-500">Em dia</Badge>
                          <span>{weeklyProgress.leadersSummary.onTrack}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="destructive">Atrasado</Badge>
                          <span>{weeklyProgress.leadersSummary.behind}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Diretores */}
                    <div className="border rounded-lg p-4 space-y-2">
                      <h3 className="font-semibold">Diretores</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Badge variant="default" className="bg-green-500">Excelente</Badge>
                          <span>{weeklyProgress.directorsSummary.excellent}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="default" className="bg-blue-500">Em dia</Badge>
                          <span>{weeklyProgress.directorsSummary.onTrack}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="destructive">Atrasado</Badge>
                          <span>{weeklyProgress.directorsSummary.behind}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tabela de Líderes */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Líderes</h3>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="text-center">Semana</TableHead>
                            <TableHead className="text-center">Obrigatório/Mês</TableHead>
                            <TableHead className="text-center">Esperado na Semana</TableHead>
                            <TableHead className="text-center">Realizado na Semana</TableHead>
                            <TableHead className="text-center">Realizado Mensal</TableHead>
                            <TableHead className="text-center">%</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {weeklyProgress.leaders.map((progress) => (
                            <TableRow key={progress.employeeId}>
                              <TableCell className="font-medium">{progress.employeeName}</TableCell>
                              <TableCell className="text-center">{progress.currentWeek}</TableCell>
                              <TableCell className="text-center">{progress.monthlyRequired}</TableCell>
                              <TableCell className="text-center">{progress.expectedAccumulated}</TableCell>
                              <TableCell className="text-center">{progress.completedAccumulated}</TableCell>
                              <TableCell className="text-center">{progress.completedMonthly}</TableCell>
                              <TableCell className="text-center">{progress.percentage.toFixed(1)}%</TableCell>
                              <TableCell className="text-center">
                                {progress.status === 'excellent' && (
                                  <Badge variant="default" className="bg-green-500">Excelente</Badge>
                                )}
                                {progress.status === 'on-track' && (
                                  <Badge variant="default" className="bg-blue-500">Em dia</Badge>
                                )}
                                {progress.status === 'behind' && (
                                  <Badge variant="destructive">Atrasado</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  
                  {/* Tabela de Diretores */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Diretores</h3>
                    <div className="border rounded-md">
                      <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead className="text-center">Semana</TableHead>
                                <TableHead className="text-center">Obrigatório/Mês</TableHead>
                                <TableHead className="text-center">Esperado na Semana</TableHead>
                                <TableHead className="text-center">Realizado na Semana</TableHead>
                                <TableHead className="text-center">Realizado Mensal</TableHead>
                                <TableHead className="text-center">%</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {weeklyProgress.directors.map((progress) => (
                                <TableRow key={progress.employeeId}>
                                  <TableCell className="font-medium">{progress.employeeName}</TableCell>
                                  <TableCell className="text-center">{progress.currentWeek}</TableCell>
                                  <TableCell className="text-center">{progress.monthlyRequired}</TableCell>
                                  <TableCell className="text-center">{progress.expectedAccumulated}</TableCell>
                                  <TableCell className="text-center">{progress.completedAccumulated}</TableCell>
                                  <TableCell className="text-center">{progress.completedMonthly}</TableCell>
                                  <TableCell className="text-center">{progress.percentage.toFixed(1)}%</TableCell>
                                  <TableCell className="text-center">
                                    {progress.status === 'excellent' && (
                                      <Badge variant="default" className="bg-green-500">Excelente</Badge>
                                    )}
                                    {progress.status === 'on-track' && (
                                      <Badge variant="default" className="bg-blue-500">Em dia</Badge>
                                    )}
                                    {progress.status === 'behind' && (
                                      <Badge variant="destructive">Atrasado</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível. Clique em "Atualizar" para carregar.
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Card: Monitoramento de Alto Risco */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Monitoramento de Alto Risco
              </CardTitle>
              <CardDescription>
                Acompanhamento de assessores com Índice de Risco maior que 5.
                <br />
                <span className="text-xs text-muted-foreground/80">
                  Histórico mensal e lista atual de assessores em alto risco.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {riskMetricsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : riskMetrics ? (
                <>
                  {/* Gráfico de Histórico de Risco */}
                  {riskMetrics.history.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Histórico de Alto Risco (&gt;5)</h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={riskMetrics.history}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="month"
                              angle={-45}
                              textAnchor="end"
                              height={60}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              allowDecimals={false}
                              label={{ value: 'Qtd. Assessores', angle: -90, position: 'insideLeft', dy: 50, dx: 15 }}
                            />
                            <RechartsTooltip
                              formatter={(value: number) => [`${value} assessores`, 'Alto Risco']}
                              labelFormatter={(label: string) => `Mês: ${label}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="count"
                              name="Assessores em Alto Risco"
                              stroke="hsl(0, 84.2%, 60.2%)" // Red/Destructive color
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Assessores em Alto Risco */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium flex items-center justify-between">
                      <span>Assessores Atualmente em Alto Risco</span>
                      <Badge variant="destructive">{riskMetrics.currentHighRisk.length}</Badge>
                    </h3>
                    <div className="border rounded-md max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="text-center">Índice de Risco</TableHead>
                            <TableHead className="text-center">Última Avaliação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {riskMetrics.currentHighRisk.length > 0 ? (
                            riskMetrics.currentHighRisk.map((advisor) => (
                              <TableRow key={advisor.id}>
                                <TableCell className="font-medium">{advisor.name}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="destructive" className="text-base px-2">
                                    {advisor.riskScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {format(parseISO(advisor.lastAssessmentDate), 'dd/MM/yyyy', { locale: ptBR })}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                Nenhum assessor em alto risco no momento.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível. Clique em "Atualizar" para carregar.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 1: Visão Geral - Líderes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Visão Geral - Líderes
                  </CardTitle>
                  <CardDescription>
                    Interações por semana/mês e aderência geral de cada líder
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {leaderMetrics.length} líder{leaderMetrics.length !== 1 ? 'es' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : leaderMetrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum líder encontrado com colaboradores sob gestão.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Líder</TableHead>
                        <TableHead className="text-center">Equipe</TableHead>
                        <TableHead className="text-center">Int./Semana</TableHead>
                        <TableHead className="text-center">Int./Mês</TableHead>
                        <TableHead className="w-[200px]">Aderência</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderMetrics.map((metrics) => {
                        const status = getStatusBadge(metrics.adherenceScore);
                        const isExpanded = expandedLeaders.has(metrics.leader.id);
                        return <React.Fragment key={metrics.leader.id}>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => {
                                const newExpanded = new Set(expandedLeaders);
                                if (isExpanded) {
                                  newExpanded.delete(metrics.leader.id);
                                } else {
                                  newExpanded.add(metrics.leader.id);
                                }
                                setExpandedLeaders(newExpanded);
                              }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={metrics.leader.photoURL} />
                                    <AvatarFallback>{metrics.leader.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">{metrics.leader.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{metrics.teamSize}</Badge>
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {metrics.totalInteractionsWeek}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {metrics.totalInteractionsMonth}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${getProgressColor(metrics.adherenceScore)}`}
                                      style={{ width: `${Math.min(metrics.adherenceScore, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-sm w-12 text-right">
                                    {metrics.adherenceScore}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </TableCell>
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </TableRow>
                            {/* Linha expandida com detalhes por tipo */}
                            {isExpanded && (
                              <TableRow key={`${metrics.leader.id}-details`} className="bg-muted/30">
                                <TableCell colSpan={7} className="p-4">
                                  <div className="grid grid-cols-5 gap-4">
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">N3 Individual</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div 
                                            className={`h-full ${getProgressColor(metrics.byType.n3.adherence)}`}
                                            style={{ width: `${Math.min(metrics.byType.n3.adherence, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono">{metrics.byType.n3.adherence}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {metrics.byType.n3.completed}/{metrics.byType.n3.required}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">Índice de Risco</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div 
                                            className={`h-full ${getProgressColor(metrics.byType.risco.adherence)}`}
                                            style={{ width: `${Math.min(metrics.byType.risco.adherence, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono">{metrics.byType.risco.adherence}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {metrics.byType.risco.completed}/{metrics.byType.risco.required}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">1:1</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div 
                                            className={`h-full ${getProgressColor(metrics.byType.oneOnOne.adherence)}`}
                                            style={{ width: `${Math.min(metrics.byType.oneOnOne.adherence, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono">{metrics.byType.oneOnOne.adherence}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {metrics.byType.oneOnOne.completed}/{metrics.byType.oneOnOne.required}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">PDI</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div 
                                            className={`h-full ${getProgressColor(metrics.byType.pdi.adherence)}`}
                                            style={{ width: `${Math.min(metrics.byType.pdi.adherence, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono">{metrics.byType.pdi.adherence}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {metrics.byType.pdi.completed}/{metrics.byType.pdi.required}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">Feedback</p>
                                      <p className="text-lg font-mono">{metrics.byType.feedback.completed}</p>
                                      <p className="text-xs text-muted-foreground">registros</p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>;
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Visão Geral - Diretores */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Visão Geral - Diretores
                  </CardTitle>
                  <CardDescription>
                    Acompanhamento de líderes pelos diretores (N2 Individual, Índice de Qualidade)
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {directorMetrics.length} diretor{directorMetrics.length !== 1 ? 'es' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : directorMetrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum diretor encontrado.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Diretor</TableHead>
                        <TableHead className="text-center">Líderes</TableHead>
                        <TableHead className="text-center">Int./Semana</TableHead>
                        <TableHead className="text-center">Int./Mês</TableHead>
                        <TableHead className="w-[200px]">Aderência</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directorMetrics.map((metrics) => {
                        const status = getStatusBadge(metrics.adherenceScore);
                        const isExpanded = expandedDirectors.has(metrics.director.id);
                        return <React.Fragment key={metrics.director.id}>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => {
                                const newExpanded = new Set(expandedDirectors);
                                if (isExpanded) {
                                  newExpanded.delete(metrics.director.id);
                                } else {
                                  newExpanded.add(metrics.director.id);
                                }
                                setExpandedDirectors(newExpanded);
                              }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={metrics.director.photoURL} />
                                    <AvatarFallback>{metrics.director.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">{metrics.director.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{metrics.leadersCount}</Badge>
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {metrics.totalInteractionsWeek}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {metrics.totalInteractionsMonth}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${getProgressColor(metrics.adherenceScore)}`}
                                      style={{ width: `${Math.min(metrics.adherenceScore, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-sm w-12 text-right">
                                    {metrics.adherenceScore}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </TableCell>
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </TableRow>
                            {/* Linha expandida com detalhes por tipo */}
                            {isExpanded && (
                              <TableRow key={`${metrics.director.id}-details`} className="bg-muted/30">
                                <TableCell colSpan={7} className="p-4">
                                  <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">N2 Individual</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div 
                                            className={`h-full ${getProgressColor(metrics.byType.n2.adherence)}`}
                                            style={{ width: `${Math.min(metrics.byType.n2.adherence, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono">{metrics.byType.n2.adherence}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {metrics.byType.n2.completed}/{metrics.byType.n2.required} realizados
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">Índice de Qualidade</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div 
                                            className={`h-full ${getProgressColor(metrics.byType.qualidade.adherence)}`}
                                            style={{ width: `${Math.min(metrics.byType.qualidade.adherence, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono">{metrics.byType.qualidade.adherence}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {metrics.byType.qualidade.completed}/{metrics.byType.qualidade.required} realizados
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium">Feedback</p>
                                      <p className="text-lg font-mono">{metrics.byType.feedback.completed}</p>
                                      <p className="text-xs text-muted-foreground">registros</p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>;
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legenda */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span>≥ {METRICS_GOAL}% (Em dia)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span>60-{METRICS_GOAL - 1}% (Atenção)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>&lt; 60% (Atrasado)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </TabsContent>

    </Tabs>
    <CsvUploadDialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen} />
    <InteractionCsvUploadDialog open={isInteractionCsvDialogOpen} onOpenChange={setIsInteractionCsvDialogOpen} />
    <EmployeeFormDialog 
        open={isEmployeeFormOpen} 
        onOpenChange={setIsEmployeeFormOpen}
        employee={selectedEmployee}
        leaders={leaders}
        roles={roles}
    />
    
    {/* Dialog de Projeto (Admin) */}
    {isProjectFormOpen && employees && (
      <ProjectFormDialog
        open={isProjectFormOpen}
        onOpenChange={setIsProjectFormOpen}
        project={selectedProject}
        employees={employees}
        currentUser={employees.find(e => e.email === user?.email) || employees[0]}
        isAdminMode={true}
      />
    )}
    
    <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa ação não pode ser desfeita. Isso irá remover permanentemente o funcionário
            "{employeeToDelete?.name}" do banco de dados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive hover:bg-destructive/90">
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default function AdminPage(props: AdminPageProps) {
  return (
    <Suspense fallback={<AdminPageFallback />}>
      <AdminPageContent {...props} />
    </Suspense>
  );
}
