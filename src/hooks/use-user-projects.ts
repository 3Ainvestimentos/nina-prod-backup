import { useMemo } from 'react';
import type { Project, Employee } from '@/lib/types';

/**
 * Hook customizado que filtra projetos baseado nas permissões do usuário
 * 
 * @param projects - Lista completa de projetos
 * @param currentUser - Usuário logado (Employee)
 * @returns Projetos filtrados com flags de permissão
 */
export function useUserProjects(projects: Project[] | null, currentUser: Employee | null) {
  console.log('🔍 [USE_USER_PROJECTS] Iniciando filtro de projetos', {
    totalProjects: projects?.length || 0,
    userEmail: currentUser?.email,
    userRole: currentUser?.role,
    isAdmin: currentUser?.isAdmin,
    isDirector: currentUser?.isDirector,
  });

  const filteredProjects = useMemo(() => {
    if (!projects || !currentUser) {
      console.log('⚠️ [USE_USER_PROJECTS] Projetos ou usuário não disponível');
      return [];
    }

    const isAdminOrDirector = currentUser.isAdmin || currentUser.isDirector;
    
    console.log('🔐 [USE_USER_PROJECTS] Permissões do usuário:', {
      isAdminOrDirector,
      email: currentUser.email,
    });

    // Filtrar projetos não arquivados
    const activeProjects = projects.filter(p => !p.isArchived);
    console.log(`📦 [USE_USER_PROJECTS] Projetos ativos: ${activeProjects.length} de ${projects.length}`);

    // Admin e Diretor veem todos
    if (isAdminOrDirector) {
      console.log('✅ [USE_USER_PROJECTS] Admin/Diretor - Retornando todos os projetos');
      return activeProjects.map(project => ({
        ...project,
        isOwner: project.leaderEmail === currentUser.email,
        canEdit: project.leaderEmail === currentUser.email,
        canView: true,
      }));
    }

    // Líder vê apenas seus projetos (não vê mais projetos onde é apenas membro)
    const userProjects = activeProjects.filter(project => {
      const isLeader = project.leaderEmail === currentUser.email;
      
      if (isLeader) {
        console.log(`✅ [USE_USER_PROJECTS] Acesso ao projeto "${project.name}" - Líder: ${isLeader}`);
      }
      
      return isLeader;
    });

    console.log(`📋 [USE_USER_PROJECTS] Projetos acessíveis: ${userProjects.length}`);

    return userProjects.map(project => ({
      ...project,
      isOwner: project.leaderEmail === currentUser.email,
      canEdit: project.leaderEmail === currentUser.email,
      canView: true,
    }));
  }, [projects, currentUser]);

  const myProjects = useMemo(() => {
    if (!currentUser) return [];
    return filteredProjects.filter(p => p.leaderEmail === currentUser.email);
  }, [filteredProjects, currentUser]);

  // Membros não veem mais projetos - apenas líderes, diretores e admins
  const memberProjects: typeof filteredProjects = [];

  console.log('📊 [USE_USER_PROJECTS] Resumo:', {
    total: filteredProjects.length,
    myProjects: myProjects.length,
    memberProjects: memberProjects.length,
  });

  return {
    projects: filteredProjects,
    myProjects,
    memberProjects,
    canCreateProjects: currentUser?.role === 'Líder' || currentUser?.isDirector || currentUser?.isAdmin,
  };
}

/**
 * Helper para verificar se usuário pode criar projetos
 */
export function canUserCreateProjects(user: Employee | null): boolean {
  if (!user) return false;
  return user.role === 'Líder' || user.isDirector || user.isAdmin;
}

/**
 * Helper para verificar se usuário é líder de um projeto específico
 */
export function isProjectLeader(project: Project | null, user: Employee | null): boolean {
  if (!project || !user) return false;
  return project.leaderEmail === user.email;
}

/**
 * Helper para verificar se usuário é membro de um projeto
 */
export function isProjectMember(project: Project | null, user: Employee | null): boolean {
  if (!project || !user) return false;
  return project.memberEmails?.includes(user.email) || false;
}

