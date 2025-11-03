
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
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { PageHeaderController } from "@/components/page-header-controller";
import { Settings, BookOpen } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { useUser, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { useMemo } from 'react';
import { useIsConfigAdmin } from "@/hooks/use-is-config-admin";
import type { Employee } from "@/lib/types";
import { collection } from "firebase/firestore";
import { UsageGuideDialog } from "@/components/usage-guide-dialog";

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

  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;
    const employeeData = employees.find(e => e.email === user.email);
    if (!employeeData) return null;
    return employeeData;
  }, [user, employees]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="none">
        <SidebarHeader>
        </SidebarHeader>
        <SidebarContent>
          {currentUserEmployee && <MainNav user={currentUserEmployee} />}
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                {useIsConfigAdmin().isConfigAdmin && (
                  <SidebarMenuItem>
                      <Link href="/dashboard/admin" className="w-full">
                        <SidebarMenuButton tooltip="Configurações">
                            <Settings />
                            <span>Configurações</span>
                        </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                )}
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
