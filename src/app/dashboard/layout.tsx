
"use client";

import { MainNav } from "@/components/main-nav";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PageHeaderController } from "@/components/page-header-controller";
import { BookOpen } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { useUser, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { useMemo, useState, useEffect } from "react";
import type { Employee } from "@/lib/types";
import { collection } from "firebase/firestore";
import { UsageGuideDialog } from "@/components/usage-guide-dialog";
import { SettingsDropdown } from "@/components/settings-dropdown";
import { usePreloadRanking } from "@/hooks/use-preload-ranking";

// Emails autorizados para a tela de configuração são tratados via useIsConfigAdmin

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const firestore = useFirestore();

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: employees } = useCollection<Employee>(employeesCollection);

  // Tentar usar cache de employees se disponível (otimização)
  // Lê o cache IMEDIATAMENTE, sem esperar employees
  const [cachedEmployees, setCachedEmployees] = useState<Employee[] | null>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const cached = localStorage.getItem('preloaded-employees');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30000 && Array.isArray(data)) {
          return data;
        }
      }
    } catch (e) {
      // Ignora erro, continua normalmente
    }
    return null;
  });
  
  // Atualizar cache quando employees chegar do Firestore
  useEffect(() => {
    if (employees && !cachedEmployees) {
      // Se employees chegou e não tinha cache, não precisa fazer nada
      return;
    }
  }, [employees, cachedEmployees]);

  // Usar employees do cache se ainda não carregou do Firestore
  const employeesToUse = employees || cachedEmployees;

  const currentUserEmployee = useMemo(() => {
    if (!user || !employeesToUse) return null;
    const employeeData = employeesToUse.find(e => e.email === user.email);
    if (!employeeData) return null;
    return employeeData;
  }, [user, employeesToUse]);

  // 🚀 Pré-carregar dados de ranking em background
  usePreloadRanking(employeesToUse);

  return (
    <SidebarProvider>
      <Sidebar collapsible="none">
        <SidebarHeader>
        </SidebarHeader>
        <SidebarContent>
          {currentUserEmployee ? (
            <MainNav user={currentUserEmployee} />
          ) : user ? (
            // Se temos user mas ainda não temos currentUserEmployee, mostrar skeleton
            <div className="p-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            </div>
          ) : (
            // Se não temos nem user, mostrar skeleton também
            <div className="p-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                  <SettingsDropdown />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <UsageGuideDialog />
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <LogoutButton />
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <PageHeaderController />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
