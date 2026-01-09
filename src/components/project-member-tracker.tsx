"use client";

import { useState, useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Project, Employee, ProjectInteraction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectInteractionDialog } from "@/components/project-interaction-dialog";
import { ProjectInteractionEditDialog } from "@/components/project-interaction-edit-dialog";
import { isProjectLeader } from "@/hooks/use-user-projects";
import { PlusCircle, Pencil } from "lucide-react";
import { Timeline } from "@/components/timeline";

interface ProjectMemberTrackerProps {
  project: Project;
  allEmployees: Employee[];
  currentUser: Employee;
}

export function ProjectMemberTracker({
  project,
  allEmployees,
  currentUser,
}: ProjectMemberTrackerProps) {
  const firestore = useFirestore();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isInteractionDialogOpen, setIsInteractionDialogOpen] = useState(false);
  const [isEditInteractionDialogOpen, setIsEditInteractionDialogOpen] = useState(false);
  const [interactionToEdit, setInteractionToEdit] = useState<ProjectInteraction | null>(null);

  // Filtrar membros do projeto
  const projectMembers = useMemo(
    () => allEmployees.filter((emp) => project.memberIds.includes(emp.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [allEmployees, project.memberIds]
  );

  // Carregar interações do projeto
  const interactionsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, "projects", project.id, "interactions") : null),
    [firestore, project.id]
  );
  const { data: allInteractions, isLoading: isLoadingInteractions } =
    useCollection<ProjectInteraction>(interactionsCollection);

  const isLeader = isProjectLeader(project, currentUser);

  // Filtrar interações do membro selecionado para a timeline
  const memberInteractions = useMemo(() => {
    if (!selectedMemberId || !allInteractions) return [];
    
    const isAdmin = currentUser.isAdmin === true;

    return allInteractions
      .filter((i) => i.type === "1:1" && i.targetMemberId === selectedMemberId)
      .map(interaction => ({
        id: interaction.id,
        type: "Feedback" as const,
        date: interaction.date,
        notes: typeof interaction.notes === 'object' && interaction.notes !== null && 'content' in interaction.notes
          ? interaction.notes as { content: string; indicator?: string }  // Preserva estrutura completa com indicator
          : typeof interaction.notes === 'string' 
            ? interaction.notes 
            : JSON.stringify(interaction.notes),
        authorId: interaction.authorId,
        // Adicionar botão de edição na timeline
        actions: (isLeader || isAdmin) ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-primary"
            onClick={() => {
              setInteractionToEdit(interaction);
              setIsEditInteractionDialogOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
        ) : undefined
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedMemberId, allInteractions, isLeader, currentUser.isAdmin]);

  const selectedMember = useMemo(
    () => projectMembers.find((m) => m.id === selectedMemberId),
    [projectMembers, selectedMemberId]
  );

  return (
    <div className="space-y-6">
      {/* Seleção de Membro */}
      <Card>
        <CardHeader>
          <CardTitle>Seleção de Membro</CardTitle>
          <CardDescription>
            Escolha um membro do projeto para visualizar ou registrar interações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedMemberId || ""} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Selecione um membro" />
            </SelectTrigger>
            <SelectContent>
              {projectMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name} {member.area && `(${member.area})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Timeline */}
      {selectedMemberId && selectedMember && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Linha do Tempo de Interação</CardTitle>
              <CardDescription>
                Histórico de interações com {selectedMember.name}.
              </CardDescription>
            </div>
            {isLeader && (
              <Button onClick={() => setIsInteractionDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Interação
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Timeline
              interactions={memberInteractions}
              isLoading={isLoadingInteractions}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialog de Interação */}
      {isLeader && selectedMember && (
        <ProjectInteractionDialog
          open={isInteractionDialogOpen}
          onOpenChange={setIsInteractionDialogOpen}
          project={project}
          projectMembers={projectMembers}
          currentUser={currentUser}
          preSelectedMemberId={selectedMemberId || undefined}
        />
      )}

      {/* Dialog de Edição de Interação */}
      {(isLeader || currentUser.isAdmin) && interactionToEdit && (
        <ProjectInteractionEditDialog
          open={isEditInteractionDialogOpen}
          onOpenChange={setIsEditInteractionDialogOpen}
          project={project}
          interaction={interactionToEdit}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}


