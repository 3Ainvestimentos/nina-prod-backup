
"use client";

import React, { useState, useMemo } from "react";
import type { Employee, Interaction } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine, Legend, ReferenceArea } from "recharts";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeSelectionDialog } from "@/components/employee-selection-dialog";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type ChartConfig = {
  [key: string]: {
    label: string;
    color: string;
  };
};

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br'];

export default function RiskAnalysisPage() {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

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
            isDirector: true,
            role: 'Líder',
        } as Employee;
    }
    const employeeData = employees.find(e => e.email === user.email);
    if (!employeeData) return null;
    if (employeeData.isAdmin) {
      return {
        ...employeeData,
        role: 'Líder',
        isDirector: true,
      };
    }
    return employeeData;
  }, [user, employees]);

  const managedEmployees = useMemo(() => {
    if (!currentUserEmployee || !employees) return [];
    if (currentUserEmployee.isAdmin || currentUserEmployee.isDirector) {
        return employees;
    }
    if (currentUserEmployee.role === 'Líder') {
        return employees.filter(e => e.leaderId === currentUserEmployee.id);
    }
    return [];
  }, [currentUserEmployee, employees]);

  const selectedEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => selectedEmployeeIds.includes(e.id));
  }, [employees, selectedEmployeeIds]);

  const [interactions, setInteractions] = useState<{ [key: string]: Interaction[] }>({});
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  React.useEffect(() => {
    const fetchInteractions = async () => {
      if (!firestore || selectedEmployeeIds.length === 0) {
        setInteractions({});
        return;
      }
      setLoadingInteractions(true);
      const newInteractions: { [key: string]: Interaction[] } = {};
      
      const { getDocs } = await import("firebase/firestore");

      for (const id of selectedEmployeeIds) {
        const interactionsCollection = collection(firestore, "employees", id, "interactions");
        const snapshot = await getDocs(interactionsCollection);
        newInteractions[id] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Interaction));
      }
      setInteractions(newInteractions);
      setLoadingInteractions(false);
    };
    fetchInteractions();
  }, [selectedEmployeeIds, firestore]);
  

  const barChartData = useMemo(() => {
    return selectedEmployees.map(emp => {
      const risk = emp.riskScore ?? 0;
      let fillColor;
      if (risk > 0) {
        fillColor = "hsl(var(--destructive))";
      } else if (risk < 0) {
        fillColor = "hsl(var(--chart-1))";
      } else {
        fillColor = "hsl(var(--muted-foreground))";
      }
      return {
        name: emp.name.split(' ')[0],
        risk: risk,
        fill: fillColor,
      }
    }).sort((a,b) => b.risk - a.risk);
  }, [selectedEmployees]);

  const barChartConfig = {
    risk: {
      label: "Índice de Risco",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig


  const lineChartData = useMemo(() => {
    type Latest = { ts: number; score: number };
    type MonthRow = { key: string; date: string; __latest: Record<string, Latest> };

    const byMonth: Record<string, MonthRow> = {};

    selectedEmployeeIds.forEach((id) => {
      const employeeInteractions = interactions[id] || [];
      employeeInteractions
        .filter((int) => int.type === "Índice de Risco" && typeof int.riskScore === "number")
        .forEach((int) => {
          const dt = new Date(int.date);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; // yyyy-MM para ordenação
          const monthAbbr = dt.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
          const label = `${monthAbbr}/${String(dt.getFullYear()).slice(-2)}`; // MMM/yy
          if (!byMonth[key]) byMonth[key] = { key, date: label, __latest: {} };
          const ts = dt.getTime();
          const prev = byMonth[key].__latest[id];
          if (!prev || ts > prev.ts) {
            byMonth[key].__latest[id] = { ts, score: Number(int.riskScore) };
          }
        });
    });

    return Object.values(byMonth)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => {
        const out: Record<string, number | string> = { date: row.date };
        for (const id of selectedEmployeeIds) {
          const rec = row.__latest[id];
          if (rec) out[id] = rec.score;
        }
        return out;
      });
  }, [interactions, selectedEmployeeIds]);

  const lineChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    selectedEmployees.forEach((emp, index) => {
      config[emp.id] = {
        label: emp.name,
        color: chartColors[index % chartColors.length],
      };
    });
    return config;
  }, [selectedEmployees]);
  
  const handleSelectAtRisk = () => {
    if (!managedEmployees) return;
    const atRiskIds = managedEmployees
      .filter(emp => (emp.riskScore ?? 0) >= 5)
      .map(emp => emp.id);
    setSelectedEmployeeIds(atRiskIds);
  };
  
  const isLoading = areEmployeesLoading || loadingInteractions;

  // State para controlar qual linha está em hover
  const [hoveredLineId, setHoveredLineId] = React.useState<string | null>(null);
  
  // State para controlar qual linha está selecionada (clicada na legenda)
  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(null);

  // Tooltip customizado para mostrar apenas a linha sob o cursor
  const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    // Filtra apenas itens com valor (remove undefined/null)
    let validPayload = payload.filter((item: any) => item.value != null);
    
    if (hoveredLineId) {
      // Se há uma linha específica em hover, mostra apenas ela
      validPayload = validPayload.filter((item: any) => item.dataKey === hoveredLineId);
    } else {
      // Caso contrário, ordena por valor (maior risco no topo)
      validPayload = [...validPayload].sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));
    }
    
    if (validPayload.length === 0) return null;
    
    return (
      <div className="rounded-lg border bg-background px-2 py-1.5 shadow-md text-xs">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <div className="space-y-0.5">
          {validPayload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-1.5">
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: item.stroke || item.color }}
              />
              <span className="text-xs font-medium truncate max-w-[120px]">{item.name}</span>
              <span className="text-xs font-bold ml-auto">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Seleção de Colaboradores</CardTitle>
                <CardDescription>Escolha um ou mais colaboradores para analisar os dados de risco.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => setIsSelectionDialogOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        <Users className="mr-2 h-4 w-4" />
                        {selectedEmployeeIds.length > 0 
                            ? `${selectedEmployeeIds.length} colaborador(es) selecionado(s)`
                            : "Selecionar Colaboradores"
                        }
                    </Button>
                     <Button
                        variant="destructive"
                        onClick={handleSelectAtRisk}
                        className="w-full sm:w-auto"
                        disabled={isLoading}
                    >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Exibir Alto Risco (&gt;=5)
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-6 flex-1 lg:grid-cols-5">
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Distribuição de Risco Atual</CardTitle>
              <CardDescription>
                Índice de risco atual por membro.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {isLoading ? ( <Skeleton className="h-full w-full" /> ) : selectedEmployees.length > 0 ? (
                  <ChartContainer config={barChartConfig} className="w-full h-full min-h-[250px]">
                    <BarChart
                        accessibilityLayer
                        data={barChartData}
                        layout="vertical"
                        margin={{ left: 30, right: 30, bottom: 30 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        tickMargin={5}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 10 }}
                        width={70}
                      />
                       <XAxis dataKey="risk" type="number" domain={[-10, 10]} />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent />}
                      />
                      <ReferenceArea x1={0} x2={10} y1={undefined} y2={undefined} fill="hsl(var(--destructive) / 0.1)" strokeOpacity={0.5}>
                         <Legend content={() => <text x={"100%"} y={15} dominantBaseline="middle" textAnchor="end" fill="hsl(var(--destructive))" fontSize="10">Risco Potencial</text>} />
                      </ReferenceArea>
                       <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                       <ReferenceLine 
                          x={5} 
                          stroke="hsl(var(--muted-foreground))" 
                          strokeDasharray="3 3" 
                          label={{ 
                            value: "Risco Alto", 
                            position: "bottom", 
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                            offset: 20,
                          }}
                        />
                      <Bar dataKey="risk" name="Índice de Risco" radius={4} />
                    </BarChart>
                  </ChartContainer>
              ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Selecione um colaborador.
                  </div>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-3 flex flex-col">
            <CardHeader>
              <CardTitle>Série Histórica do Índice de Risco</CardTitle>
              <CardDescription>
                Evolução das pontuações de risco.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {isLoading ? ( <Skeleton className="h-full w-full" /> ) : selectedEmployees.length > 0 ? (
                  <ChartContainer config={lineChartConfig} className="w-full h-full min-h-[250px]">
                    <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tickMargin={10} padding={{ left: 12, right: 12 }} />
                        <YAxis />
                        <ChartTooltip content={<CustomLineTooltip />} />
                        <Legend 
                          content={({ payload }) => {
                            if (!payload) return null;
                            return (
                              <div className="flex flex-wrap gap-4 justify-center mt-4">
                                {payload.map((entry: any, index: number) => {
                                  const employeeId = selectedEmployeeIds[index];
                                  const isSelected = selectedLineId === employeeId;
                                  return (
                                    <div
                                      key={entry.value}
                                      onClick={() => setSelectedLineId(isSelected ? null : employeeId)}
                                      className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                                        selectedLineId && !isSelected ? 'opacity-30' : 'opacity-100'
                                      } hover:opacity-100`}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          width: '12px',
                                          height: '12px',
                                          backgroundColor: entry.color,
                                          borderRadius: '2px',
                                          transform: 'rotate(45deg)',
                                        }}
                                      />
                                      <span className="text-xs">{entry.value}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        {selectedEmployeeIds.map((id, index) => {
                          const isSelected = selectedLineId === id;
                          const isDimmed = selectedLineId !== null && !isSelected;
                          return (
                            <Line 
                              key={id} 
                              type="monotone" 
                              dataKey={id} 
                              stroke={lineChartConfig[id]?.color || chartColors[index % chartColors.length]} 
                              name={employees?.find(e => e.id === id)?.name}
                              strokeWidth={isSelected ? 3 : 2}
                              strokeOpacity={isDimmed ? 0.3 : 1}
                              dot={false}
                              activeDot={{ r: 6 }}
                              connectNulls
                              onMouseEnter={() => setHoveredLineId(id)}
                              onMouseLeave={() => setHoveredLineId(null)}
                            />
                          );
                        })}
                    </LineChart>
                  </ChartContainer>
              ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Selecione um colaborador para ver o histórico.
                  </div>
              )}
            </CardContent>
          </Card>
        </div>
        <EmployeeSelectionDialog 
            open={isSelectionDialogOpen}
            onOpenChange={setIsSelectionDialogOpen}
            allEmployees={managedEmployees}
            selectedIds={selectedEmployeeIds}
            onSelectionChange={setSelectedEmployeeIds}
            isLoading={areEmployeesLoading}
            title="Selecionar Colaboradores para Análise"
        />
    </div>
  );
}
