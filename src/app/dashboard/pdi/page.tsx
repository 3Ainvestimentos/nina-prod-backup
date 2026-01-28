
"use client";

import { useState, useMemo, useEffect } from "react";
import type { Employee, Diagnosis, PDIAction, Premissas, Interaction } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PdiTable } from "@/components/pdi-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pen, Pencil, Plus, X } from "lucide-react";
import { PremissasCard } from "@/components/premissas-card";
import { usePremissasConfig } from "@/hooks/use-premissas-config";
import { formatDate, cn } from "@/lib/utils";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, addDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { DiagnosisFormDialog } from "@/components/diagnosis-form-dialog";
import { useToast } from "@/hooks/use-toast";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];

/**
 * Detecta automaticamente o tipo de assessor baseado no cargo
 */
function detectarTipoAssessor(position?: string): "B2B" | "MINST" | null {
  if (!position) return null;
  
  const positionLower = position.toLowerCase();
  
  if (positionLower.includes('minst')) return 'MINST';
  if (positionLower.includes('b2b')) return 'B2B';
  
  return null;
}

/**
 * Formata número com separadores de milhar (ex: 1000000 → 1.000.000)
 * @param valor - Valor a ser formatado
 * @param permitirNegativo - Se true, permite valores negativos (ex: -500.000)
 */
function formatarNumeroComSeparador(valor: string | number, permitirNegativo = false): string {
  if (valor === "" || valor === null || valor === undefined) return "";
  
  const valorStr = valor.toString();
  const isNegativo = permitirNegativo && valorStr.startsWith('-');
  
  // Remove tudo que não for número
  const apenasNumeros = valorStr.replace(/[^\d]/g, '');
  
  if (!apenasNumeros) return isNegativo ? "-" : "";
  
  // Formata com pontos como separador de milhar
  const formatado = apenasNumeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegativo ? `-${formatado}` : formatado;
}

/**
 * Remove formatação e converte para número (suporta negativos)
 */
function parseNumeroFormatado(valor: string): number {
  if (!valor) return 0;
  const isNegativo = valor.startsWith('-');
  // Remove tudo que não for número
  const limpo = valor.replace(/[^\d]/g, '');
  const numero = parseFloat(limpo) || 0;
  return isNegativo ? -numero : numero;
}

export default function PdiPage() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isDiagnosisFormOpen, setIsDiagnosisFormOpen] = useState(false);
  
  // Estados para edição inline do Plano Comercial
  const [isEditingPremissas, setIsEditingPremissas] = useState(false);
  const [isSavingPremissas, setIsSavingPremissas] = useState(false);
  const [premissasFormData, setPremissasFormData] = useState({
    aucInicial: "",
    captacaoPrevista: "",
    churnPrevisto: "",
    roaPrevisto: "",
    tipoAssessor: "B2B" as "B2B" | "MINST",
  });
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { config: premissasConfig, isLoading: isPremissasConfigLoading } = usePremissasConfig();

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const pdiActionsCollection = useMemoFirebase(
    () => (firestore && selectedEmployeeId ? collection(firestore, "employees", selectedEmployeeId, "pdiActions") : null),
    [firestore, selectedEmployeeId]
  );
  const { data: pdiActions, isLoading: arePdiActionsLoading } = useCollection<PDIAction>(pdiActionsCollection);

  // Premissas do colaborador selecionado
  const premissasCollection = useMemoFirebase(
    () => (firestore && selectedEmployeeId ? collection(firestore, "employees", selectedEmployeeId, "premissas") : null),
    [firestore, selectedEmployeeId]
  );
  const { data: premissasList, isLoading: arePremissasLoading } = useCollection<Premissas>(premissasCollection);

  // Interações N3 do colaborador (para cálculo do realizado)
  const interactionsCollection = useMemoFirebase(
    () => (firestore && selectedEmployeeId ? collection(firestore, "employees", selectedEmployeeId, "interactions") : null),
    [firestore, selectedEmployeeId]
  );
  const { data: interactions, isLoading: areInteractionsLoading } = useCollection<Interaction>(interactionsCollection);

  // Pegar premissas do ano atual
  const currentYear = new Date().getFullYear();
  const premissasAnoAtual = useMemo(() => {
    if (!premissasList) return null;
    return premissasList.find(p => p.year === currentYear) || null;
  }, [premissasList, currentYear]);
  
  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;

    // Verificar se o email está na lista de admins hardcoded (apenas para isAdmin)
    if (user.email && adminEmails.includes(user.email)) {
        const employeeData = employees.find(e => e.email === user.email) || {};
        return {
            ...employeeData,
            name: user.displayName || 'Admin',
            email: user.email,
            isAdmin: true,
            role: 'Líder',
        } as Employee;
    }

    const employeeData = employees.find(e => e.email === user.email);
    if (!employeeData) return null;

    return employeeData;
  }, [user, employees]);

  const managedEmployees = useMemo(() => {
    if (!currentUserEmployee || !employees) return [];
    const activeEmployees = employees.filter(e => !(e as any)._isDeleted);
    
    if (currentUserEmployee.isAdmin || currentUserEmployee.isDirector) {
        return activeEmployees;
    }
    if (currentUserEmployee.role === 'Líder') {
        return activeEmployees.filter(e => e.leaderId === currentUserEmployee.id);
    }
    return [];
  }, [currentUserEmployee, employees]);
  
  const sortedEmployees = useMemo(() => {
    if (!managedEmployees) return [];
    return [...managedEmployees].sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [managedEmployees]);

  const selectedEmployee = useMemo(() => {
    return employees?.find((member) => member.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Sincronizar formData com premissas existentes quando mudar colaborador ou premissas
  useEffect(() => {
    if (premissasAnoAtual) {
      const tipoDetectado = detectarTipoAssessor(selectedEmployee?.position);
      setPremissasFormData({
        aucInicial: formatarNumeroComSeparador(premissasAnoAtual.aucInicial),
        // Captação pode ser negativa, então preserva o sinal
        captacaoPrevista: formatarNumeroComSeparador(premissasAnoAtual.captacaoPrevista, true),
        churnPrevisto: premissasAnoAtual.churnPrevisto?.toString() || "",
        roaPrevisto: premissasAnoAtual.roaPrevisto?.toString() || "",
        tipoAssessor: premissasAnoAtual.tipoAssessor || tipoDetectado || "B2B",
      });
      setIsEditingPremissas(false);
    } else if (selectedEmployee) {
      // Modo criação - resetar form
      const tipoDetectado = detectarTipoAssessor(selectedEmployee.position);
      setPremissasFormData({
        aucInicial: "",
        captacaoPrevista: "",
        churnPrevisto: "",
        roaPrevisto: "",
        tipoAssessor: tipoDetectado || "B2B",
      });
      setIsEditingPremissas(true); // Habilitar edição automaticamente quando não tem plano
    }
  }, [premissasAnoAtual, selectedEmployee]);

  const handleMemberChange = (id: string) => {
    setSelectedEmployeeId(id);
    setIsEditingPremissas(false);
  };
  
  const getStatusBadge = (status: "Concluído" | "Em Andamento" | "Pendente") => {
    switch (status) {
        case "Concluído":
            return "default";
        case "Em Andamento":
            return "secondary";
        case "Pendente":
            return "outline";
    }
  };

  const handleCurrencyChange = (field: 'aucInicial' | 'captacaoPrevista', value: string) => {
    // Captação permite valores negativos
    const permitirNegativo = field === 'captacaoPrevista';
    const formatado = formatarNumeroComSeparador(value, permitirNegativo);
    setPremissasFormData(prev => ({ ...prev, [field]: formatado }));
  };

  const handleCancelEdit = () => {
    // Restaurar valores originais
    if (premissasAnoAtual) {
      const tipoDetectado = detectarTipoAssessor(selectedEmployee?.position);
      setPremissasFormData({
        aucInicial: formatarNumeroComSeparador(premissasAnoAtual.aucInicial),
        // Captação pode ser negativa, então preserva o sinal
        captacaoPrevista: formatarNumeroComSeparador(premissasAnoAtual.captacaoPrevista, true),
        churnPrevisto: premissasAnoAtual.churnPrevisto?.toString() || "",
        roaPrevisto: premissasAnoAtual.roaPrevisto?.toString() || "",
        tipoAssessor: premissasAnoAtual.tipoAssessor || tipoDetectado || "B2B",
      });
    }
    setIsEditingPremissas(false);
  };

  const handleSavePremissas = async () => {
    if (!firestore || !user || !selectedEmployee) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Você precisa estar autenticado.",
      });
      return;
    }

    // Validações básicas
    const aucValue = parseNumeroFormatado(premissasFormData.aucInicial);
    const roaValue = parseFloat(premissasFormData.roaPrevisto) || 0;
    
    if (!aucValue || aucValue <= 0) {
      toast({
        variant: "destructive",
        title: "AUC Inválido",
        description: "O AUC inicial deve ser maior que zero.",
      });
      return;
    }

    if (!roaValue || roaValue <= 0) {
      toast({
        variant: "destructive",
        title: "ROA Inválido",
        description: "O ROA previsto deve ser maior que zero.",
      });
      return;
    }

    setIsSavingPremissas(true);

    try {
      const premissasData = {
        employeeId: selectedEmployee.id,
        year: premissasAnoAtual?.year || currentYear,
        aucInicial: parseNumeroFormatado(premissasFormData.aucInicial),
        captacaoPrevista: parseNumeroFormatado(premissasFormData.captacaoPrevista),
        churnPrevisto: parseFloat(premissasFormData.churnPrevisto) || 0,
        roaPrevisto: parseFloat(premissasFormData.roaPrevisto),
        tipoAssessor: premissasFormData.tipoAssessor,
        updatedAt: Timestamp.now().toDate().toISOString(),
        updatedBy: user.email || "",
      };

      const isEditMode = !!premissasAnoAtual?.id;
      const year = premissasAnoAtual?.year || currentYear;

      if (isEditMode) {
        // Modo edição: atualizar documento existente
        const premissasDocRef = doc(
          firestore,
          `employees/${selectedEmployee.id}/premissas/${premissasAnoAtual.id}`
        );
        await updateDoc(premissasDocRef, premissasData);

        toast({
          title: "Plano Comercial Atualizado",
          description: `O plano comercial de ${selectedEmployee.name} foi atualizado.`,
        });
      } else {
        // Modo criação: adicionar novo documento
        const premissasCollectionRef = collection(
          firestore,
          `employees/${selectedEmployee.id}/premissas`
        );
        
        await addDoc(premissasCollectionRef, {
          ...premissasData,
          createdAt: Timestamp.now().toDate().toISOString(),
          createdBy: user.email || "",
        });

        toast({
          title: "Plano Comercial Criado",
          description: `O plano comercial de ${selectedEmployee.name} para ${currentYear} foi salvo.`,
        });
      }

      // Registrar interação do tipo "Plano Comercial" no histórico do colaborador
      const interactionsCollection = collection(
        firestore,
        `employees/${selectedEmployee.id}/interactions`
      );
      
      // Formatar valores para exibição na timeline
      const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
      const notesDetalhadas = `${isEditMode ? 'Plano comercial atualizado' : 'Plano comercial criado'} para ${year}
• AUC Inicial: ${formatCurrency(premissasData.aucInicial)}
• Captação Mensal: ${formatCurrency(premissasData.captacaoPrevista)}
• Churn Mensal: ${premissasData.churnPrevisto}%
• ROA Anual: ${premissasData.roaPrevisto}%
• Tipo: ${premissasData.tipoAssessor}`;
      
      await addDoc(interactionsCollection, {
        type: "Plano Comercial",
        date: new Date().toISOString(),
        notes: notesDetalhadas,
        authorId: user.email || "",
      });

      setIsEditingPremissas(false);
    } catch (error) {
      console.error("Erro ao salvar plano comercial:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar o plano comercial. Tente novamente.",
      });
    } finally {
      setIsSavingPremissas(false);
    }
  };

  const diagnosis = selectedEmployee?.diagnosis;
  const isCreateMode = !premissasAnoAtual;

  return (
    <div className="space-y-6 w-full overflow-hidden">
      <Card>
        <CardHeader>
          <CardTitle>Seleção de Colaborador</CardTitle>
          <CardDescription>
            Escolha um membro da equipe para visualizar ou gerenciar o PDI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {areEmployeesLoading ? (
            <Skeleton className="h-10 w-full md:w-[300px]" />
          ) : (
            <Select
              onValueChange={handleMemberChange}
              value={selectedEmployeeId ?? ""}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Selecione um colaborador" />
              </SelectTrigger>
              <SelectContent>
                {sortedEmployees.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} {member.area && `(${member.area})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedEmployeeId && (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Diagnóstico Profissional</CardTitle>
                        <CardDescription>Status do último diagnóstico do colaborador.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsDiagnosisFormOpen(true)}>
                        <Pen className="mr-2 h-4 w-4"/>
                        {diagnosis ? 'Editar' : 'Adicionar'} Diagnóstico
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                   {areEmployeesLoading ? (
                     <div className="space-y-4">
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-12 w-full" />
                     </div>
                   ) : diagnosis ? (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Status do Diagnóstico</span>
                            <Badge variant={getStatusBadge(diagnosis.status)}>{diagnosis.status}</Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Data da Última Atualização</span>
                            <span className="text-sm font-medium">{formatDate(diagnosis.date)}</span>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Detalhes</h4>
                            <p className={cn("text-sm text-foreground/90", !diagnosis.details && "italic")}>
                                {diagnosis.details || "Nenhum detalhe fornecido."}
                            </p>
                        </div>
                    </>
                   ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                        <p>Nenhum diagnóstico profissional registrado para este colaborador.</p>
                    </div>
                   )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Plano de Desenvolvimento Individual (PDI)</CardTitle>
                    <CardDescription>Ações para o crescimento profissional de {selectedEmployee?.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                    {arePdiActionsLoading ? (
                        <div className="space-y-2">
                           <Skeleton className="h-10 w-full" />
                           <Skeleton className="h-10 w-full" />
                           <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <PdiTable pdiActions={pdiActions ?? []} employeeId={selectedEmployeeId} />
                    )}
                </CardContent>
            </Card>

            {/* Seção de Plano Comercial - Campos Inline */}
            {arePremissasLoading || isPremissasConfigLoading ? (
                <div className="space-y-6">
                    <Skeleton className="h-[200px] w-full" />
                    <Skeleton className="h-[400px] w-full" />
                </div>
            ) : (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Plano Comercial {currentYear}</CardTitle>
                                <CardDescription>
                                    {isCreateMode 
                                        ? `Configure as metas anuais de AUC e Repasse para ${selectedEmployee?.name}.`
                                        : `Metas anuais e projeções de AUC e Repasse de ${selectedEmployee?.name}.`
                                    }
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {isEditingPremissas && !isCreateMode && (
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        disabled={isSavingPremissas}
                                    >
                                        <X className="mr-2 h-4 w-4"/>
                                        Cancelar
                                    </Button>
                                )}
                                <Button 
                                    variant="default"
                                    size="sm"
                                    onClick={() => isEditingPremissas ? handleSavePremissas() : setIsEditingPremissas(true)}
                                    disabled={isSavingPremissas}
                                >
                                    {isSavingPremissas ? (
                                        "Salvando..."
                                    ) : isEditingPremissas ? (
                                        <>
                                            {isCreateMode ? (
                                                <>
                                                    <Plus className="mr-2 h-4 w-4"/>
                                                    Criar
                                                </>
                                            ) : (
                                                "Salvar"
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Pencil className="mr-2 h-4 w-4"/>
                                            Editar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                {/* AUC Inicial */}
                                <div className="space-y-2">
                                    <Label htmlFor="aucInicial" className="text-sm font-medium">
                                        AUC Inicial (R$) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="aucInicial"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Ex: 1.000.000"
                                        disabled={!isEditingPremissas}
                                        value={premissasFormData.aucInicial}
                                        onChange={(e) => handleCurrencyChange('aucInicial', e.target.value)}
                                        className={!isEditingPremissas ? "bg-muted" : ""}
                                    />
                                </div>

                                {/* Captação Prevista */}
                                <div className="space-y-2">
                                    <Label htmlFor="captacaoPrevista" className="text-sm font-medium">
                                        Captação Mensal (R$)
                                    </Label>
                                    <Input
                                        id="captacaoPrevista"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Ex: 500.000"
                                        disabled={!isEditingPremissas}
                                        value={premissasFormData.captacaoPrevista}
                                        onChange={(e) => handleCurrencyChange('captacaoPrevista', e.target.value)}
                                        className={!isEditingPremissas ? "bg-muted" : ""}
                                    />
                                </div>

                                {/* Churn Previsto */}
                                <div className="space-y-2">
                                    <Label htmlFor="churnPrevisto" className="text-sm font-medium">
                                        Churn Mensal (%)
                                    </Label>
                                    <Input
                                        id="churnPrevisto"
                                        type="number"
                                        step="0.01"
                                        placeholder="Ex: 2"
                                        disabled={!isEditingPremissas}
                                        value={premissasFormData.churnPrevisto}
                                        onChange={(e) => setPremissasFormData(prev => ({ ...prev, churnPrevisto: e.target.value }))}
                                        className={!isEditingPremissas ? "bg-muted" : ""}
                                    />
                                </div>

                                {/* ROA Previsto */}
                                <div className="space-y-2">
                                    <Label htmlFor="roaPrevisto" className="text-sm font-medium">
                                        ROA Anual (%) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="roaPrevisto"
                                        type="number"
                                        step="0.01"
                                        placeholder="Ex: 0.4"
                                        disabled={!isEditingPremissas}
                                        value={premissasFormData.roaPrevisto}
                                        onChange={(e) => setPremissasFormData(prev => ({ ...prev, roaPrevisto: e.target.value }))}
                                        className={!isEditingPremissas ? "bg-muted" : ""}
                                    />
                                </div>

                                {/* Tipo Assessor */}
                                <div className="space-y-2">
                                    <Label htmlFor="tipoAssessor" className="text-sm font-medium">
                                        Tipo Assessor <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={premissasFormData.tipoAssessor}
                                        onValueChange={(value: "B2B" | "MINST") => setPremissasFormData(prev => ({ ...prev, tipoAssessor: value }))}
                                        disabled={!isEditingPremissas}
                                    >
                                        <SelectTrigger id="tipoAssessor" className={!isEditingPremissas ? "bg-muted" : ""}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="B2B">B2B</SelectItem>
                                            <SelectItem value="MINST">MINST</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card com gráficos de projeções - só mostra se tem premissas */}
                    {premissasAnoAtual && (
                        <PremissasCard 
                            premissas={premissasAnoAtual}
                            config={premissasConfig}
                            interactions={interactions ?? []}
                        />
                    )}
                </>
            )}
        </>
      )}

      {selectedEmployee && (
        <DiagnosisFormDialog 
            open={isDiagnosisFormOpen}
            onOpenChange={setIsDiagnosisFormOpen}
            employee={selectedEmployee}
        />
      )}
    </div>
  );
}
