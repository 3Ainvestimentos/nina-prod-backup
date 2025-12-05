"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Employee, Interaction, N2IndividualNotes, QualityIndexNotes } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Timeline } from "@/components/timeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { N2IndividualFormDialog } from "@/components/n2-individual-form-dialog";
import { QualityIndexFormDialog } from "@/components/quality-index-form-dialog";
import { isSameMonth, isSameYear, parseISO } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];
// Conta de teste para desenvolvimento - REMOVER DEPOIS DOS TESTES
const testAccountEmail = 'tester@3ainvestimentos.com.br';

export default function LeaderTrackingPage() {
  const router = useRouter();
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [openN2Dialog, setOpenN2Dialog] = useState(false);
  const [openQualityDialog, setOpenQualityDialog] = useState(false);
  const [openFeedbackDialog, setOpenFeedbackDialog] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const interactionsCollection = useMemoFirebase(
    () => (firestore && selectedLeaderId ? collection(firestore, "employees", selectedLeaderId, "interactions") : null),
    [firestore, selectedLeaderId]
  );

  const { data: interactions, isLoading: areInteractionsLoading } = useCollection<Interaction>(interactionsCollection);
  
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
        // isDirector vem do documento do Firestore, não hardcoded
        role: 'Líder',
      } as Employee;
    }
    
    const employeeData = employees.find(e => e.email === user.email);
    if (!employeeData) return null;
    
    // isDirector deve vir apenas do documento do Firestore
    return employeeData;
  }, [user, employees]);

  // Filtrar apenas líderes do time comercial (excluindo líderes honorários como Katharyne e Daniel Miranda)
  // Inclui conta de teste se especificada
  const availableLeaders = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => 
      !(e as any)._isDeleted &&
      e.role === "Líder" && 
      (
        e.axis === "Comercial" ||
        (testAccountEmail && e.email === testAccountEmail)
      ) &&
      !e.name.toLowerCase().includes('katharyne') &&
      !e.name.toLowerCase().includes('daniel miranda')
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const selectedLeader = useMemo(() => {
    if (!selectedLeaderId || !employees) return null;
    return employees.find(e => e.id === selectedLeaderId) || null;
  }, [selectedLeaderId, employees]);

  // Verificar se é admin/diretor (incluindo emails hardcoded)
  const isAuthorized = useMemo(() => {
    // Se a autenticação ainda está carregando, considerar autorizado temporariamente para não mostrar alerta
    if (isUserLoading) return true;

    if (!user) return false;
    
    // Verificar emails hardcoded primeiro
    if (user.email && adminEmails.includes(user.email)) {
      return true;
    }
    
    // Se ainda está carregando dados do funcionário, retornar true temporariamente
    if (areEmployeesLoading) {
      return true;
    }
    
    // Verificar se o employee tem isAdmin ou isDirector
    if (currentUserEmployee) {
      return !!(currentUserEmployee.isAdmin || currentUserEmployee.isDirector);
    }
    
    // Se os dados carregaram mas não encontrou o employee, não está autorizado
    return false;
  }, [user, isUserLoading, currentUserEmployee, areEmployeesLoading]);

  // VALIDAÇÃO DE ACESSO: Apenas Diretores e Admins
  // Não redirecionar automaticamente - se o usuário consegue ver as abas, ele pode usar
  // O redirecionamento só acontece se o usuário tentar acessar diretamente a URL sem permissão

  // Mostrar loading enquanto carrega dados ou autenticação
  if (areEmployeesLoading || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Se não está autorizado, não renderizar conteúdo
  // Não mostrar se user for null (logout em andamento ou não logado)
  if (!areEmployeesLoading && !isUserLoading && !isAuthorized && user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Você não tem permissão para acessar esta página. Apenas Diretores e Administradores podem acompanhar líderes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleLeaderChange = (id: string) => {
    setSelectedLeaderId(id);
  };

  const handleSaveN2 = async (notes: N2IndividualNotes) => {
    if (!interactionsCollection || !user || !selectedLeader || !interactions) {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "Não foi possível salvar, tente novamente.",
      });
      return;
    }

    setIsSaving(true);

    const now = new Date();
    const hasExistingN2 = interactions.some(
      (interaction) =>
        interaction.type === 'N2 Individual' &&
        isSameMonth(parseISO(interaction.date), now) &&
        isSameYear(parseISO(interaction.date), now)
    );

    if (hasExistingN2) {
      toast({
        variant: "destructive",
        title: "Registro Duplicado",
        description: `Uma interação "N2 Individual" já foi registrada para este líder no mês corrente.`,
      });
      setIsSaving(false);
      return;
    }

    const interactionToSave: Partial<Interaction> = {
      type: 'N2 Individual',
      notes,
      authorId: user.uid,
      date: new Date().toISOString(),
    };

    try {
      await addDoc(interactionsCollection, interactionToSave);
      toast({
        title: "Interação Salva!",
        description: "O registro N2 Individual foi salvo com sucesso.",
      });
      setOpenN2Dialog(false);
    } catch (error) {
      console.error("[LeaderTracking] Erro ao salvar N2:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a interação. Verifique as permissões e tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuality = async (notes: QualityIndexNotes) => {
    if (!interactionsCollection || !user || !selectedLeader || !interactions) {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "Não foi possível salvar, tente novamente.",
      });
      return;
    }

    setIsSaving(true);

    const now = new Date();
    const hasExistingQuality = interactions.some(
      (interaction) =>
        interaction.type === 'Índice de Qualidade' &&
        isSameMonth(parseISO(interaction.date), now) &&
        isSameYear(parseISO(interaction.date), now)
    );

    if (hasExistingQuality) {
      toast({
        variant: "destructive",
        title: "Registro Duplicado",
        description: `Uma interação "Índice de Qualidade" já foi registrada para este líder no mês corrente.`,
      });
      setIsSaving(false);
      return;
    }

    const interactionToSave: Partial<Interaction> = {
      type: 'Índice de Qualidade',
      notes,
      qualityScore: notes.qualityScore,
      authorId: user.uid,
      date: new Date().toISOString(),
    };

    try {
      await addDoc(interactionsCollection, interactionToSave);
      toast({
        title: "Interação Salva!",
        description: "O registro de Índice de Qualidade foi salvo com sucesso.",
      });
      setOpenQualityDialog(false);
    } catch (error) {
      console.error("[LeaderTracking] Erro ao salvar Índice de Qualidade:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a interação. Verifique as permissões e tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!interactionsCollection || !user || !selectedLeader || !interactions) {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "Não foi possível salvar, tente novamente.",
      });
      return;
    }

    if (feedbackNotes.trim() === '') {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "As anotações não podem estar vazias.",
      });
      return;
    }

    setIsSaving(true);

    const interactionToSave: Partial<Interaction> = {
      type: 'Feedback',
      notes: feedbackNotes,
      authorId: user.uid,
      date: new Date().toISOString(),
    };

    try {
      await addDoc(interactionsCollection, interactionToSave);
      toast({
        title: "Interação Salva!",
        description: "O registro de Feedback foi salvo com sucesso.",
      });
      setOpenFeedbackDialog(false);
      setFeedbackNotes("");
    } catch (error) {
      console.error("[LeaderTracking] Erro ao salvar Feedback:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a interação. Verifique as permissões e tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Seleção de Líder</CardTitle>
          <CardDescription>
            Escolha um líder do time comercial para visualizar ou registrar interações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            onValueChange={handleLeaderChange}
            value={selectedLeaderId ?? ""}
            disabled={areEmployeesLoading}
          >
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder={areEmployeesLoading ? "Carregando..." : "Selecione um líder"} />
            </SelectTrigger>
            <SelectContent>
              {availableLeaders.map((leader) => (
                <SelectItem key={leader.id} value={leader.id}>
                  {leader.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedLeader && (
        <Card>
          <CardHeader>
            <CardTitle>Acompanhamento de {selectedLeader.name}</CardTitle>
            <CardDescription>
              Visualize o histórico de interações e registre novas interações.
            </CardDescription>
            <div className="flex gap-2 mt-4">
              <Dialog open={openN2Dialog} onOpenChange={setOpenN2Dialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    N2 Individual
                  </Button>
                </DialogTrigger>
                <N2IndividualFormDialog
                  open={openN2Dialog}
                  onOpenChange={setOpenN2Dialog}
                  employee={selectedLeader}
                  onSave={handleSaveN2}
                  isSaving={isSaving}
                />
              </Dialog>

              <Dialog open={openQualityDialog} onOpenChange={setOpenQualityDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Índice de Qualidade
                  </Button>
                </DialogTrigger>
                <QualityIndexFormDialog
                  open={openQualityDialog}
                  onOpenChange={setOpenQualityDialog}
                  employee={selectedLeader}
                  onSave={handleSaveQuality}
                  isSaving={isSaving}
                />
              </Dialog>

              <Dialog open={openFeedbackDialog} onOpenChange={setOpenFeedbackDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Feedback
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Feedback</DialogTitle>
                    <DialogDescription>
                      Registre um feedback para o líder {selectedLeader.name}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="feedback-notes">Anotações</Label>
                      <Textarea
                        id="feedback-notes"
                        placeholder="Digite o feedback..."
                        value={feedbackNotes}
                        onChange={(e) => setFeedbackNotes(e.target.value)}
                        disabled={isSaving}
                        rows={6}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenFeedbackDialog(false)} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveFeedback} disabled={isSaving || feedbackNotes.trim() === ''}>
                      {isSaving ? "Salvando..." : "Salvar Feedback"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Timeline interactions={interactions ?? []} isLoading={areInteractionsLoading} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

