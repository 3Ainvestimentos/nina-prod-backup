"use client";

import { useMemo } from "react";
import type { Employee } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskAnalysisContent } from "@/components/risk-analysis-content";
import { QualityAnalysisContent } from "@/components/quality-analysis-content";

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];

export default function RiskAnalysisPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);
  
  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;
    
    if (user.email && adminEmails.includes(user.email)) {
        const employeeData = employees.find(e => e.email === user.email) || {};
        return {
            ...employeeData,
            name: user.displayName || 'Admin',
            email: user.email,
            isAdmin: true,
            role: 'Líder',
        } as Employee;
    }

    const employeeData = employees.find(e => e.email === user.email);
    if (!employeeData) return null;

    return employeeData;
  }, [user, employees]);

  const isDirectorOrAdmin = currentUserEmployee?.isDirector || currentUserEmployee?.isAdmin;

  if (isDirectorOrAdmin) {
    return (
      <Tabs defaultValue="assessores" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assessores">Assessores - Risco</TabsTrigger>
          <TabsTrigger value="lideres">Líderes - Qualidade</TabsTrigger>
        </TabsList>
        <TabsContent value="assessores">
          <RiskAnalysisContent 
            employees={employees} 
            currentUserEmployee={currentUserEmployee}
            areEmployeesLoading={areEmployeesLoading}
          />
        </TabsContent>
        <TabsContent value="lideres">
          <QualityAnalysisContent 
            employees={employees}
            currentUserEmployee={currentUserEmployee}
            areEmployeesLoading={areEmployeesLoading}
          />
        </TabsContent>
      </Tabs>
    );
  }

  // Se for líder, mostra apenas o conteúdo de risco (assessores)
  return (
    <RiskAnalysisContent 
      employees={employees} 
      currentUserEmployee={currentUserEmployee}
      areEmployeesLoading={areEmployeesLoading}
    />
  );
}
