
"use client";

import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Diagnosis } from "@/lib/types";

const diagnosisSchema = z.object({
  status: z.enum(["Pendente", "Em Andamento", "Concluído"]),
  details: z.string().optional(),
});

type DiagnosisFormData = z.infer<typeof diagnosisSchema>;

interface DiagnosisFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

export function DiagnosisFormDialog({
  open,
  onOpenChange,
  employee,
}: DiagnosisFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditMode = !!employee.diagnosis;

  const form = useForm<DiagnosisFormData>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: {
      status: "Pendente",
      details: "",
    },
  });

  const getStorageKey = useCallback(() => `diagnosis-form-data-${employee.id}`, [employee.id]);

  useEffect(() => {
    if (open) {
      const savedData = localStorage.getItem(getStorageKey());
      if (savedData) {
        const data = JSON.parse(savedData);
        form.reset(data);
      } else if (employee.diagnosis) {
        form.reset({
          status: employee.diagnosis.status,
          details: employee.diagnosis.details || "",
        });
      } else {
        form.reset({
          status: "Pendente",
          details: "",
        });
      }
    }
  }, [employee, open, form, getStorageKey]);

  useEffect(() => {
    if (open) {
      const subscription = form.watch((value) => {
        localStorage.setItem(getStorageKey(), JSON.stringify(value));
      });
      return () => subscription.unsubscribe();
    }
  }, [open, form, getStorageKey]);

  const onSubmit = async (data: DiagnosisFormData) => {
    if (!firestore) return;

    const docRef = doc(firestore, "employees", employee.id);
    const diagnosisData: Diagnosis = {
        status: data.status,
        date: new Date().toISOString(),
        details: data.details || "",
    };

    try {
      await setDocumentNonBlocking(docRef, { diagnosis: diagnosisData }, { merge: true });
      toast({
        title: isEditMode ? "Diagnóstico Atualizado" : "Diagnóstico Adicionado",
        description: `O diagnóstico de ${employee.name} foi salvo com sucesso.`,
      });
      localStorage.removeItem(getStorageKey());
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao salvar diagnóstico:", e);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Ocorreu um erro ao salvar os dados. Verifique o console para detalhes.",
      });
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
      if (!isOpen) {
          const savedData = localStorage.getItem(getStorageKey());
          if (savedData) {
              const confirmClose = window.confirm("Você tem dados não salvos. Deseja realmente fechar?");
              if (!confirmClose) return;
          }
          localStorage.removeItem(getStorageKey());
      }
      onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Diagnóstico" : "Adicionar Diagnóstico"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? "Atualize" : "Adicione"} o diagnóstico profissional de {employee.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os pontos fortes, fracos e as oportunidades de desenvolvimento."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
