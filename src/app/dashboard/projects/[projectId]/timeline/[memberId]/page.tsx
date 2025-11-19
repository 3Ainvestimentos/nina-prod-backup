"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection } from "firebase/firestore";
import type { Project, Employee, ProjectInteraction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ProjectErrors, mapFirestoreError } from "@/lib/project-errors";
import { ArrowLeft, User, MessageSquare, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MemberTimelinePage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const projectId = params.projectId as string;
  const memberId = params.memberId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [member, setMember] = useState<Employee | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isLoadingMember, setIsLoadingMember] = useState(true);

  console.log('🎯 [MEMBER_TIMELINE] Página carregada', { projectId, memberId });

  // Carregar employees
  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: allEmployees } = useCollection<Employee>(employeesCollection);

  // Carregar todas as interações do projeto
  const interactionsCollection = useMemoFirebase(
    () =>
      firestore && projectId
        ? collection(firestore, "projects", projectId, "interactions")
        : null,
    [firestore, projectId]
  );
  const { data: allInteractions, isLoading: isLoadingInteractions } =
    useCollection<ProjectInteraction>(interactionsCollection);

  // Filtrar interações 1:1 do membro específico no cliente
  const interactions = useMemo(() => {
    if (!allInteractions) return [];
    return allInteractions
      .filter((i) => i.type === "1:1" && i.targetMemberId === memberId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allInteractions, memberId]);

  // Buscar currentUser
  const currentUserEmployee = useMemo(() => {
    if (!user || !allEmployees) return null;
    return allEmployees.find((e) => e.email === user.email) || null;
  }, [user, allEmployees]);

  // Carregar projeto
  useEffect(() => {
    const loadProject = async () => {
      if (!firestore || !projectId) return;

      console.log('📥 [MEMBER_TIMELINE] Carregando projeto', { projectId });

      try {
        const projectRef = doc(firestore, "projects", projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          console.error('❌ [MEMBER_TIMELINE] Projeto não encontrado');
          toast({
            variant: "destructive",
            title: ProjectErrors.FIRESTORE_NOT_FOUND.title,
            description: ProjectErrors.FIRESTORE_NOT_FOUND.message,
          });
          router.push("/dashboard/projects");
          return;
        }

        const projectData = { id: projectSnap.id, ...projectSnap.data() } as Project;
        console.log('✅ [MEMBER_TIMELINE] Projeto carregado', { name: projectData.name });
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

  // Carregar membro
  useEffect(() => {
    const loadMember = async () => {
      if (!firestore || !memberId) return;

      console.log('📥 [MEMBER_TIMELINE] Carregando membro', { memberId });

      try {
        const memberRef = doc(firestore, "employees", memberId);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
          console.error('❌ [MEMBER_TIMELINE] Membro não encontrado');
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Membro não encontrado",
          });
          router.push(`/dashboard/projects/${projectId}`);
          return;
        }

        const memberData = { id: memberSnap.id, ...memberSnap.data() } as Employee;
        console.log('✅ [MEMBER_TIMELINE] Membro carregado', { name: memberData.name });
        setMember(memberData);
      } catch (error: any) {
        const errorDetails = mapFirestoreError(error, "Carregar Membro");
        toast({
          variant: "destructive",
          title: errorDetails.title,
          description: errorDetails.message,
        });
        router.push(`/dashboard/projects/${projectId}`);
      } finally {
        setIsLoadingMember(false);
      }
    };

    loadMember();
  }, [firestore, memberId, projectId, router, toast]);

  const handleBack = () => {
    router.push(`/dashboard/projects/${projectId}`);
  };

  if (isLoadingProject || isLoadingMember) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project || !member) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-lg font-medium">Projeto ou membro não encontrado</p>
          <Button className="mt-4" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o Projeto
        </Button>

        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={member.photoURL} alt={member.name} />
            <AvatarFallback className="text-xl">{member.name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <h1 className="text-3xl font-bold">{member.name}</h1>
            <p className="text-muted-foreground">{member.position || member.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">Projeto: {project.name}</Badge>
              <Badge variant="secondary">{interactions?.length || 0} interação(ões)</Badge>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Informações do Membro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do Colaborador</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-sm">{member.email}</p>
          </div>
          {member.position && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cargo</p>
              <p className="text-sm">{member.position}</p>
            </div>
          )}
          {member.area && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Área</p>
              <p className="text-sm">{member.area}</p>
            </div>
          )}
          {member.city && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cidade</p>
              <p className="text-sm">{member.city}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline de Interações 1:1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline de Interações 1:1</CardTitle>
          <CardDescription>
            Histórico de interações individuais com {member.name} neste projeto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInteractions ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !interactions || interactions.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhuma interação registrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                O líder do projeto ainda não registrou interações 1:1 com este membro
              </p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="space-y-2"
              defaultValue={interactions[0]?.id}
            >
              {interactions.map((interaction, index) => (
                <AccordionItem
                  key={interaction.id}
                  value={interaction.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Interação 1:1</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(interaction.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-3 pb-4 space-y-3">
                      {interaction.notes.indicator && (
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            Indicador: {interaction.notes.indicator}
                          </p>
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Anotações</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {interaction.notes.content}
                        </p>
                      </div>

                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        Registrado por: {interaction.authorEmail}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

