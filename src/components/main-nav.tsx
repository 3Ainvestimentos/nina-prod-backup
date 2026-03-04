
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
  BarChart3,
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
  { href: "/dashboard/risk-analysis", label: "Análise de Índices", icon: ShieldAlert, requiresAuth: (user: Employee) => user.role === "Líder" || user.isDirector || user.isAdmin },
  { href: "/dashboard/ranking", label: "Ranking", icon: Trophy, requiresAuth: (user: Employee) => user.role === "Líder" || user.isDirector || user.isAdmin },
  { href: "/dashboard/projects", label: "Projetos", icon: Briefcase, requiresAuth: (user: Employee) => user.role === "Líder" || user.role === "Líder de Projeto" || user.isDirector || user.isAdmin },
  { href: "/dashboard/metrics", label: "Métricas", icon: BarChart3, requiresAuth: (user: Employee) => user.isDirector || user.isAdmin },
];

export function MainNav({ user }: { user: Employee }) {
  const pathname = usePathname();

  const canShowItem = (item: typeof navItems[0]) => {
    const result = typeof item.requiresAuth === 'boolean'
      ? item.requiresAuth
      : typeof item.requiresAuth === 'function'
        ? item.requiresAuth(user)
        : true;
    // #region agent log
    if (item.href === '/dashboard/metrics') typeof window!=='undefined'&&fetch('http://127.0.0.1:7319/ingest/47f83980-17ff-478b-92ce-f77a99eb0a35',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e80b'},body:JSON.stringify({sessionId:'96e80b',location:'main-nav.tsx:canShowItem',message:'[HYP E] sidebar Métricas visibilidade',data:{canShow:result,userIsAdmin:user?.isAdmin,userIsDirector:user?.isDirector,userRole:user?.role,userEmail:user?.email},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return result;
  };

  const getLabel = (item: typeof navItems[0]) => {
    if (item.href === "/dashboard/risk-analysis") {
       return user.isDirector || user.isAdmin ? "Análise de Índices" : "Análise de Risco";
    }
    return item.label;
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
            <SidebarMenuButton asChild isActive={isActive} tooltip={getLabel(item)}>
              <Link href={item.href}>
                <item.icon />
                <span>{getLabel(item)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
    