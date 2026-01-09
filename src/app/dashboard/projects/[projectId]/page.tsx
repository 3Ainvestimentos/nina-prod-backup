"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, query, orderBy } from "firebase/firestore";
import type { Project, Employee, ProjectInteraction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProjectInteractionDialog } from "@/components/project-interaction-dialog";
import { ProjectInteractionEditDialog } from "@/components/project-interaction-edit-dialog";
import { useToast } from "@/hooks/use-toast";
import { isProjectLeader, isProjectMember } from "@/hooks/use-user-projects";
import { ProjectErrors, mapFirestoreError } from "@/lib/project-errors";
import {
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  TrendingUp,
  MessageSquare,
  User,
  Edit,
  Pencil,
  Crown,
  Medal,
  Trophy,
  UserPlus,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isInteractionDialogOpen, setIsInteractionDialogOpen] = useState(false);
  const [isEditInteractionDialogOpen, setIsEditInteractionDialogOpen] = useState(false);
  const [interactionToEdit, setInteractionToEdit] = useState<ProjectInteraction | null>(null);

  console.log('🎯 [PROJECT_DETAILS] Página carregada', { projectId });

  // Carregar employees
  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: allEmployees } = useCollection<Employee>(employeesCollection);

  // Carregar interações do projeto
  const interactionsCollection = useMemoFirebase(
    () =>
      firestore && projectId
        ? query(
            collection(firestore, "projects", projectId, "interactions"),
            orderBy("date", "desc")
          )
        : null,
    [firestore, projectId]
  );
  const { data: interactions, isLoading: isLoadingInteractions } =
    useCollection<ProjectInteraction>(interactionsCollection);

  // Buscar currentUser
  const currentUserEmployee = useMemo(() => {
    if (!user || !allEmployees) return null;
    return allEmployees.find((e) => e.email === user.email) || null;
  }, [user, allEmployees]);

  // Carregar projeto
  useEffect(() => {
    const loadProject = async () => {
      if (!firestore || !projectId) return;

      console.log('📥 [PROJECT_DETAILS] Carregando projeto', { projectId });

      try {
        const projectRef = doc(firestore, "projects", projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          console.error('❌ [PROJECT_DETAILS] Projeto não encontrado');
          toast({
            variant: "destructive",
            title: ProjectErrors.FIRESTORE_NOT_FOUND.title,
            description: ProjectErrors.FIRESTORE_NOT_FOUND.message,
          });
          router.push("/dashboard/projects");
          return;
        }

        const projectData = { id: projectSnap.id, ...projectSnap.data() } as Project;
        console.log('✅ [PROJECT_DETAILS] Projeto carregado', { name: projectData.name });
        setProject(projectData);
      } catch (error: any) {
        const errorDetails = mapFirestoreError(error, "Carregar Projeto");
        toast({
          variant: "destructive",
          title: errorDetails.title,
          description: errorDetails.message,
        });
        router.push("/dashboard/projects");
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadProject();
  }, [firestore, projectId, router, toast]);

  // Buscar membros do projeto
  const projectMembers = useMemo(() => {
    if (!project || !allEmployees) return [];
    return allEmployees.filter((emp) => project.memberIds.includes(emp.id));
  }, [project, allEmployees]);

  // Verificar permissões
  const isLeader = useMemo(
    () => isProjectLeader(project, currentUserEmployee),
    [project, currentUserEmployee]
  );

  const isMember = useMemo(
    () => isProjectMember(project, currentUserEmployee),
    [project, currentUserEmployee]
  );

  const canView = useMemo(() => {
    if (!currentUserEmployee) return false;
    return (
      isLeader ||
      isMember ||
      currentUserEmployee.isAdmin ||
      currentUserEmployee.isDirector
    );
  }, [isLeader, isMember, currentUserEmployee]);

  // Avisos e interações 1:1
  const avisos = useMemo(
    () => interactions?.filter((i) => i.type === "avisos") || [],
    [interactions]
  );

  const oneOnOneInteractions = useMemo(
    () => interactions?.filter((i) => i.type === "1:1") || [],
    [interactions]
  );

  // Ranking removido - agora apenas admin gerencia projetos

  const handleBack = () => {
    router.push("/dashboard/projects");
  };

  const handleEdit = () => {
    router.push(`/dashboard/projects/${projectId}/edit`);
  };

  const handleViewMemberTimeline = (memberId: string) => {
    console.log('👁️ [PROJECT_DETAILS] Visualizar timeline do membro', { memberId });
    router.push(`/dashboard/projects/${projectId}/timeline/${memberId}`);
  };

  const handleOpenEditDialog = (interaction: ProjectInteraction) => {
    setInteractionToEdit(interaction);
    setIsEditInteractionDialogOpen(true);
  };

  if (isLoadingProject) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project || !canView) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-lg font-medium">Projeto não encontrado ou sem permissão</p>
          <Button className="mt-4" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Projetos
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {isLeader && (
              <Badge variant="default" className="text-sm">
                Líder
              </Badge>
            )}
            {isMember && !isLeader && (
              <Badge variant="secondary" className="text-sm">
                Membro
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">{project.description}</p>
        </div>

        {isLeader && (
          <div className="flex gap-2">
            <Button onClick={() => setIsInteractionDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Interação
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Informações do Projeto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total de Membros</p>
            <div className="flex items-center gap-2 mt-1">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{projectMembers.length}</span>
            </div>
          </div>

          {/* Último Aviso */}
          {avisos.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Último Aviso</p>
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-start gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(avisos[0].date)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap pl-6">
                    {avisos[0].notes.content}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Membros do Projeto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membros do Projeto ({projectMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectMembers.map((member) => {
              const memberInteractions = oneOnOneInteractions.filter(
                (i) => i.targetMemberId === member.id
              );

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.photoURL} alt={member.name} />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.position || member.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {memberInteractions.length} interação(ões)
                      </p>
                    </div>
                  </div>
                  {memberInteractions.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewMemberTimeline(member.id)}
                    >
                      Ver Timeline
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Interações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Interações</CardTitle>
          <CardDescription>
            {interactions?.length || 0} interação(ões) registrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInteractions ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !interactions || interactions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma interação registrada ainda
              </p>
              {isLeader && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsInteractionDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar Primeira Interação
                </Button>
              )}
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2" defaultValue={interactions[0]?.id}>
              {interactions.map((interaction) => (
                <AccordionItem
                  key={interaction.id}
                  value={interaction.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {interaction.type === "avisos" ? (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        ) : interaction.type === "grupo" ? (
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="text-left">
                          <p className="text-sm font-medium">
                            {interaction.type === "avisos"
                              ? "Avisos"
                              : interaction.type === "grupo"
                              ? `Avaliação em Grupo (${interaction.targetMemberIds?.length || 0} membros)`
                              : `1:1 com ${interaction.targetMemberName}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(interaction.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 pb-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 space-y-2">
                          {interaction.notes.indicator && (
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                Indicador: {interaction.notes.indicator}
                              </p>
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-semibold mb-1">Anotações</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {interaction.notes.content}
                            </p>
                          </div>
                        </div>
                        
                        {(isLeader || currentUserEmployee?.isAdmin) && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenEditDialog(interaction)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                        )}
                      </div>

                      {interaction.type === "1:1" && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Membro: {interaction.targetMemberName} ({interaction.targetMemberEmail})
                        </div>
                      )}
                      {interaction.type === "grupo" && interaction.targetMemberNames && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          <p className="font-medium mb-1">Membros avaliados:</p>
                          <p>{interaction.targetMemberNames.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Interação */}
      {isLeader && currentUserEmployee && (
        <ProjectInteractionDialog
          open={isInteractionDialogOpen}
          onOpenChange={setIsInteractionDialogOpen}
          project={project}
          projectMembers={projectMembers}
          currentUser={currentUserEmployee}
        />
      )}

      {/* Dialog de Edição de Interação */}
      {(isLeader || currentUserEmployee?.isAdmin) && project && interactionToEdit && currentUserEmployee && (
        <ProjectInteractionEditDialog
          open={isEditInteractionDialogOpen}
          onOpenChange={setIsEditInteractionDialogOpen}
          project={project}
          interaction={interactionToEdit}
          currentUser={currentUserEmployee}
        />
      )}
    </div>
  );
}

