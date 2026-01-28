"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import type { Employee, Premissas } from "@/lib/types";

interface PremissasFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  premissas?: Premissas; // Se passado, entra em modo edição
}

/**
 * Detecta automaticamente o tipo de assessor baseado no cargo
 */
function detectarTipoAssessor(position?: string): "B2B" | "MINST" | null {
  if (!position) return null;
  
  const positionLower = position.toLowerCase();
  
  if (positionLower.includes('minst')) return 'MINST';
  if (positionLower.includes('b2b')) return 'B2B';
  
  return null; // Não é assessor (ex: Operador)
}

/**
 * Formata número com separadores de milhar (ex: 1000000 → 1.000.000)
 * Funciona durante a digitação
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

export function PremissasFormDialog({ open, onOpenChange, employee, premissas }: PremissasFormDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const tipoDetectado = detectarTipoAssessor(employee.position);
  const currentYear = new Date().getFullYear();
  const isEditMode = !!premissas;
  
  const [formData, setFormData] = useState({
    aucInicial: "",
    captacaoPrevista: "",
    churnPrevisto: "",
    roaPrevisto: "",
    tipoAssessor: tipoDetectado || "B2B" as "B2B" | "MINST",
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // Preencher form com dados existentes quando em modo edição
  useEffect(() => {
    if (open && premissas) {
      setFormData({
        aucInicial: formatarNumeroComSeparador(premissas.aucInicial),
        // Captação pode ser negativa, então preserva o sinal
        captacaoPrevista: formatarNumeroComSeparador(premissas.captacaoPrevista, true),
        churnPrevisto: premissas.churnPrevisto?.toString() || "",
        roaPrevisto: premissas.roaPrevisto?.toString() || "",
        tipoAssessor: premissas.tipoAssessor || tipoDetectado || "B2B",
      });
    } else if (open && !premissas) {
      // Reset form quando abre em modo criação
      setFormData({
        aucInicial: "",
        captacaoPrevista: "",
        churnPrevisto: "",
        roaPrevisto: "",
        tipoAssessor: tipoDetectado || "B2B",
      });
    }
  }, [open, premissas, tipoDetectado]);

  const handleCurrencyChange = (field: 'aucInicial' | 'captacaoPrevista', value: string) => {
    // Formata enquanto digita - remove não-numéricos e adiciona pontos
    // Captação permite valores negativos
    const permitirNegativo = field === 'captacaoPrevista';
    const formatado = formatarNumeroComSeparador(value, permitirNegativo);
    setFormData(prev => ({ ...prev, [field]: formatado }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firestore || !user) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Você precisa estar autenticado.",
      });
      return;
    }

    // Validações básicas
    const aucValue = parseNumeroFormatado(formData.aucInicial);
    const roaValue = parseFloat(formData.roaPrevisto) || 0;
    
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

    setIsSaving(true);

    try {
      const premissasData = {
        employeeId: employee.id,
        year: premissas?.year || currentYear,
        aucInicial: parseNumeroFormatado(formData.aucInicial),
        captacaoPrevista: parseNumeroFormatado(formData.captacaoPrevista),
        churnPrevisto: parseFloat(formData.churnPrevisto) || 0,
        roaPrevisto: parseFloat(formData.roaPrevisto),
        tipoAssessor: formData.tipoAssessor,
        updatedAt: Timestamp.now().toDate().toISOString(),
        updatedBy: user.email || "",
      };

      const year = premissas?.year || currentYear;

      if (isEditMode && premissas?.id) {
        // Modo edição: atualizar documento existente
        const premissasDocRef = doc(
          firestore,
          `employees/${employee.id}/premissas/${premissas.id}`
        );
        await updateDoc(premissasDocRef, premissasData);

        toast({
          title: "Plano Comercial Atualizado",
          description: `O plano comercial de ${employee.name} foi atualizado.`,
        });
      } else {
        // Modo criação: adicionar novo documento
        const premissasCollection = collection(
          firestore,
          `employees/${employee.id}/premissas`
        );
        
        await addDoc(premissasCollection, {
          ...premissasData,
          createdAt: Timestamp.now().toDate().toISOString(),
          createdBy: user.email || "",
        });

        toast({
          title: "Plano Comercial Criado",
          description: `O plano comercial de ${employee.name} para ${currentYear} foi salvo.`,
        });
      }

      // Registrar interação do tipo "Plano Comercial" no histórico do colaborador
      const interactionsCollection = collection(
        firestore,
        `employees/${employee.id}/interactions`
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

      onOpenChange(false);
      
      // Resetar form
      setFormData({
        aucInicial: "",
        captacaoPrevista: "",
        churnPrevisto: "",
        roaPrevisto: "",
        tipoAssessor: tipoDetectado || "B2B",
      });
    } catch (error) {
      console.error("Erro ao salvar plano comercial:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar o plano comercial. Tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Plano Comercial" : "Criar Plano Comercial"} - {employee.name}
          </DialogTitle>
          <DialogDescription>
            Configure as premissas e metas anuais para {premissas?.year || currentYear}.
            {tipoDetectado && (
              <span className="block mt-1 text-sm font-medium text-primary">
                Tipo detectado: {tipoDetectado}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* AUC Inicial */}
            <div className="grid gap-2">
              <Label htmlFor="aucInicial">
                AUC Inicial (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aucInicial"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 1.000.000"
                required
                value={formData.aucInicial}
                onChange={(e) => handleCurrencyChange('aucInicial', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Assets Under Custody - Valor total de ativos sob gestão
              </p>
            </div>

            {/* Captação Prevista */}
            <div className="grid gap-2">
              <Label htmlFor="captacaoPrevista">Captação Prevista Mensal (R$)</Label>
              <Input
                id="captacaoPrevista"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 500.000"
                value={formData.captacaoPrevista}
                onChange={(e) => handleCurrencyChange('captacaoPrevista', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Meta de captação mensal de novos recursos
              </p>
            </div>

            {/* Churn Previsto */}
            <div className="grid gap-2">
              <Label htmlFor="churnPrevisto">Churn Previsto Mensal (%)</Label>
              <Input
                id="churnPrevisto"
                type="number"
                step="0.01"
                placeholder="Ex: 2"
                value={formData.churnPrevisto}
                onChange={(e) => setFormData(prev => ({ ...prev, churnPrevisto: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Expectativa de saída de recursos mensal (em % do AUC)
              </p>
            </div>

            {/* ROA Previsto */}
            <div className="grid gap-2">
              <Label htmlFor="roaPrevisto">
                ROA Previsto Anual (%) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="roaPrevisto"
                type="number"
                step="0.01"
                placeholder="Ex: 0.4"
                required
                value={formData.roaPrevisto}
                onChange={(e) => setFormData(prev => ({ ...prev, roaPrevisto: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Return on Assets esperado anual (%)
              </p>
            </div>

            {/* Tipo de Assessor */}
            <div className="grid gap-2">
              <Label htmlFor="tipoAssessor">
                Tipo de Assessor <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.tipoAssessor}
                onValueChange={(value: "B2B" | "MINST") => setFormData(prev => ({ ...prev, tipoAssessor: value }))}
              >
                <SelectTrigger id="tipoAssessor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="MINST">MINST</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tipoDetectado
                  ? `Detectado automaticamente como ${tipoDetectado}. Você pode alterar se necessário.`
                  : "Selecione o tipo de assessor para cálculo de receita."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : isEditMode ? "Salvar Alterações" : "Criar Plano Comercial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
