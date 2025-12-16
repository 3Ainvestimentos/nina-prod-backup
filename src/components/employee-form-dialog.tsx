
"use client";

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
import { Input } from "./ui/input";
import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Role } from "@/lib/types";

const formSchema = z.object({
  id3a: z.string().min(1, "O ID externo é obrigatório."),
  name: z.string().min(1, "O nome é obrigatório."),
  email: z.string().email("O email é inválido."),
  position: z.string().optional(),
  axis: z.string().optional(),
  area: z.string().optional(),
  segment: z.string().optional(),
  leaderId: z.string().optional(),
  city: z.string().optional(),
  role: z.string().optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
});

type EmployeeFormData = z.infer<typeof formSchema>;

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
  leaders: Employee[];
  roles: Role[];
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  leaders,
  roles,
}: EmployeeFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditMode = !!employee?.id;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id3a: "",
      name: "",
      email: "",
      position: "",
      axis: "",
      area: "",
      segment: "",
      leaderId: "no-leader",
      city: "",
      role: "Colaborador",
      photoURL: "",
    },
  });

  const getStorageKey = useCallback(() => `employee-form-data-${employee?.id || 'new'}`, [employee]);

  useEffect(() => {
    if (open) {
      const savedData = localStorage.getItem(getStorageKey());
      if (savedData) {
        form.reset(JSON.parse(savedData));
      } else if (employee) {
        form.reset({
          id3a: employee.id3a || "",
          name: employee.name || "",
          email: employee.email || "",
          position: employee.position || "",
          axis: employee.axis || "",
          area: employee.area || "",
          segment: employee.segment || "",
          leaderId: employee.leaderId || "no-leader",
          city: employee.city || "",
          role: employee.role || "Colaborador",
          photoURL: employee.photoURL || "",
        });
      } else {
        form.reset(form.formState.defaultValues);
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


  const onSubmit = async (data: EmployeeFormData) => {
    if (!firestore) return;

    const docId = isEditMode ? employee.id : data.id3a;
    const docRef = doc(firestore, "employees", docId);
    
    const isNoLeader = data.leaderId === "no-leader";
    const selectedLeader = isNoLeader ? undefined : leaders.find(l => l.id === data.leaderId);

    const dataToSave: Partial<Employee> = {
        ...data,
        role: data.role as Role | undefined,
        leaderId: isNoLeader ? "" : selectedLeader?.id || "",
        leader: isNoLeader ? "" : selectedLeader?.name || "",
        leaderEmail: isNoLeader ? "" : selectedLeader?.email || ""
    };
    
    try {
      await setDocumentNonBlocking(docRef, dataToSave, isEditMode ? { merge: true } : {});
      toast({
        title: isEditMode ? "Funcionário Atualizado" : "Funcionário Adicionado",
        description: `Os dados de ${data.name} foram salvos com sucesso.`,
      });
      localStorage.removeItem(getStorageKey());
      onOpenChange(false);
    } catch (e) {
      console.error("Erro ao salvar funcionário:", e);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description:
          "Ocorreu um erro ao salvar os dados. Verifique o console para detalhes.",
      });
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        localStorage.removeItem(getStorageKey());
    }
    onOpenChange(isOpen);
  }

  const dialogTitle = isEditMode ? "Editar Funcionário" : "Adicionar Funcionário";
  const dialogDescription = `Preencha os campos abaixo para ${isEditMode ? "atualizar os dados do" : "adicionar um novo"} funcionário.`;


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="id3a"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Externo (id3a)</FormLabel>
                  <FormControl>
                    <Input placeholder="ID único do funcionário" {...field} disabled={isEditMode} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do funcionário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@empresa.com.br" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Analista de RH" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="axis"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Eixo</FormLabel>
                    <FormControl>
                        <Input placeholder="Ex: Operações" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Área</FormLabel>
                    <FormControl>
                        <Input placeholder="Ex: Tecnologia" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="segment"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Segmento</FormLabel>
                    <FormControl>
                        <Input placeholder="Ex: Varejo" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                        <Input placeholder="Ex: São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="leaderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Líder</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um líder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="no-leader">Sem Líder</SelectItem>
                      {leaders
                        .filter(l => l.id !== employee?.id) // Cannot be their own leader
                        .map((leader) => (
                        <SelectItem key={leader.id} value={leader.id}>
                          {leader.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((roleName) => (
                        <SelectItem key={roleName} value={roleName}>
                          {roleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="photoURL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Foto</FormLabel>
                  <FormControl>
                    <Input placeholder="https://exemplo.com/foto.jpg" {...field} />
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
