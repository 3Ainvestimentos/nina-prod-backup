"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { Premissas, PremissasConfig, Interaction } from "@/lib/types";

interface PremissasCardProps {
  premissas: Premissas;
  config: PremissasConfig;
  interactions: Interaction[]; // Interações N3 do colaborador
}

/**
 * Calcula o CDI mensal a partir do CDI anual
 */
function calcularCDIMensal(cdiAnual: number): number {
  // Fórmula: (1 + CDI_anual/100)^(1/12) - 1
  return (Math.pow(1 + cdiAnual / 100, 1 / 12) - 1) * 100;
}

/**
 * Calcula a projeção mensal de AUC
 */
function calcularProjecaoAUC(premissas: Premissas, cdiMensal: number): Array<{ mes: string; projetado: number }> {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const captacaoMensal = premissas.captacaoPrevista / 12;
  const churnAnualPercentual = premissas.churnPrevisto; // Churn anual em %
  const churnMensalPercentual = churnAnualPercentual / 12; // Churn mensal em %
  
  let aucAtual = premissas.aucInicial;
  const projecao: Array<{ mes: string; projetado: number }> = [];

  for (let i = 0; i < 12; i++) {
    // AUC = AUC_anterior + (CDI_mensal × AUC_anterior / 100) - (Churn_mensal% × AUC_anterior / 100) + Captação_mensal
    const rendimentoCDI = (aucAtual * cdiMensal) / 100;
    const churnMes = (aucAtual * churnMensalPercentual) / 100; // Churn como % do AUC atual
    aucAtual = aucAtual + rendimentoCDI - churnMes + captacaoMensal;
    
    projecao.push({
      mes: meses[i],
      projetado: Math.round(aucAtual),
    });
  }

  return projecao;
}

/**
 * Calcula a receita mensal projetada
 */
function calcularProjecaoReceita(
  premissas: Premissas,
  config: PremissasConfig,
  projecaoAUC: Array<{ mes: string; projetado: number }>
): Array<{ mes: string; projetado: number }> {
  const multiplicador = premissas.tipoAssessor === "B2B" 
    ? config.multiplicadorB2B 
    : config.multiplicadorMINST;
  
  const impostoDecimal = config.impostoRepasse / 100;
  const roaAnualDecimal = premissas.roaPrevisto / 100;
  const roaMensalDecimal = roaAnualDecimal / 12; // ROA mensal

  return projecaoAUC.map(({ mes, projetado: auc }) => {
    // Receita = (ROA_mensal × AUC) × (1 - imposto) × multiplicador
    const receitaBruta = roaMensalDecimal * auc;
    const receitaLiquida = receitaBruta * (1 - impostoDecimal);
    const receitaFinal = receitaLiquida * multiplicador;

    return {
      mes,
      projetado: Math.round(receitaFinal),
    };
  });
}

/**
 * Calcula o AUC realizado baseado nas interações N3
 */
function calcularRealizadoAUC(
  interactions: Interaction[],
  premissas: Premissas,
  cdiMensal: number
): Array<{ mes: string; realizado: number }> {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const anoAtual = premissas.year;
  
  // Filtrar apenas interações N3 do ano das premissas
  const n3Interactions = interactions.filter(int => {
    if (int.type !== "N3 Individual") return false;
    const intDate = new Date(int.date);
    return intDate.getFullYear() === anoAtual;
  });

  // Organizar interações por mês
  const interacoesPorMes: { [mes: number]: Interaction[] } = {};
  n3Interactions.forEach(int => {
    const mesIndex = new Date(int.date).getMonth(); // 0-11
    if (!interacoesPorMes[mesIndex]) {
      interacoesPorMes[mesIndex] = [];
    }
    interacoesPorMes[mesIndex].push(int);
  });

  let aucAtual = premissas.aucInicial;
  const resultado: Array<{ mes: string; realizado: number }> = [];
  let temDadosReais = false;

  for (let mesIndex = 0; mesIndex < 12; mesIndex++) {
    const interacoesDoMes = interacoesPorMes[mesIndex] || [];
    
    if (interacoesDoMes.length > 0) {
      temDadosReais = true;
      // Pegar a última interação do mês (mais recente)
      const ultimaInteracao = interacoesDoMes.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      const notes = ultimaInteracao.notes as any;
      
      // Extrair valores da N3 (podem estar como string)
      // Converter vírgula para ponto antes do parseFloat
      const captacaoString = (notes?.captacao || "0").toString().replace(',', '.');
      const churnString = (notes?.churnPF || "0").toString().replace(',', '.');
      const captacaoMes = parseFloat(captacaoString) || 0;
      const churnPercentual = parseFloat(churnString) || 0;
      
      // Churn é % do AUC atual
      const churnMes = (aucAtual * churnPercentual) / 100;
      
      // Calcular AUC realizado do mês
      const rendimentoCDI = (aucAtual * cdiMensal) / 100;
      aucAtual = aucAtual + rendimentoCDI - churnMes + captacaoMes;
      
      resultado.push({
        mes: meses[mesIndex],
        realizado: Math.round(aucAtual),
      });
    } else {
      // Sem interação N3: não calcular realizado (deixar 0)
      resultado.push({
        mes: meses[mesIndex],
        realizado: 0,
      });
    }
  }

  return resultado;
}

/**
 * Calcula a receita realizada baseada nas interações N3 e no AUC realizado
 */
function calcularRealizadoReceita(
  interactions: Interaction[],
  premissas: Premissas,
  config: PremissasConfig,
  aucRealizado: Array<{ mes: string; realizado: number }>
): Array<{ mes: string; realizado: number }> {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const anoAtual = premissas.year;
  
  // Filtrar apenas interações N3 do ano das premissas
  const n3Interactions = interactions.filter(int => {
    if (int.type !== "N3 Individual") return false;
    const intDate = new Date(int.date);
    return intDate.getFullYear() === anoAtual;
  });

  // Organizar interações por mês
  const interacoesPorMes: { [mes: number]: Interaction[] } = {};
  n3Interactions.forEach(int => {
    const mesIndex = new Date(int.date).getMonth(); // 0-11
    if (!interacoesPorMes[mesIndex]) {
      interacoesPorMes[mesIndex] = [];
    }
    interacoesPorMes[mesIndex].push(int);
  });

  const multiplicador = premissas.tipoAssessor === "B2B" 
    ? config.multiplicadorB2B 
    : config.multiplicadorMINST;
  
  const impostoDecimal = config.impostoRepasse / 100;

  const resultado: Array<{ mes: string; realizado: number }> = [];

  for (let mesIndex = 0; mesIndex < 12; mesIndex++) {
    const interacoesDoMes = interacoesPorMes[mesIndex] || [];
    const aucDoMes = aucRealizado[mesIndex]?.realizado || 0;
    
    if (interacoesDoMes.length > 0 && aucDoMes > 0) {
      // Pegar a última interação do mês (mais recente)
      const ultimaInteracao = interacoesDoMes.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      const notes = ultimaInteracao.notes as any;
      
      // Extrair ROA realizado da N3 (pode estar como string com %)
      // Converter vírgula para ponto antes do parseFloat
      const roaString = (notes?.roa || "0").toString().replace(',', '.');
      const roaRealizado = parseFloat(roaString) || 0;
      
      // ROA da N3 é anual (ex: 0.4 = 0.4% ao ano)
      // Dividir por 12 para obter o ROA mensal
      const roaAnualDecimal = roaRealizado / 100;
      const roaMensalDecimal = roaAnualDecimal / 12;
      
      // Calcular receita: (ROA_mensal × AUC) × (1 - imposto) × multiplicador
      const receitaBruta = roaMensalDecimal * aucDoMes;
      const receitaLiquida = receitaBruta * (1 - impostoDecimal);
      const receitaFinal = receitaLiquida * multiplicador;

      resultado.push({
        mes: meses[mesIndex],
        realizado: Math.round(receitaFinal),
      });
    } else {
      // Sem interação N3 ou sem AUC realizado: não calcular receita realizada (deixar 0)
      resultado.push({
        mes: meses[mesIndex],
        realizado: 0,
      });
    }
  }

  return resultado;
}

export function PremissasCard({ premissas, config, interactions }: PremissasCardProps) {
  const cdiMensal = useMemo(() => calcularCDIMensal(config.cdiAnual), [config.cdiAnual]);
  
  const projecaoAUC = useMemo(
    () => calcularProjecaoAUC(premissas, cdiMensal),
    [premissas, cdiMensal]
  );
  
  const projecaoReceita = useMemo(
    () => calcularProjecaoReceita(premissas, config, projecaoAUC),
    [premissas, config, projecaoAUC]
  );

  const realizadoAUC = useMemo(
    () => calcularRealizadoAUC(interactions, premissas, cdiMensal),
    [interactions, premissas, cdiMensal]
  );

  const realizadoReceita = useMemo(
    () => calcularRealizadoReceita(interactions, premissas, config, realizadoAUC),
    [interactions, premissas, config, realizadoAUC]
  );

  // Verificar se há dados reais (ao menos um mês com valor > 0)
  const temDadosReaisAUC = useMemo(() => {
    return realizadoAUC.some(item => item.realizado > 0);
  }, [realizadoAUC]);

  const temDadosReaisReceita = useMemo(() => {
    return realizadoReceita.some(item => item.realizado > 0);
  }, [realizadoReceita]);

  // Combinar projetado e realizado para os gráficos
  const dadosAUC = useMemo(() => {
    return projecaoAUC.map((proj, idx) => ({
      mes: proj.mes,
      projetado: proj.projetado,
      realizado: realizadoAUC[idx]?.realizado || 0,
    }));
  }, [projecaoAUC, realizadoAUC]);

  const dadosReceita = useMemo(() => {
    return projecaoReceita.map((proj, idx) => ({
      mes: proj.mes,
      projetado: proj.projetado,
      realizado: realizadoReceita[idx]?.realizado || 0,
    }));
  }, [projecaoReceita, realizadoReceita]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Card de AUC */}
      <Card className="w-full overflow-hidden">
        <CardHeader>
          <CardTitle>AUC</CardTitle>
          <CardDescription>
            Projeção vs Realizado - {premissas.year}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer
            config={{
              projetado: {
                label: "Projetado",
                color: "hsl(220, 9%, 60%)",
              },
              realizado: {
                label: "Realizado",
                color: "hsl(170, 60%, 50%)",
              },
            }}
            className="h-[300px] w-full"
          >
            <LineChart data={dadosAUC} margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => formatarMoeda(value)} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                payload={[
                  { value: 'Projetado', type: 'line', color: 'hsl(220, 9%, 60%)' },
                  { value: 'Realizado', type: 'line', color: 'hsl(170, 60%, 50%)' }
                ]}
              />
              <Line
                type="monotone"
                dataKey="projetado"
                stroke="hsl(220, 9%, 60%)"
                strokeWidth={2}
                name="Projetado"
              />
              {temDadosReaisAUC && (
                <Line
                  type="monotone"
                  dataKey="realizado"
                  stroke="hsl(170, 60%, 50%)"
                  strokeWidth={2}
                  name="Realizado"
                />
              )}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Card de Receita */}
      <Card className="w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Repasse</CardTitle>
          <CardDescription>
            Projeção vs Realizado - {premissas.year} (Tipo: {premissas.tipoAssessor})
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <ChartContainer
            config={{
              projetado: {
                label: "Projetado",
                color: "hsl(220, 9%, 60%)",
              },
              realizado: {
                label: "Realizado",
                color: "hsl(170, 60%, 50%)",
              },
            }}
            className="h-[300px] w-full"
          >
            <BarChart data={dadosReceita} margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => formatarMoeda(value)} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                payload={[
                  { value: 'Projetado', type: 'rect', color: 'hsl(220, 9%, 60%)' },
                  { value: 'Realizado', type: 'rect', color: 'hsl(170, 60%, 50%)' }
                ]}
              />
              <Bar
                dataKey="projetado"
                fill="hsl(220, 9%, 60%)"
                name="Projetado"
              />
              {temDadosReaisReceita && (
                <Bar
                  dataKey="realizado"
                  fill="hsl(170, 60%, 50%)"
                  name="Realizado"
                />
              )}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

