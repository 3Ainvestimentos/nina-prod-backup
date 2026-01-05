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
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirestore } from "@/firebase";
import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Project, ProjectInteraction, ProjectInteractionNotes } from "@/lib/types";
import { ProjectErrors, mapFirestoreError, logProjectSuccess } from "@/lib/project-errors";
import { isProjectLeader } from "@/hooks/use-user-projects";
import DOMPurify from "dompurify";

const sanitize = (text: string) => {
  if (typeof window === 'undefined') return text;
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

const formSchema = z.object({
  content: z.string().min(5, "As anotações devem ter pelo menos 5 caracteres."),
  indicator: z.string().optional(),
});

type InteractionFormData = z.infer<typeof formSchema>;

interface ProjectInteractionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  interaction: ProjectInteraction;
  currentUser: Employee;
}

export function ProjectInteractionEditDialog({
  open,
  onOpenChange,
  project,
  interaction,
  currentUser,
}: ProjectInteractionEditDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<InteractionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: interaction.notes.content || "",
      indicator: interaction.notes.indicator || "",
    },
  });

  // Atualizar valores do form quando a interação mudar
  useEffect(() => {
    if (interaction) {
      form.reset({
        content: interaction.notes.content || "",
        indicator: interaction.notes.indicator || "",
      });
    }
  }, [interaction, form]);

  const handleSubmit = async (data: InteractionFormData) => {
    const isAdmin = currentUser.isAdmin === true;
    const isLeader = isProjectLeader(project, currentUser);

    // Validação de permissão
    if (!isAdmin && !isLeader) {
      toast({
        variant: "destructive",
        title: ProjectErrors.PERMISSION_DENIED.title,
        description: "Apenas administradores ou o líder do projeto podem editar esta interação.",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (!firestore) throw new Error("Firestore não disponível");

      // 1. Atualizar no Projeto
      const interactionRef = doc(firestore, "projects", project.id, "interactions", interaction.id);
      
      const updatedNotes: ProjectInteractionNotes = {
        content: sanitize(data.content),
        indicator: data.indicator ? sanitize(data.indicator) : undefined,
      };

      console.log('💾 [PROJECT_INTERACTION_EDIT] Atualizando interação no projeto', {
        projectId: project.id,
        interactionId: interaction.id
      });

      await updateDoc(interactionRef, {
        notes: updatedNotes,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      });

      // 2. Sincronizar com a coleção do funcionário (se for 1:1)
      if (interaction.type === "1:1" && interaction.targetMemberId) {
        console.log('🔄 [PROJECT_INTERACTION_EDIT] Sincronizando com Dashboard do funcionário...', {
          targetMemberId: interaction.targetMemberId,
          date: interaction.date
        });

        const employeeInteractionsRef = collection(firestore, "employees", interaction.targetMemberId, "interactions");
        
        // Buscar o documento espelho usando data e projectId
        const q = query(
          employeeInteractionsRef, 
          where("projectId", "==", project.id),
          where("date", "==", interaction.date)
        );

        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const syncPromises = querySnapshot.docs.map(syncDoc => {
            console.log('📝 [PROJECT_INTERACTION_EDIT] Atualizando documento espelho:', syncDoc.id);
            return updateDoc(syncDoc.ref, {
              notes: updatedNotes.content, // Dashboard individual usa string simples em 'notes' para Feedback
              // Se o dashboard suportar objetos em notes futuramente, poderíamos passar o objeto todo
              // No momento, src/components/timeline.tsx suporta tanto string quanto objeto
              indicator: updatedNotes.indicator,
              updatedAt: new Date().toISOString()
            });
          });
          await Promise.all(syncPromises);
          console.log('✅ [PROJECT_INTERACTION_EDIT] Sincronização concluída');
        } else {
          console.warn('⚠️ [PROJECT_INTERACTION_EDIT] Documento espelho não encontrado para sincronização');
        }
      }

      logProjectSuccess('Interação de projeto atualizada', {
        projectId: project.id,
        interactionId: interaction.id,
      });

      toast({
        title: "✅ Interação Atualizada!",
        description: "As alterações foram salvas e sincronizadas com sucesso.",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('❌ [PROJECT_INTERACTION_EDIT] Erro ao atualizar:', error);
      const errorDetails = mapFirestoreError(error, 'Atualizar Interação de Projeto');

      toast({
        variant: "destructive",
        title: errorDetails.title,
        description: errorDetails.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Interação</DialogTitle>
          <DialogDescription>
            Alterar conteúdo da interação de &quot;{interaction.date}&quot; no projeto &quot;{project.name}&quot;
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded-md mb-4 border border-dashed">
              <div>
                <p className="text-muted-foreground font-medium">Tipo</p>
                <p>{interaction.type === '1:1' ? '1:1' : interaction.type === 'grupo' ? 'Grupo' : 'Avisos'}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Data Original</p>
                <p>{new Date(interaction.date).toLocaleString('pt-BR')}</p>
              </div>
              {interaction.targetMemberName && (
                <div className="col-span-2">
                  <p className="text-muted-foreground font-medium">Membro</p>
                  <p>{interaction.targetMemberName}</p>
                </div>
              )}
            </div>

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
                    Indique a posição ou destaque (exibido no topo da anotação)
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
                      rows={8}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

