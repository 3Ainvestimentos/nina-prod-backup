
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFirestore } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import type { PDIAction } from "@/lib/types";
import DOMPurify from "dompurify";

const sanitize = (text: string) => {
  if (typeof window === 'undefined') return text;
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

const actionSchema = z.object({
  description: z.string().min(1, "A descrição da ação é obrigatória."),
  startDate: z.date({
    required_error: "A data de início é obrigatória.",
  }),
  endDate: z.date({
    required_error: "A data de prazo é obrigatória.",
  }),
  status: z.enum(["To Do", "In Progress", "Completed"]),
});

type ActionFormData = z.infer<typeof actionSchema>;

interface PdiActionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  action?: PDIAction;
}

export function PdiActionFormDialog({
  open,
  onOpenChange,
  employeeId,
  action,
}: PdiActionFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditMode = !!action;

  const form = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      description: "",
      status: "To Do",
    },
  });

  const getStorageKey = useCallback(() => `pdi-action-form-data-${employeeId}-${action?.id || 'new'}`, [employeeId, action]);

  useEffect(() => {
    if (open) {
      const savedData = localStorage.getItem(getStorageKey());
      if (savedData) {
        const data = JSON.parse(savedData);
        // Dates need to be converted back to Date objects
        if (data.startDate) data.startDate = new Date(data.startDate);
        if (data.endDate) data.endDate = new Date(data.endDate);
        form.reset(data);
      } else if (action) {
        form.reset({
          description: action.description,
          status: action.status,
          startDate: new Date(action.startDate),
          endDate: new Date(action.endDate),
        });
      } else {
        form.reset({
          description: "",
          status: "To Do",
          startDate: undefined,
          endDate: undefined,
        });
      }
    }
  }, [action, open, form, getStorageKey]);

  useEffect(() => {
    if (open) {
      const subscription = form.watch((value) => {
        localStorage.setItem(getStorageKey(), JSON.stringify(value));
      });
      return () => subscription.unsubscribe();
    }
  }, [open, form, getStorageKey]);

  const onSubmit = async (data: ActionFormData) => {
    if (!firestore) return;
    
    const collectionRef = collection(firestore, "employees", employeeId, "pdiActions");
    const docId = isEditMode ? action.id : doc(collectionRef).id;
    const docRef = doc(collectionRef, docId);

    const actionData: PDIAction = {
        ...data,
        description: sanitize(data.description),
        id: docId,
        employeeId: employeeId,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
    };

    try {
      await setDocumentNonBlocking(docRef, actionData, { merge: isEditMode });
      toast({
        title: isEditMode ? "Ação PDI Atualizada" : "Ação PDI Adicionada",
        description: `A ação foi salva com sucesso.`,
      });
      localStorage.removeItem(getStorageKey());
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao salvar ação PDI:", e);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: "Ocorreu um erro ao salvar a ação. Verifique o console para detalhes.",
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        localStorage.removeItem(getStorageKey());
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Ação PDI" : "Adicionar Ação PDI"}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos para {isEditMode ? "atualizar a" : "adicionar uma nova"} ação no PDI.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ação</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva a ação de desenvolvimento."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="To Do">A Fazer</SelectItem>
                      <SelectItem value="In Progress">Em Progresso</SelectItem>
                      <SelectItem value="Completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
             />
             <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Data de Prazo</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
             />
             </div>
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
