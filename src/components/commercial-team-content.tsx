"use client";

import { useState, useMemo } from "react";
import type { Employee, Interaction } from "@/lib/types";
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
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { Timeline } from "@/components/timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { Plus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { isSameMonth, isSameYear, parseISO } from "date-fns";

interface CommercialTeamContentProps {
  employees?: Employee[];
  currentUserEmployee?: Employee | null;
  areEmployeesLoading?: boolean;
}

export function CommercialTeamContent({
  employees: propEmployees,
  currentUserEmployee: propCurrentUserEmployee,
  areEmployeesLoading: propAreEmployeesLoading,
}: CommercialTeamContentProps) {
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<
    "Análise do Índice de Qualidade" | "Análise do Índice de Risco"
  >("Análise do Índice de Qualidade");
  const [isInteractionDialogOpen, setIsInteractionDialogOpen] = useState(false);
  const [selectedInteractionType, setSelectedInteractionType] = useState<
    "Análise do Índice de Qualidade" | "Análise do Índice de Risco"
  >("Análise do Índice de Qualidade");
  const [analysisConfirmed, setAnalysisConfirmed] = useState(false);
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // Verificar se é diretor/admin
  const isDirectorOrAdmin =
    propCurrentUserEmployee?.isDirector || propCurrentUserEmployee?.isAdmin;

  // Carregar interações do diretor atual
  const directorInteractionsCollection = useMemoFirebase(
    () =>
      firestore && propCurrentUserEmployee?.id
        ? collection(
            firestore,
            "employees",
            propCurrentUserEmployee.id,
            "interactions"
          )
        : null,
    [firestore, propCurrentUserEmployee?.id]
  );

  const {
    data: allInteractions,
    isLoading: areInteractionsLoading,
  } = useCollection<Interaction>(directorInteractionsCollection);

  // Filtrar interações pelo tipo selecionado
  const filteredInteractions = useMemo(() => {
    if (!allInteractions) return [];
    return allInteractions
      .filter((interaction) => interaction.type === selectedAnalysisType)
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // Mais recente primeiro
      });
  }, [allInteractions, selectedAnalysisType]);

  // Salvar análise global
  const handleSaveGlobalAnalysis = async () => {
    if (!firestore || !propCurrentUserEmployee?.id || !user || !allInteractions) {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "Não foi possível salvar, tente novamente.",
      });
      return;
    }

    if (!analysisConfirmed) {
      toast({
        variant: "destructive",
        title: "Confirmação Necessária",
        description: "Por favor, confirme que realizou esta análise.",
      });
      return;
    }

    setIsSaving(true);

    const directorInteractionsCollection = collection(
      firestore,
      "employees",
      propCurrentUserEmployee.id,
      "interactions"
    );

    const now = new Date();

    // Verificar se já existe uma análise deste tipo no mês atual
    try {
      const q = query(
        directorInteractionsCollection,
        where("type", "==", selectedInteractionType)
      );
      const snapshot = await getDocs(q);

      const hasExisting = snapshot.docs.some((doc) => {
        const data = doc.data() as Partial<Interaction>;
        if (!data.date) return false;
        const interactionDate = parseISO(data.date);
        return (
          isSameMonth(interactionDate, now) &&
          isSameYear(interactionDate, now)
        );
      });

      if (hasExisting) {
        toast({
          variant: "destructive",
          title: "Registro Duplicado",
          description: `Uma análise "${selectedInteractionType}" já foi registrada para este mês.`,
        });
        setIsSaving(false);
        return;
      }
    } catch (error) {
      console.error("[CommercialTeam] Erro ao verificar duplicatas:", error);
    }

    const interactionToSave: Partial<Interaction> = {
      type: selectedInteractionType as 'Análise do Índice de Qualidade' | 'Análise do Índice de Risco',
      notes: analysisNotes.trim() || '',
      authorId: user.uid,
      date: now.toISOString(),
    };

    try {
      await addDoc(directorInteractionsCollection, interactionToSave);
      toast({
        title: "Análise Registrada!",
        description: `A análise "${selectedInteractionType}" foi registrada com sucesso.`,
      });
      setIsInteractionDialogOpen(false);
      setAnalysisConfirmed(false);
      setAnalysisNotes("");
    } catch (error) {
      console.error("[CommercialTeam] Erro ao salvar análise global:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a análise. Verifique as permissões e tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };


  if (!isDirectorOrAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acesso Restrito</CardTitle>
          <CardDescription>
            Esta área é exclusiva para Diretores e Administradores.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Equipe Comercial</CardTitle>
              <CardDescription>
                Visualize o histórico mensal das análises globais dos índices.
              </CardDescription>
            </div>
            <Dialog open={isInteractionDialogOpen} onOpenChange={setIsInteractionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Interação
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Registrar Nova Análise</DialogTitle>
                  <DialogDescription>
                    Registre uma nova análise global dos índices.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-6">
                  <div className="space-y-2">
                    <Label htmlFor="interaction-type">Tipo de Análise</Label>
                    <Select
                      value={selectedInteractionType}
                      onValueChange={(value) =>
                        setSelectedInteractionType(
                          value as
                            | "Análise do Índice de Qualidade"
                            | "Análise do Índice de Risco"
                        )
                      }
                    >
                      <SelectTrigger id="interaction-type">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Análise do Índice de Qualidade">
                          Análise do Índice de Qualidade
                        </SelectItem>
                        <SelectItem value="Análise do Índice de Risco">
                          Análise do Índice de Risco
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="analysis-confirmed"
                        checked={analysisConfirmed}
                        onCheckedChange={(checked) => setAnalysisConfirmed(checked === true)}
                        disabled={isSaving}
                      />
                      <Label htmlFor="analysis-confirmed" className="text-sm font-medium cursor-pointer">
                        Confirmo que realizei esta análise
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="analysis-notes">Anotações (opcional)</Label>
                      <Textarea
                        id="analysis-notes"
                        placeholder="Digite anotações sobre a análise..."
                        value={analysisNotes}
                        onChange={(e) => setAnalysisNotes(e.target.value)}
                        disabled={isSaving}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInteractionDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveGlobalAnalysis}
                    type="button"
                    disabled={!selectedInteractionType || !analysisConfirmed || isSaving}
                  >
                    {isSaving ? "Salvando..." : "Salvar Interação"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Tipo de Análise
              </label>
              <Select
                value={selectedAnalysisType}
                onValueChange={(value) =>
                  setSelectedAnalysisType(
                    value as
                      | "Análise do Índice de Qualidade"
                      | "Análise do Índice de Risco"
                  )
                }
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Selecione o tipo de análise" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  sideOffset={4}
                  align="start"
                >
                  <SelectItem value="Análise do Índice de Qualidade">
                    Análise do Índice de Qualidade
                  </SelectItem>
                  <SelectItem value="Análise do Índice de Risco">
                    Análise do Índice de Risco
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de {selectedAnalysisType}</CardTitle>
          <CardDescription>
            Linha do tempo das análises realizadas, agrupadas por mês.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {areInteractionsLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-3 w-[80px]" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Timeline
              interactions={filteredInteractions}
              isLoading={areInteractionsLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

