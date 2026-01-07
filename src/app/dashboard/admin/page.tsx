
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
import { useState, useMemo, useEffect } from "react";
import { useCollection, useFirestore, useMemoFirebase, useUser, useFirebase, softDeleteDocument } from "@/firebase";
import { collection, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

export default function AdminPage() {
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
  
  // Estado para controlar aba ativa (permite trocar antes de carregar)
  const [activeTab, setActiveTab] = useState<string>("employees");

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
  if (!isConfigAdmin) {
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
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="employees">Funcionários</TabsTrigger>
        <TabsTrigger value="teams">Equipes</TabsTrigger>
        <TabsTrigger value="projects">Projetos</TabsTrigger>
        <TabsTrigger value="reports">Relatórios</TabsTrigger>
        <TabsTrigger value="settings">Geral</TabsTrigger>
        <TabsTrigger value="backup">Backup & Import</TabsTrigger>
      </TabsList>
      <TabsContent value="employees">
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
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                      <div className="flex items-center justify-center gap-1 font-medium cursor-default">
                                          {calculateAnnualInteractions(employee)}
                                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p className="text-xs">{getInteractionBreakdown(employee)}</p>
                                  </TooltipContent>
                              </Tooltip>
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
       <TabsContent value="teams">
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
      <TabsContent value="projects">
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
      
      <TabsContent value="reports">
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
      <TabsContent value="settings">
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
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <ShieldCheck className="h-5 w-5 text-muted-foreground/50 cursor-not-allowed"/>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Administrador definido pelo sistema.</p>
                                                </TooltipContent>
                                            </Tooltip>
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
      <TabsContent value="backup">
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
