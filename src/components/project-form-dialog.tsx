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
  FormDescription,
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
import { Textarea } from "./ui/textarea";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Project } from "@/lib/types";
import { ProjectErrors, mapFirestoreError, logValidationError, logProjectSuccess } from "@/lib/project-errors";
import { canUserCreateProjects } from "@/hooks/use-user-projects";
import { EmployeeSelectionDialog } from "@/components/employee-selection-dialog";
import { Users } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres."),
  leaderId: z.string().optional(), // Admin seleciona o líder
  memberIds: z.array(z.string()).min(1, "Selecione pelo menos um membro."),
});

type ProjectFormData = z.infer<typeof formSchema>;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  employees: Employee[];
  currentUser: Employee;
  isAdminMode?: boolean; // Se true, admin pode selecionar líder
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  employees,
  currentUser,
  isAdminMode = false,
}: ProjectFormDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);
  
  const isEditMode = !!project?.id;

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      leaderId: project?.leaderId || "",
      memberIds: project?.memberIds || [],
    },
  });

  const selectedMemberIds = form.watch("memberIds");

  const handleSubmit = async (data: ProjectFormData) => {
    console.log('🚀 [CREATE_PROJECT] Iniciando criação/edição de projeto', { name: data.name, isEditMode, isAdminMode });

    // Validação: Admin mode ou permissão normal
    if (!isAdminMode) {
      if (!canUserCreateProjects(currentUser)) {
        logValidationError('userPermission', currentUser?.role, 'Líder, Diretor ou Admin');
        toast({
          variant: "destructive",
          title: ProjectErrors.PERMISSION_NOT_LEADER.title,
          description: ProjectErrors.PERMISSION_NOT_LEADER.message,
        });
        return;
      }

      // Validação de líder do projeto (apenas em edição)
      if (isEditMode && project && project.leaderEmail !== currentUser.email) {
        logValidationError('projectOwner', currentUser.email, project.leaderEmail);
        toast({
          variant: "destructive",
          title: ProjectErrors.PERMISSION_NOT_PROJECT_OWNER.title,
          description: ProjectErrors.PERMISSION_NOT_PROJECT_OWNER.message,
        });
        return;
      }
    }

    // Validação de líder selecionado (apenas em admin mode)
    if (isAdminMode && !data.leaderId) {
      logValidationError('leaderId', data.leaderId, 'ID de líder válido');
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "Você deve selecionar um líder para o projeto.",
      });
      return;
    }

    // Validar membros
    if (data.memberIds.length === 0) {
      logValidationError('memberIds', data.memberIds, 'Array com pelo menos 1 elemento');
      toast({
        variant: "destructive",
        title: ProjectErrors.VALIDATION_NO_MEMBERS.title,
        description: ProjectErrors.VALIDATION_NO_MEMBERS.message,
      });
      return;
    }

    // Construir memberEmails a partir dos memberIds
    const selectedMembers = employees.filter(emp => data.memberIds.includes(emp.id));
    const memberEmails = selectedMembers.map(emp => emp.email);

    console.log('📝 [CREATE_PROJECT] Membros selecionados:', {
      count: selectedMembers.length,
      memberIds: data.memberIds,
      memberEmails,
    });

    if (selectedMembers.length !== data.memberIds.length) {
      logValidationError('memberIds', data.memberIds.length, selectedMembers.length);
      toast({
        variant: "destructive",
        title: ProjectErrors.VALIDATION_MEMBER_NOT_FOUND.title,
        description: ProjectErrors.VALIDATION_MEMBER_NOT_FOUND.message,
      });
      return;
    }

    setIsSaving(true);

    try {
      // Determinar líder do projeto
      let leaderData: { id: string; name: string; email: string };
      
      if (isAdminMode && data.leaderId) {
        // Admin selecionou um líder
        const selectedLeader = employees.find(e => e.id === data.leaderId);
        if (!selectedLeader) {
          throw new Error("Líder selecionado não encontrado");
        }
        leaderData = {
          id: selectedLeader.id,
          name: selectedLeader.name,
          email: selectedLeader.email,
        };
      } else {
        // Modo normal: currentUser é o líder
        leaderData = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        };
      }

      const projectData = {
        name: data.name,
        description: data.description,
        leaderId: leaderData.id,
        leaderName: leaderData.name,
        leaderEmail: leaderData.email,
        memberIds: data.memberIds,
        memberEmails,
        updatedAt: new Date().toISOString(),
        interactionConfig: {
          hasScoring: false, // Pontuação removida
          hasRanking: false, // Não usado mais
        },
      };

      if (isEditMode && project) {
        // Editar projeto existente
        console.log('💾 [UPDATE_PROJECT] Atualizando projeto no Firestore', { projectId: project.id });
        const projectRef = doc(firestore!, "projects", project.id);
        await updateDoc(projectRef, projectData);

        logProjectSuccess('Projeto atualizado com sucesso', { projectId: project.id });

        toast({
          title: "✅ Projeto Atualizado!",
          description: `O projeto "${data.name}" foi atualizado com sucesso.`,
        });
      } else {
        // Criar novo projeto
        console.log('💾 [CREATE_PROJECT] Salvando projeto no Firestore');
        const docRef = await addDoc(collection(firestore!, "projects"), {
          ...projectData,
          createdAt: new Date().toISOString(),
          isArchived: false,
        });

        logProjectSuccess('Projeto criado com sucesso', { projectId: docRef.id });

        toast({
          title: "✅ Projeto Criado!",
          description: `O projeto "${data.name}" foi criado com sucesso.`,
        });
      }

      form.reset();
      
      // Pequeno delay para garantir que o useCollection capture a mudança
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error: any) {
      const errorDetails = mapFirestoreError(error, isEditMode ? 'Atualizar Projeto' : 'Criar Projeto');

      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar Projeto" : "Criar Novo Projeto"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Atualize as informações do projeto abaixo."
              : "Preencha as informações para criar um novo projeto."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Nome do Projeto */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Projeto *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Expansão Regional Sul" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Líder do Projeto (apenas para Admin) */}
            {isAdminMode && (
              <FormField
                control={form.control}
                name="leaderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Líder do Projeto *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o líder do projeto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees
                          .filter(emp => emp.role === "Líder" || emp.isDirector || emp.isAdmin)
                          .map((leader) => (
                            <SelectItem key={leader.id} value={leader.id}>
                              {leader.name} - {leader.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecione o líder responsável pelo projeto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o objetivo e escopo do projeto..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seleção de Membros */}
            <FormField
              control={form.control}
              name="memberIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Membros do Projeto *</FormLabel>
                  <FormDescription>
                    Selecione os colaboradores que farão parte deste projeto
                  </FormDescription>

                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSelectionDialogOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {field.value.length > 0
                        ? `${field.value.length} membro(s) selecionado(s)`
                        : "Selecionar Membros"}
                    </Button>
                  </div>

                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? isEditMode
                    ? "Atualizando..."
                    : "Criando..."
                  : isEditMode
                  ? "Atualizar Projeto"
                  : "Criar Projeto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      <EmployeeSelectionDialog
        open={isSelectionDialogOpen}
        onOpenChange={setIsSelectionDialogOpen}
        allEmployees={employees}
        selectedIds={form.watch("memberIds")}
        onSelectionChange={(ids) => form.setValue("memberIds", ids)}
        isLoading={false}
        title="Selecionar Membros do Projeto"
      />
    </Dialog>
  );
}

