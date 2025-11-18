"use client";

import { useMemo } from "react";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Project, Employee } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProjects } from "@/hooks/use-user-projects";
import { Users, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ProjectMemberTracker } from "@/components/project-member-tracker";

export default function ProjectsPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  console.log('🎯 [PROJECTS_PAGE] Componente montado', {
    userEmail: user?.email,
  });

  // Carregar todos os employees
  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: employees } = useCollection<Employee>(employeesCollection);

  // Buscar currentUser nos employees
  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;
    return employees.find(e => e.email === user.email) || null;
  }, [user, employees]);

  // Carregar projetos
  const projectsCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "projects") : null),
    [firestore, user]
  );
  const { data: allProjects, isLoading: isLoadingProjects } = useCollection<Project>(projectsCollection);

  // Filtrar projetos com hook customizado
  const { projects } = useUserProjects(
    allProjects,
    currentUserEmployee
  );

  // Usar todos os projetos sem filtro adicional
  const filteredProjects = projects;

  if (!currentUserEmployee) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lista de Projetos - Accordion Style */}
      {isLoadingProjects ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Você não está em nenhum projeto</p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Entre em contato com um administrador para ser incluído em um projeto
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4" defaultValue={filteredProjects[0]?.id}>
          {filteredProjects.map((project) => {
            const memberCount = project.memberIds?.length || 0;
            const isOwner = project.leaderEmail === currentUserEmployee?.email;

            return (
              <AccordionItem
                key={project.id}
                value={project.id}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-start justify-between w-full pr-4">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{project.name}</h3>
                        {isOwner && (
                          <Badge variant="default" className="text-xs">
                            Líder
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {memberCount} membro(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(project.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="pt-4 pb-2">
                    <ProjectMemberTracker
                      project={project}
                      allEmployees={employees || []}
                      currentUser={currentUserEmployee}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

    </div>
  );
}

