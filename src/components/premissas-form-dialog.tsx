"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import type { Employee, Premissas } from "@/lib/types";

interface PremissasFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
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

export function PremissasFormDialog({ open, onOpenChange, employee }: PremissasFormDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const tipoDetectado = detectarTipoAssessor(employee.position);
  const currentYear = new Date().getFullYear();
  
  const [formData, setFormData] = useState({
    aucInicial: "" as string | number,
    captacaoPrevista: "" as string | number,
    churnPrevisto: "" as string | number,
    roaPrevisto: "" as string | number,
    tipoAssessor: tipoDetectado || "B2B",
  });
  
  const [isSaving, setIsSaving] = useState(false);

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
    const aucValue = typeof formData.aucInicial === 'string' ? parseFloat(formData.aucInicial) : formData.aucInicial;
    const roaValue = typeof formData.roaPrevisto === 'string' ? parseFloat(formData.roaPrevisto) : formData.roaPrevisto;
    
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
      const premissasCollection = collection(
        firestore,
        `employees/${employee.id}/premissas`
      );

      const premissasData = {
        employeeId: employee.id,
        year: currentYear,
        aucInicial: typeof formData.aucInicial === 'string' ? parseFloat(formData.aucInicial) : formData.aucInicial,
        captacaoPrevista: typeof formData.captacaoPrevista === 'string' ? parseFloat(formData.captacaoPrevista) || 0 : formData.captacaoPrevista,
        churnPrevisto: typeof formData.churnPrevisto === 'string' ? parseFloat(formData.churnPrevisto) || 0 : formData.churnPrevisto,
        roaPrevisto: typeof formData.roaPrevisto === 'string' ? parseFloat(formData.roaPrevisto) : formData.roaPrevisto,
        tipoAssessor: formData.tipoAssessor,
        createdAt: Timestamp.now().toDate().toISOString(),
        createdBy: user.email || "",
      };

      await addDoc(premissasCollection, premissasData);

      toast({
        title: "Premissas Criadas",
        description: `As premissas de ${employee.name} para ${currentYear} foram salvas.`,
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
      console.error("Erro ao salvar premissas:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Não foi possível salvar as premissas. Tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Definir Premissas - {employee.name}</DialogTitle>
          <DialogDescription>
            Configure as premissas e metas anuais para {currentYear}.
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
                type="number"
                step="0.01"
                required
                value={formData.aucInicial}
                onChange={(e) => setFormData(prev => ({ ...prev, aucInicial: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Assets Under Custody - Valor total de ativos sob gestão
              </p>
            </div>

            {/* Captação Prevista */}
            <div className="grid gap-2">
              <Label htmlFor="captacaoPrevista">Captação Prevista Anual (R$)</Label>
              <Input
                id="captacaoPrevista"
                type="number"
                step="0.01"
                value={formData.captacaoPrevista}
                onChange={(e) => setFormData(prev => ({ ...prev, captacaoPrevista: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Meta de captação de novos recursos para o ano
              </p>
            </div>

            {/* Churn Previsto */}
            <div className="grid gap-2">
              <Label htmlFor="churnPrevisto">Churn Previsto Anual (R$)</Label>
              <Input
                id="churnPrevisto"
                type="number"
                step="0.01"
                value={formData.churnPrevisto}
                onChange={(e) => setFormData(prev => ({ ...prev, churnPrevisto: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Expectativa de saída de recursos no ano
              </p>
            </div>

            {/* ROA Previsto */}
            <div className="grid gap-2">
              <Label htmlFor="roaPrevisto">
                ROA Previsto (%) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="roaPrevisto"
                type="number"
                step="0.01"
                required
                value={formData.roaPrevisto}
                onChange={(e) => setFormData(prev => ({ ...prev, roaPrevisto: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Return on Assets esperado (%)
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
              {isSaving ? "Salvando..." : "Salvar Premissas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

