
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
import { Users, AlertTriangle, History, BarChart3 } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<'current' | 'historical'>('current');

  const toggleView = () => {
    setViewMode(prev => prev === 'current' ? 'historical' : 'current');
  };

  const firestore = useFirestore();
  const { user } = useUser();

  const employeesCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, "employees") : null),
    [firestore, user]
  );
  const { data: employees, isLoading: areEmployeesLoading } = useCollection<Employee>(employeesCollection);

  const currentUserEmployee = useMemo(() => {
    if (!user || !employees) return null;
    
    // Verificar se o email está na lista de admins hardcoded (apenas para isAdmin)
    if (user.email && adminEmails.includes(user.email)) {
        const employeeData = employees.find(e => e.email === user.email) || {};
        return {
            ...employeeData,
            name: user.displayName || 'Admin',
            email: user.email,
            isAdmin: true,
            // isDirector vem do documento do Firestore, não hardcoded
            role: 'Líder',
        } as Employee;
    }
    
    const employeeData = employees.find(e => e.email === user.email);
    if (!employeeData) return null;
    
    // isDirector deve vir apenas do documento do Firestore
    return employeeData;
  }, [user, employees]);

  const managedEmployees = useMemo(() => {
    if (!currentUserEmployee || !employees) return [];
    // Filtrar usuários deletados (soft delete) e apenas do time comercial
    const activeEmployees = employees.filter(e => 
      !(e as any)._isDeleted && e.axis === 'Comercial'
    );
    
    if (currentUserEmployee.isAdmin || currentUserEmployee.isDirector) {
        return activeEmployees;
    }
    if (currentUserEmployee.role === 'Líder') {
        return activeEmployees.filter(e => e.leaderId === currentUserEmployee.id);
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
      
      const { getDocs } = await import("firebase/firestore");

      // Buscar todas as interações em paralelo
      const results = await Promise.all(
        selectedEmployeeIds.map(async (id) => {
          const interactionsCollection = collection(firestore, "employees", id, "interactions");
          const snapshot = await getDocs(interactionsCollection);
          return {
            id,
            interactions: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Interaction))
          };
        })
      );

      // Converter array de resultados para objeto
      const newInteractions: { [key: string]: Interaction[] } = {};
      results.forEach(({ id, interactions }) => {
        newInteractions[id] = interactions;
      });

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
      // Pegar primeiro nome e último sobrenome
      const nameParts = emp.name.split(' ');
      const displayName = nameParts.length > 1 
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
        : nameParts[0];
      
      return {
        name: displayName,
        risk: risk,
        fill: fillColor,
      }
    }).sort((a,b) => b.risk - a.risk);
  }, [selectedEmployees]);

  // Verificar se há valores negativos para ajustar o domínio do eixo Y
  const hasNegativeValues = useMemo(() => {
    return barChartData.some(item => item.risk < 0);
  }, [barChartData]);

  // Calcular domínio e ticks dinamicamente
  const yAxisDomain = useMemo(() => {
    if (hasNegativeValues) {
      return [-10, 10];
    } else {
      const maxRisk = Math.max(...barChartData.map(item => item.risk), 10);
      return [0, Math.max(maxRisk, 10)];
    }
  }, [hasNegativeValues, barChartData]);

  const yAxisTicks = useMemo(() => {
    if (hasNegativeValues) {
      return [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10];
    } else {
      const max = yAxisDomain[1];
      const ticks: number[] = [];
      for (let i = 0; i <= max; i += 2) {
        ticks.push(i);
      }
      return ticks;
    }
  }, [hasNegativeValues, yAxisDomain]);

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
    
    // Filtrar apenas a partir de outubro de 2025 (2025-10)
    const october2025Key = "2025-10";

    selectedEmployeeIds.forEach((id) => {
      const employeeInteractions = interactions[id] || [];
      employeeInteractions
        .filter((int) => int.type === "Índice de Risco" && typeof int.riskScore === "number")
        .forEach((int) => {
          const dt = new Date(int.date);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; // yyyy-MM para ordenação
          
          // Filtrar meses antes de outubro de 2025
          if (key < october2025Key) return;
          
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

  // Calcular quantos pontos cada pessoa tem nos dados (para mostrar bolinha se tiver apenas 1 ponto)
  const employeeDataPointCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    selectedEmployeeIds.forEach((id) => {
      const count = lineChartData.filter(row => row[id] != null).length;
      counts[id] = count;
    });
    return counts;
  }, [lineChartData, selectedEmployeeIds]);
  
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

  // Tooltip customizado para o gráfico de barras (adiciona espaço entre "Risco" e o número)
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const item = payload[0];
    return (
      <div className="rounded-lg border bg-background px-2 py-1.5 shadow-md text-xs">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <div className="flex items-center gap-1.5">
          <div 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: item.color || item.payload?.fill }}
          />
          <span className="text-xs font-medium">
            {item.name} {item.value}
          </span>
        </div>
      </div>
    );
  };

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

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>
                  {viewMode === 'current' ? 'Índice de Risco' : 'Série Histórica do Índice de Risco'}
                </CardTitle>
                <CardDescription>
                  {viewMode === 'current' 
                    ? 'Índice de risco atual por colaborador selecionado.'
                    : 'Evolução das pontuações de risco a partir de outubro de 2025.'
                  }
                </CardDescription>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={toggleView}
                className="font-semibold text-white"
                style={{ 
                  backgroundColor: 'hsl(170, 60%, 50%)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(170, 60%, 45%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(170, 60%, 50%)';
                }}
              >
                {viewMode === 'current' ? (
                  <>
                    <History className="h-4 w-4 mr-2" />
                    Histórico
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Atual
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4 overflow-x-hidden">
            {viewMode === 'current' ? (
              <>
                {isLoading ? ( 
                  <Skeleton className="h-full w-full min-h-[315px]" /> 
                ) : selectedEmployees.length > 0 ? (
                  <div className="w-full h-[315px] 2xl:h-[60vh] min-h-[315px]">
                    <ChartContainer config={barChartConfig} className="w-full h-full">
                      <BarChart
                        accessibilityLayer
                        data={barChartData}
                        margin={{ left: 10, right: 10, top: 20, bottom: 100 }}
                      >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                      />
                        <YAxis dataKey="risk" type="number" domain={yAxisDomain} ticks={yAxisTicks} />
                        <ChartTooltip
                          cursor={false}
                          content={<CustomBarTooltip />}
                        />
                        <ReferenceArea y1={0} y2={yAxisDomain[1]} fill="hsl(var(--destructive) / 0.1)" strokeOpacity={0.5} />
                        <Bar 
                          dataKey="risk" 
                          name="Índice de Risco" 
                          radius={[4, 4, 0, 0]} 
                          isAnimationActive={true}
                          animationBegin={0}
                          animationDuration={800}
                          animationEasing="ease-out"
                          layout="vertical"
                        />
                        {hasNegativeValues && <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={2} strokeOpacity={0.5} />}
                        {yAxisDomain[1] >= 5 && (
                          <ReferenceLine 
                            y={5} 
                            stroke="hsl(var(--muted-foreground))" 
                            strokeWidth={2}
                            strokeDasharray="3 3" 
                            label={{ 
                              value: "Risco Alto - 5", 
                              position: "left", 
                              fill: "hsl(var(--muted-foreground))",
                              fontSize: 10,
                            }}
                          />
                        )}
                    </BarChart>
                  </ChartContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[315px] text-muted-foreground text-sm">
                    Selecione um colaborador para ver o índice de risco.
                  </div>
                )}
              </>
            ) : (
              <>
                {isLoading ? ( 
                  <Skeleton className="h-full w-full min-h-[315px]" /> 
                ) : selectedEmployees.length > 0 ? (
                  <div className="w-full h-[315px] 2xl:h-[60vh] min-h-[315px]">
                    <ChartContainer config={lineChartConfig} className="w-full h-full">
                      <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
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
                        const color = lineChartConfig[id]?.color || chartColors[index % chartColors.length];
                        
                        return (
                          <Line 
                            key={id} 
                            type="monotone" 
                            dataKey={id} 
                            stroke={color}
                            name={employees?.find(e => e.id === id)?.name}
                            strokeWidth={isSelected ? 4 : 3}
                            strokeOpacity={isDimmed ? 0.3 : 1}
                            // Mostrar bolinha apenas quando selecionado (funciona mesmo com apenas 1 ponto)
                            dot={isSelected ? { 
                              r: 5, 
                              fill: color,
                              strokeWidth: 2,
                              stroke: 'white'
                            } : false}
                            activeDot={{ r: 6 }}
                            connectNulls
                            onMouseEnter={() => setHoveredLineId(id)}
                            onMouseLeave={() => setHoveredLineId(null)}
                          />
                        );
                      })}
                    </LineChart>
                  </ChartContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[315px] text-muted-foreground text-sm">
                    Selecione um colaborador para ver o histórico.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
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
