"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine, Legend } from "recharts";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Users, Award, History, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeSelectionDialog } from "@/components/employee-selection-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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

const adminEmails = ['matheus@3ainvestimentos.com.br', 'lucas.nogueira@3ainvestimentos.com.br', 'henrique.peixoto@3ainvestimentos.com.br'];

export default function QualityAnalysisPage() {
  const router = useRouter();
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

  // Filtrar apenas líderes do time comercial
  const managedEmployees = useMemo(() => {
    if (!currentUserEmployee || !employees) return [];
    const activeEmployees = employees.filter(e => 
      !(e as any)._isDeleted &&
      e.role === "Líder" && 
      e.axis === "Comercial"
    );
    
    if (currentUserEmployee.isAdmin || currentUserEmployee.isDirector) {
        return activeEmployees;
    }
    return [];
  }, [currentUserEmployee, employees]);

  const selectedEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(e => selectedEmployeeIds.includes(e.id));
  }, [employees, selectedEmployeeIds]);

  const [interactions, setInteractions] = useState<{ [key: string]: Interaction[] }>({});
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  // State para controlar qual linha está em hover
  const [hoveredLineId, setHoveredLineId] = React.useState<string | null>(null);
  
  // State para controlar qual linha está selecionada (clicada na legenda)
  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(null);

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

  // Verificar se é admin/diretor (incluindo emails hardcoded)
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    
    // Verificar emails hardcoded primeiro
    if (user.email && adminEmails.includes(user.email)) {
      return true;
    }
    
    // Verificar se o employee tem isAdmin ou isDirector
    if (currentUserEmployee) {
      return !!(currentUserEmployee.isAdmin || currentUserEmployee.isDirector);
    }
    
    return false;
  }, [user, currentUserEmployee]);

  // VALIDAÇÃO DE ACESSO: Apenas Diretores e Admins
  useEffect(() => {
    // Só redirecionar se os dados já carregaram completamente
    if (areEmployeesLoading) return;
    
    // Se não está autorizado, redirecionar
    if (!isAuthorized) {
      console.log('[Quality Analysis] Acesso negado:', {
        userEmail: user?.email,
        currentUserEmployee,
        isAuthorized,
        isAdmin: currentUserEmployee?.isAdmin,
        isDirector: currentUserEmployee?.isDirector,
        adminEmails
      });
      router.replace("/dashboard/v2");
    }
  }, [isAuthorized, router, areEmployeesLoading, user, currentUserEmployee]);

  const barChartData = useMemo(() => {
    return selectedEmployees.map(emp => {
      // Buscar qualityScore das interações do tipo "Índice de Qualidade"
      const qualityInteractions = interactions[emp.id]?.filter(int => int.type === 'Índice de Qualidade') || [];
      const latestQuality = qualityInteractions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const quality = latestQuality?.qualityScore ?? 0;
      
      let fillColor;
      if (quality > 0) {
        fillColor = "hsl(var(--chart-1))";
      } else if (quality < 0) {
        fillColor = "hsl(var(--destructive))";
      } else {
        fillColor = "hsl(var(--muted-foreground))";
      }
      return {
        name: emp.name.split(' ')[0],
        quality: quality,
        fill: fillColor,
      }
    }).sort((a,b) => b.quality - a.quality);
  }, [selectedEmployees, interactions]);

  // Verificar se há valores negativos para ajustar o domínio do eixo Y
  const hasNegativeValues = useMemo(() => {
    return barChartData.some(item => item.quality < 0);
  }, [barChartData]);

  // Calcular domínio e ticks dinamicamente (mesmo range do Índice de Risco: -10 a +10)
  const yAxisDomain = useMemo(() => {
    if (hasNegativeValues) {
      return [-10, 10];
    } else {
      const maxQuality = Math.max(...barChartData.map(item => item.quality), 10);
      return [0, Math.max(maxQuality, 10)];
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
    quality: {
      label: "Índice de Qualidade",
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
        .filter((int) => int.type === "Índice de Qualidade" && typeof int.qualityScore === "number")
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
            byMonth[key].__latest[id] = { ts, score: Number(int.qualityScore) };
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
  
  const handleSelectHighQuality = () => {
    if (!managedEmployees) return;
    const highQualityIds = managedEmployees
      .filter(emp => {
        const qualityInteractions = interactions[emp.id]?.filter(int => int.type === 'Índice de Qualidade') || [];
        const latestQuality = qualityInteractions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return (latestQuality?.qualityScore ?? 0) >= 5;
      })
      .map(emp => emp.id);
    setSelectedEmployeeIds(highQualityIds);
  };
  
  const isLoading = areEmployeesLoading || loadingInteractions;

  // Tooltip customizado para o gráfico de barras (adiciona espaço entre "Qualidade" e o número)
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
            Índice de Qualidade {item.value}
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
      // Caso contrário, ordena por valor (maior qualidade no topo)
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

  // Mostrar loading enquanto carrega dados
  if (areEmployeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Se não está autorizado, não renderizar conteúdo
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Você não tem permissão para acessar esta página. Apenas Diretores e Administradores podem analisar a qualidade dos líderes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Seleção de Líderes</CardTitle>
                <CardDescription>Escolha um ou mais líderes do time comercial para analisar os dados de qualidade.</CardDescription>
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
                            ? `${selectedEmployeeIds.length} líder(es) selecionado(s)`
                            : "Selecionar Líderes"
                        }
                    </Button>
                     <Button
                        variant="default"
                        onClick={handleSelectHighQuality}
                        className="w-full sm:w-auto"
                        disabled={isLoading}
                        style={{ 
                          backgroundColor: 'hsl(170, 60%, 50%)',
                        }}
                    >
                        <Award className="mr-2 h-4 w-4" />
                        Exibir Alta Qualidade (&gt;=5)
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>
                  {viewMode === 'current' ? 'Índice de Qualidade' : 'Série Histórica do Índice de Qualidade'}
                </CardTitle>
                <CardDescription>
                  {viewMode === 'current' 
                    ? 'Índice de qualidade atual por líder selecionado.'
                    : 'Evolução das pontuações de qualidade a partir de outubro de 2025.'
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
                  <ChartContainer config={barChartConfig} className="w-full h-[315px]">
                    <BarChart
                      accessibilityLayer
                      data={barChartData}
                      margin={{ left: 10, right: 10, top: 20, bottom: 60 }}
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
                        <YAxis dataKey="quality" type="number" domain={yAxisDomain} ticks={yAxisTicks} />
                        <ChartTooltip
                          cursor={false}
                          content={<CustomBarTooltip />}
                        />
                        {hasNegativeValues && <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1} />}
                        <Bar dataKey="quality" name="Índice de Qualidade" radius={[4, 4, 0, 0]} />
                        {yAxisDomain[1] >= 5 && (
                          <ReferenceLine 
                            y={5} 
                            stroke="hsl(var(--muted-foreground))" 
                            strokeWidth={2}
                            strokeDasharray="3 3" 
                            label={{ 
                              value: "Qualidade Alta - 5", 
                              position: "left", 
                              fill: "hsl(var(--muted-foreground))",
                              fontSize: 10,
                            }}
                          />
                        )}
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[315px] text-muted-foreground text-sm">
                    Selecione um líder para ver o índice de qualidade.
                  </div>
                )}
              </>
            ) : (
              <>
                {isLoading ? ( 
                  <Skeleton className="h-full w-full min-h-[315px]" /> 
                ) : selectedEmployees.length > 0 ? (
                  <ChartContainer config={lineChartConfig} className="w-full h-[315px]">
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
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[315px] text-muted-foreground text-sm">
                    Selecione um líder para ver o histórico.
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
            title="Selecionar Líderes para Análise"
        />
    </div>
  );
}

