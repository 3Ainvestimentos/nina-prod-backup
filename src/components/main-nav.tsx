
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  ClipboardList,
  ClipboardCheck,
  Trophy,
  Briefcase,
  Users,
  Award,
} from "lucide-react";
import type { Employee } from "@/lib/types";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/dashboard/v2", label: "Dashboard", icon: LayoutDashboard, requiresAuth: true },
  { href: "/dashboard/individual-tracking", label: "Acompanhamento", icon: ClipboardList, requiresAuth: (user: Employee) => user.role === "Líder" || user.isDirector || user.isAdmin },
  { href: "/dashboard/pdi", label: "Plano de Desenvolvimento", icon: ClipboardCheck, requiresAuth: (user: Employee) => user.role === "Líder" || user.isDirector || user.isAdmin },
  { href: "/dashboard/risk-analysis", label: "Análise de Risco", icon: ShieldAlert, requiresAuth: (user: Employee) => user.role === "Líder" || user.isDirector || user.isAdmin },
  { href: "/dashboard/ranking", label: "Ranking", icon: Trophy, requiresAuth: (user: Employee) => user.role === "Líder" || user.isDirector || user.isAdmin },
  { href: "/dashboard/projects", label: "Projetos", icon: Briefcase, requiresAuth: (user: Employee) => user.role === "Líder" || user.role === "Líder de Projeto" || user.isDirector || user.isAdmin },
  { href: "/dashboard/leader-tracking", label: "Acompanhamento de Líderes", icon: Users, requiresAuth: (user: Employee) => user.isDirector || user.isAdmin },
  { href: "/dashboard/quality-analysis", label: "Análise de Qualidade", icon: Award, requiresAuth: (user: Employee) => user.isDirector || user.isAdmin },
];

export function MainNav({ user }: { user: Employee }) {
  const pathname = usePathname();

  const canShowItem = (item: typeof navItems[0]) => {
    if (typeof item.requiresAuth === 'boolean') {
      return item.requiresAuth;
    }
    if (typeof item.requiresAuth === 'function') {
      return item.requiresAuth(user);
    }
    return true; // Show by default if no auth rule
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        if (!canShowItem(item)) {
          return null;
        }
        
        const isActive =
          item.href === "/dashboard/v2" && (pathname === "/dashboard" || pathname.startsWith("/dashboard/v2"))
            ? true
            : pathname.startsWith(item.href) && item.href !== "/dashboard/v2";

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
    