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
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFirestore, useUser } from "@/firebase";
import {
  projectInteractionFormSchema,
  type ProjectInteractionFormData,
} from "@/lib/schemas";
import { collection, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Project, ProjectInteractionNotes } from "@/lib/types";
import { ProjectErrors, mapFirestoreError, logValidationError, logProjectSuccess } from "@/lib/project-errors";
import { isProjectLeader } from "@/hooks/use-user-projects";
import DOMPurify from "dompurify";

const sanitize = (text: string) => {
  if (typeof window === 'undefined') return text;
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

interface ProjectInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  projectMembers: Employee[];
  currentUser: Employee;
  preSelectedMemberId?: string; // ID do membro já selecionado (opcional)
}

export function ProjectInteractionDialog({
  open,
  onOpenChange,
  project,
  projectMembers,
  currentUser,
  preSelectedMemberId,
}: ProjectInteractionDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProjectInteractionFormData>({
    resolver: zodResolver(projectInteractionFormSchema),
    defaultValues: {
      type: "1:1",
      targetMemberId: preSelectedMemberId || "",
      content: "",
      indicator: "",
    },
  });

  const handleSubmit = async (data: ProjectInteractionFormData) => {
    console.log('🚀 [PROJECT_INTERACTION] Iniciando criação de interação', {
      projectId: project.id,
      type: data.type,
    });

    // Validação de permissão
    if (!isProjectLeader(project, currentUser)) {
      logValidationError('projectLeader', currentUser.email, project.leaderEmail);
      toast({
        variant: "destructive",
        title: ProjectErrors.PERMISSION_CANNOT_ADD_INTERACTION.title,
        description: ProjectErrors.PERMISSION_CANNOT_ADD_INTERACTION.message,
      });
      return;
    }

    // Validação de membro
    if (!data.targetMemberId) {
      logValidationError('targetMemberId', data.targetMemberId, 'ID de membro válido');
      toast({
        variant: "destructive",
        title: ProjectErrors.VALIDATION_INTERACTION_NO_MEMBER.title,
        description: ProjectErrors.VALIDATION_INTERACTION_NO_MEMBER.message,
      });
      return;
    }

    // Validar conteúdo
    if (!data.content || data.content.trim().length < 5) {
      logValidationError('content', data.content, 'String com pelo menos 5 caracteres');
      toast({
        variant: "destructive",
        title: ProjectErrors.VALIDATION_INTERACTION_EMPTY_NOTES.title,
        description: ProjectErrors.VALIDATION_INTERACTION_EMPTY_NOTES.message,
      });
      return;
    }

    setIsSaving(true);

    try {
      const interactionsRef = collection(firestore!, "projects", project.id, "interactions");
      
      // Buscar membro selecionado
      const targetMember = projectMembers.find(m => m.id === data.targetMemberId);
      if (!targetMember) {
        throw new Error("Membro selecionado não encontrado");
      }

      // Construir notas da interação
      const notes: ProjectInteractionNotes = {
        content: sanitize(data.content),
        indicator: data.indicator ? sanitize(data.indicator) : undefined,
      };

      const interactionData = {
        projectId: project.id,
        type: "1:1" as const,
        date: new Date().toISOString(),
        authorId: currentUser.id,
        authorEmail: currentUser.email,
        targetMemberId: targetMember.id,
        targetMemberName: targetMember.name,
        targetMemberEmail: targetMember.email,
        notes,
      };

      console.log('💾 [PROJECT_INTERACTION] Salvando interação 1:1 no Firestore');
      const docRef = await addDoc(interactionsRef, interactionData);
      console.log('✅ [PROJECT_INTERACTION] Interação do projeto salva com sucesso, ID:', docRef.id);

      // Salvar também na coleção do funcionário para aparecer no dashboard
      // Interações de projetos são contadas como "Feedback" no dashboard
      console.log('🔄 [PROJECT_INTERACTION] Iniciando sincronização com coleção do funcionário...', {
        targetMemberId: targetMember.id,
        targetMemberName: targetMember.name,
        firestoreAvailable: !!firestore
      });
      
      if (!firestore) {
        console.error('❌ [PROJECT_INTERACTION] Firestore não disponível para sincronização');
      } else {
        try {
          const employeeInteractionsRef = collection(firestore, "employees", targetMember.id, "interactions");
          const employeeInteractionData = {
            type: "Feedback" as const, // Interações de projetos são Feedback
            date: interactionData.date,
            notes: data.indicator 
              ? { content: sanitize(data.content), indicator: sanitize(data.indicator) }  // Objeto com indicador
              : sanitize(data.content), // String simples se não tem indicador
            authorId: currentUser.id,
            source: "project", // Marcar origem como projeto
            projectId: project.id, // Referência ao projeto (opcional, mas útil para rastreabilidade)
          };

          console.log('💾 [PROJECT_INTERACTION] Salvando interação na coleção do funcionário', {
            employeeId: targetMember.id,
            employeeName: targetMember.name,
            projectId: project.id,
            type: employeeInteractionData.type, // Confirmar que é "Feedback"
            date: employeeInteractionData.date,
          });

          await addDoc(employeeInteractionsRef, employeeInteractionData);
          
          console.log('✅ [PROJECT_INTERACTION] Interação sincronizada com sucesso como tipo:', employeeInteractionData.type);
        } catch (syncError: any) {
          // Log do erro mas não falha a operação principal
          console.error('⚠️ [PROJECT_INTERACTION] Erro ao sincronizar com coleção do funcionário:', syncError);
          console.error('⚠️ [PROJECT_INTERACTION] Detalhes do erro:', {
            message: syncError?.message,
            code: syncError?.code,
            stack: syncError?.stack
          });
          // Ainda mostra sucesso porque a interação do projeto foi salva
        }
      }

      logProjectSuccess('Interação 1:1 criada', {
        projectId: project.id,
        interactionId: docRef.id,
        targetMember: targetMember.name,
      });

      toast({
        title: "✅ Interação Registrada!",
        description: `Interação com ${targetMember.name} registrada com sucesso.`,
      });

      form.reset({
        type: "1:1",
        targetMemberId: preSelectedMemberId || "",
        content: "",
        indicator: "",
      });
      
      // Pequeno delay para garantir que o useCollection capture a mudança
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error: any) {
      const errorDetails = mapFirestoreError(error, 'Registrar Interação de Projeto');

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
    form.reset({
      type: "1:1",
      targetMemberId: preSelectedMemberId || "",
      content: "",
      indicator: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Interação</DialogTitle>
          <DialogDescription>
            Registre uma interação para o projeto &quot;{project.name}&quot;
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Seleção de Membro (oculto se pré-selecionado) */}
            {!preSelectedMemberId && (
              <FormField
                control={form.control}
                name="targetMemberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membro *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o membro" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} - {member.position || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecione o membro com quem a interação foi realizada
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Campo Indicador */}
            <FormField
              control={form.control}
              name="indicator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indicador (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 1º lugar, MVP do mês, Destaque..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Indique a posição, classificação ou destaque do membro nesta interação
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Anotações */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anotações *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os principais pontos da interação..."
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Registrar Interação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}



