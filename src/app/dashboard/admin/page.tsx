"use client";

import type { Employee, Role, Interaction, PDIAction } from "@/lib/types";
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
import { MoreHorizontal, PlusCircle, Upload, ArrowUpDown, X, Filter, User, ShieldCheck, FileDown, HelpCircle, Copy, Pen, Trash, ExternalLink } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { CsvUploadDialog } from "@/components/csv-upload-dialog";
import { InteractionCsvUploadDialog } from "@/components/interaction-csv-upload-dialog";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useCollection, useFirestore, useMemoFirebase, useUser, useFirebase } from "@/firebase";
import { collection, doc, deleteDoc, updateDoc, getDocs, query } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmployeeFormDialog } from "@/components/employee-form-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { exportData } from "@/lib/export";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const superAdminEmails = ['lucas.nogueira@3ainvestimentos.com.br', 'matheus@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];
const emailsToPromote = [
    'lucas.nogueira@3ainvestimentos.com.br',
    'matheus@3ainvestimentos.com.br'
];

const roles: Role[] = ["Colaborador", "Líder", "Diretor"];
const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];


type SortConfig = {
  key: keyof Employee;
  direction: "ascending" | "descending";
} | null;

export default function AdminPage() {
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

  const { firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const initialFilters = {
    name: new Set<string>(),
    position: new Set<string>(),
    axis: new Set<string>(),
    area: new Set<string>(),
    segment: new Set<string>(),
    leader: new Set<string>(),
    city: new Set<string>(),
    role: new Set<string>(),
  };

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

  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const handleRoleChange = async (employeeId: string, newRole: Role) => {
    if (!firestore) return;
    const docRef = doc(firestore, "employees", employeeId);
    try {
      // If the new role is Director, also set isDirector to true
      // If it's something else, ensure isDirector is false
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
        
        const names = [...new Set(employees.map(e => e.name).filter(Boolean))].sort();
        const positions = [...new Set(employees.map(e => e.position).filter(Boolean))].sort();
        const axes = [...new Set(employees.map(e => e.axis).filter(Boolean))].sort();
        const areas = [...new Set(employees.map(e => e.area).filter(Boolean))].sort();
        const segments = [...new Set(employees.map(e => e.segment).filter(Boolean))].sort();
        const leaderNames = [...new Set(employees.map(e => e.leader).filter(Boolean))].sort();
        const cities = [...new Set(employees.map(e => e.city).filter(Boolean))].sort();
        const roleValues = [...new Set(employees.map(e => e.role).filter(Boolean))].sort() as Role[];

        const leaders = employees.filter(e => e.role === 'Líder' || e.role === 'Diretor');
        const directors = employees.filter(e => e.isDirector).sort((a,b) => a.name.localeCompare(b.name));
        
        // 1. Get admins from DB
        const adminsFromDb = employees.filter(e => e.isAdmin);
        const adminMap = new Map(adminsFromDb.map(a => [a.email, a]));

        // 2. Add hardcoded admins if they aren't in the DB list yet
        adminEmails.forEach(email => {
            if (!adminMap.has(email)) {
                const employeeData = employees.find(e => e.email === email);
                if (employeeData) {
                    adminMap.set(email, { ...employeeData, isAdmin: true });
                } else {
                    // Create a placeholder if the user is not in the employees list at all
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
        
        const admins = Array.from(adminMap.values()).sort((a,b) => a.name.localeCompare(b.name));


        const employeesWithoutDiagnosis = employees.filter(emp => emp.isUnderManagement && !emp.diagnosis);

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
      // PDI: semestral = 2/ano
      total += 2;
      // 1:1: trimestral = 4/ano
      total += 4;
      // Índice de Risco: mensal = 12/ano
      total += 12;
      // N3 Individual: varia com segmento
      switch (employee.segment) {
        case 'Alfa':
          total += 48; // 4/mês * 12
          break;
        case 'Beta':
          total += 24; // 2/mês * 12
          break;
        case 'Senior':
            total += 12; // 1/mês * 12
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
    
    let filtered = employees.filter(employee => {
        return (
            (filters.name.size === 0 || (employee.name && filters.name.has(employee.name))) &&
            (filters.position.size === 0 || (employee.position && filters.position.has(employee.position))) &&
            (filters.axis.size === 0 || (employee.axis && filters.axis.has(employee.axis))) &&
            (filters.area.size === 0 || (employee.area && filters.area.has(employee.area))) &&
            (filters.segment.size === 0 || (employee.segment && filters.segment.has(employee.segment))) &&
            (filters.leader.size === 0 || (employee.leader && filters.leader.has(employee.leader))) &&
            (filters.city.size === 0 || (employee.city && filters.city.has(employee.city))) &&
            (filters.role.size === 0 || (employee.role && filters.role.has(employee.role)))
        );
    });

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


    // Sort leaders alphabetically by name
    const sortedLeaderIds = [...groupedByLeader.keys()].sort((a, b) => {
      const nameA = leaderIdToNameMap.get(a) || '';
      const nameB = leaderIdToNameMap.get(b) || '';
      return nameA.localeCompare(nameB);
    });
  
    const sortedMap = new Map<string, Employee[]>();
    sortedLeaderIds.forEach(leaderId => {
      // Sort employees within each team alphabetically
      const sortedEmployees = groupedByLeader.get(leaderId)?.sort((a, b) => a.name.localeCompare(b.name));
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

    // Create a deep copy and prepare it for saving as a new document
    const { id, ...employeeData } = employee;
    const newId3a = `${employee.id3a}-${Date.now()}`;
    
    const employeeCopy: Partial<Employee> = { 
        ...employeeData,
        id3a: newId3a,
        email: '', // Email must be unique and should be manually set
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
    if (!firestore || !employeeToDelete) return;
    const docRef = doc(firestore, "employees", employeeToDelete.id);
    try {
      await deleteDoc(docRef);
      toast({
        title: "Funcionário Removido",
        description: `${employeeToDelete.name} foi removido com sucesso.`,
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
    
    // If newLeaderId is 'no-leader', it means "Sem Líder" was selected
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
    if (!firestore) return;
    const docRef = doc(firestore, "employees", employeeId);
    try {
        await updateDoc(docRef, { [field]: value });
    } catch (error) {
        console.error(error);
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
        const functions = getFunctions(firebaseApp);
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
  
    const handleGoogleAuth = async () => {
        if (!firebaseApp) {
            toast({ variant: "destructive", title: "Erro", description: "Firebase não inicializado."});
            return;
        }
        setIsAuthLoading(true);
        try {
            const functions = getFunctions(firebaseApp);
            const googleAuthInit = httpsCallable(functions, 'googleAuthInit');
            const result: any = await googleAuthInit();
            const authUrl = result.data.authUrl;
            if (authUrl) {
                // Redireciona o usuário para a URL de autorização do Google
                window.location.href = authUrl;
            } else {
                throw new Error("URL de autorização não recebida.");
            }
        } catch (error: any) {
            console.error("Erro ao iniciar autorização com Google:", error);
            toast({
                variant: "destructive",
                title: "Erro de Autorização",
                description: error.message || "Não foi possível iniciar a conexão com o Google Calendar.",
            });
            setIsAuthLoading(false);
        }
    };


  const isLoading = isUserLoading || areEmployeesLoading || loadingReports;

  const FilterComponent = ({ title, filterKey, options, children }: { title: string, filterKey: keyof typeof filters, options: string[], children?: React.ReactNode }) => (
    <div className="flex items-center gap-1">
      <span>{title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Filter className={`h-4 w-4 ${(filters[filterKey] as Set<string>).size > 0 ? 'text-primary' : ''}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
          {children ? children :
            <>
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
            </>
          }
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

  return (
    <>
    <Tabs defaultValue="employees" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="employees">Funcionários</TabsTrigger>
        <TabsTrigger value="teams">Equipes</TabsTrigger>
        <TabsTrigger value="reports">Relatórios</TabsTrigger>
        <TabsTrigger value="integrations">Integrações</TabsTrigger>
        <TabsTrigger value="settings">Geral</TabsTrigger>
        <TabsTrigger value="backup">Backup & Import</TabsTrigger>
      </TabsList>
      <TabsContent value="employees">
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
                    <TableHead>Gerenciamento</TableHead>
                    <TableHead>Admin</TableHead>
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
                          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
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
                      <TableCell>
                          <div className="flex items-center space-x-2">
                              <Switch 
                                  id={`management-${employee.id}`}
                                  checked={!!employee.isUnderManagement}
                                  onCheckedChange={(checked) => handleManagementToggle(employee.id, checked)}
                              />
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex items-center space-x-2">
                              <Switch 
                                  id={`admin-${employee.id}`}
                                  checked={!!employee.isAdmin}
                                  onCheckedChange={(checked) => handlePermissionToggle(employee.id, 'isAdmin', checked)}
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
      </TabsContent>
       <TabsContent value="teams">
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
      </TabsContent>
      <TabsContent value="reports">
        <div className="space-y-6">
            <ReportTable
                title="Colaboradores Sem Diagnóstico Profissional"
                description="Colaboradores sob gestão que ainda não têm um diagnóstico registrado."
                data={employeesWithoutDiagnosis}
                isLoading={isLoading}
            />
        </div>
      </TabsContent>
      <TabsContent value="integrations">
        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
            <CardDescription>
              Conecte a plataforma com outras ferramentas para automatizar fluxos de trabalho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Card>
                <CardHeader>
                    <CardTitle>Google Calendar</CardTitle>
                    <CardDescription>
                        Conecte sua conta Google para criar eventos na agenda para as interações agendadas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Conectar com Google Calendar</p>
                            <p className="text-sm text-muted-foreground">
                                Permita que a aplicação crie eventos para 1:1s e PDIs.
                            </p>
                        </div>
                        <Button onClick={handleGoogleAuth} disabled={isAuthLoading}>
                           {isAuthLoading ? 'Aguarde...' : 'Conectar'}
                           <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="settings">
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
                <Switch id="maintenance-mode" />
            </div>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Administradores</CardTitle>
                            <CardDescription>Gerencie quem tem acesso de administrador.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-3">
                            <Skeleton className="h-10 w-2/3" />
                            <Skeleton className="h-10 w-1/2" />
                        </div>
                    ) : admins.length > 0 ? (
                        <ul className="space-y-4">
                            {admins.map(admin => (
                                <li key={admin.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={admin.photoURL} alt={admin.name} />
                                            <AvatarFallback>{getInitials(admin.name)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <span className="font-medium">{admin.name}</span>
                                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                                        </div>
                                    </div>
                                    <ShieldCheck className="h-5 w-5 text-primary"/>
                                </li>
                            ))}
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
                <Button onClick= {checkCustomClaim} variant="outline">
                  Verificar Custom Claims
                </Button>
              </Card>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="backup">
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
