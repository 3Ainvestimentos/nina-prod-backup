
"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "./page-header";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Employee } from "@/lib/types";
import { useMemo } from "react";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];

const titles: { [key: string]: { title: string; description?: string } } = {
  "/dashboard/v2": {
    title: "Dashboard de Liderança",
    description: "Acompanhe as métricas e o engajamento da sua equipe.",
  },
  "/dashboard/lideranca": { // Fallback for the old path
    title: "Dashboard de Liderança",
    description: "Acompanhe as métricas e o engajamento da sua equipe.",
  },
  "/dashboard/individual-tracking": {
    title: "Acompanhamento Individual",
    description: "Registre e acompanhe as interações com sua equipe.",
  },
  "/dashboard/pdi": {
    title: "Plano de Desenvolvimento",
    description: "Visualize e gerencie o PDI e o diagnóstico de cada colaborador.",
  },
  "/dashboard/risk-analysis": {
    title: "Análise de Índices",
    description: "Compare e analise os índices de risco e qualidade.",
  },
  "/dashboard/ranking": {
    title: "Ranking de Líderes",
    description: "O Índice de Aderência é o principal indicador de performance da liderança. Ele mede, em percentual, a proporção de interações obrigatórias (1:1, PDI, N3 Individual, Índice de Risco) que um líder realizou com sua equipe em relação ao total previsto para o período selecionado. Por exemplo, se um líder deveria ter 10 interações no mês e realizou 8, seu índice será de 80%.",
  },
  "/dashboard/admin": {
    title: "Configurações",
    description: "Configure os ajustes gerais do sistema.",
  },
  "/dashboard/projects": {
    title: "Projetos",
    description: "Gerencie seus projetos independentes e acompanhe interações.",
  },
  "/dashboard/leader-tracking": {
    title: "Acompanhamento Individual de Líderes",
    description: "Registre e acompanhe as interações com os líderes do time comercial.",
  },
  "/dashboard/quality-analysis": {
    title: "Análise de Qualidade",
    description: "Compare e analise o índice de qualidade dos líderes.",
  },
};

function getPageDetails(pathname: string): { title: string; description?: string } {
    if (pathname === '/dashboard' || pathname === '/dashboard/lideranca') {
        return titles['/dashboard/v2'];
    }
    
    // Se for qualquer rota de projetos (incluindo detalhes e timeline)
    if (pathname.startsWith('/dashboard/projects')) {
        return { title: "Projetos", description: "Gerencie seus projetos independentes e acompanhe interações." };
    }
    
    return titles[pathname] || { title: "Nina 1.0" };
}

export function PageHeaderController() {
  const pathname = usePathname();
  const { title: defaultTitle, description } = getPageDetails(pathname);
  
  const firestore = useFirestore();
  const { user } = useUser();

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  
  const { data: employees } = useCollection<Employee>(employeesCollection);

  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;
    
    // Verificar se o email está na lista de admins hardcoded
    if (user.email && adminEmails.includes(user.email)) {
      const employeeData = employees.find(e => e.email === user.email) || {};
      return {
        ...employeeData,
        isAdmin: true,
        // isDirector vem do documento
      } as Employee;
    }
    
    return employees.find(e => e.email === user.email);
  }, [user, employees]);

  const isDirectorOrAdmin = currentUserEmployee?.isDirector || currentUserEmployee?.isAdmin;

  // Se for diretor/admin e estiver na página principal do dashboard, mudar o título
  let title = defaultTitle;

  if (pathname === "/dashboard/v2" && isDirectorOrAdmin) {
    title = "Dashboard";
  } else if (pathname === "/dashboard/risk-analysis") {
    title = isDirectorOrAdmin ? "Análise de Índices" : "Análise de Risco";
  }

  return <PageHeader title={title} description={description} />;
}

    
