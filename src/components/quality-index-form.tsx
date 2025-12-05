"use client";

import { useState, useMemo, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Employee, QualityIndexNotes } from "@/lib/types";
import { cn } from "@/lib/utils";

const qualityCategories = [
  { 
    id: "performanceTime", 
    label: "Performance TIME",
    weight: 2, 
    red: "Dificuldade em atingir as metas do TIME", 
    neutral: "Atingiu as metas do TIME (100% do target)", 
    green: "Superação consistente das metas do TIME" 
  },
  { 
    id: "relacionamentoTime", 
    label: "Relacionamento TIME",
    weight: 1, 
    red: "Dificuldades de relacionamento com o TIME", 
    neutral: "Relacionamento adequado com o TIME", 
    green: "Excelente relacionamento e liderança do TIME" 
  },
  { 
    id: "remuneracao", 
    label: "Remuneração",
    weight: 3, 
    red: "Remuneração abaixo da referência", 
    neutral: "Remuneração na referência de mercado/função", 
    green: "Remuneração acima da referência" 
  },
  { 
    id: "desenvolvimentoTecnico", 
    label: "Desenvolvimento Técnico",
    weight: 1, 
    red: "Resistência a feedback e a novas práticas técnicas", 
    neutral: "Aceita feedback e implementa o básico", 
    green: "Busca proativa por feedback e implementação imediata" 
  },
  { 
    id: "processosGestao", 
    label: "Processos de Gestão",
    weight: 1, 
    red: "Dificuldades com ferramentas ou processos de gestão", 
    neutral: "Utiliza ferramentas e segue processos corretamente", 
    green: "Domínio das ferramentas e processos de gestão" 
  },
  { 
    id: "aderenciaCampanhas", 
    label: "Aderência a Campanhas",
    weight: 2, 
    red: "Baixa aderência às campanhas e iniciativas", 
    neutral: "Aderência adequada às campanhas", 
    green: "Alta aderência e engajamento com campanhas" 
  },
];

type Selections = {
  [key: string]: "red" | "neutral" | "green";
};

const SCORES = { red: -1, neutral: 0, green: 1 };

interface QualityIndexFormProps {
  employee: Employee;
  onSave: (notes: QualityIndexNotes) => Promise<void>;
  isSaving: boolean;
  id?: string;
}

export function QualityIndexForm({ employee, onSave, isSaving, id }: QualityIndexFormProps) {
  const [selections, setSelections] = useState<Selections>({});

  // Initialize selections with neutral
  useEffect(() => {
    const initialSelections: Selections = {};
    qualityCategories.forEach(category => {
      initialSelections[category.id] = "neutral";
    });
    setSelections(initialSelections);
  }, []);

  const qualityScore = useMemo(() => {
    return qualityCategories.reduce((sum, category) => {
      const selectionValue = selections[category.id];
      if (selectionValue) {
        const score = SCORES[selectionValue];
        return sum + (score * category.weight);
      }
      return sum;
    }, 0);
  }, [selections]);

  const handleSelectionChange = (categoryId: string, value: "red" | "neutral" | "green") => {
    setSelections(prev => ({ ...prev, [categoryId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const notes: QualityIndexNotes = {
      performanceTime: selections.performanceTime || "neutral",
      relacionamentoTime: selections.relacionamentoTime || "neutral",
      remuneracao: selections.remuneracao || "neutral",
      desenvolvimentoTecnico: selections.desenvolvimentoTecnico || "neutral",
      processosGestao: selections.processosGestao || "neutral",
      aderenciaCampanhas: selections.aderenciaCampanhas || "neutral",
      qualityScore,
    };
    onSave(notes);
  };
  
  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-green-600';
    if (score < 0) return 'text-destructive';
    return 'text-muted-foreground';
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="space-y-6">
        {qualityCategories.map((category, index) => (
          <div key={category.id}>
            <h3 className="font-medium mb-3">{category.label}</h3>
            <RadioGroup
              value={selections[category.id] || "neutral"}
              onValueChange={(value) => handleSelectionChange(category.id, value as "red" | "neutral" | "green")}
              className="grid grid-cols-3 gap-4"
            >
              <Label className={cn("flex flex-col items-start justify-start rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer", selections[category.id] === 'red' && "border-destructive")}>
                <RadioGroupItem value="red" id={`${category.id}-red`} className="sr-only" />
                <span className="font-semibold text-destructive mb-2">Red Flag (-{category.weight})</span>
                <span className="text-sm">{category.red}</span>
              </Label>
              <Label className={cn("flex flex-col items-start justify-start rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer", selections[category.id] === 'neutral' && "border-primary")}>
                <RadioGroupItem value="neutral" id={`${category.id}-neutral`} className="sr-only" />
                <span className="font-semibold text-muted-foreground mb-2">Neutro (0)</span>
                <span className="text-sm">{category.neutral}</span>
              </Label>
              <Label className={cn("flex flex-col items-start justify-start rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer", selections[category.id] === 'green' && "border-green-600")}>
                <RadioGroupItem value="green" id={`${category.id}-green`} className="sr-only" />
                <span className="font-semibold text-green-600 mb-2">Green Flag (+{category.weight})</span>
                <span className="text-sm">{category.green}</span>
              </Label>
            </RadioGroup>
            {index < qualityCategories.length - 1 && <Separator className="mt-6" />}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-lg font-bold">
            Índice de Qualidade Total: <span className={cn("font-extrabold", getScoreColor(qualityScore))}>{qualityScore}</span>
        </div>
      </div>
    </form>
  );
}

