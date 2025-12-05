

import type { Interaction, OneOnOneNotes, N3IndividualNotes, N2IndividualNotes, QualityIndexNotes } from "@/lib/types";
import {
  MessageSquare,
  Users,
  Calendar,
  ShieldAlert,
  ChevronDown,
  FileText,
  Award,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion"
import { Separator } from "./ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const interactionIcons: Record<Interaction["type"], React.ReactNode> = {
  "1:1": <Calendar className="h-4 w-4" />,
  "Feedback": <MessageSquare className="h-4 w-4" />,
  "N3 Individual": <Users className="h-4 w-4" />,
  "Índice de Risco": <ShieldAlert className="h-4 w-4" />,
  "N2 Individual": <FileText className="h-4 w-4" />,
  "Índice de Qualidade": <Award className="h-4 w-4" />,
};

const OneOnOneDetails = ({ notes }: { notes: OneOnOneNotes }) => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Visualizar detalhes do 1:1</AccordionTrigger>
        <AccordionContent>
            <div className="space-y-4 text-sm text-foreground/90 p-2">
                {notes.companyGrowth && <div><h4 className="font-semibold mb-1">Crescimento (Empresa)</h4><p className="whitespace-pre-wrap">{notes.companyGrowth}</p></div>}
                {notes.leaderGrowth && <div><h4 className="font-semibold mb-1">Crescimento (Líder)</h4><p className="whitespace-pre-wrap">{notes.leaderGrowth}</p></div>}
                {notes.teamGrowth && <div><h4 className="font-semibold mb-1">Crescimento (Time)</h4><p className="whitespace-pre-wrap">{notes.teamGrowth}</p></div>}
                {notes.personalLife && <div><h4 className="font-semibold mb-1">Vida Pessoal</h4><p className="whitespace-pre-wrap">{notes.personalLife}</p></div>}
                {notes.observations && <div><h4 className="font-semibold mb-1">Observações</h4><p className="whitespace-pre-wrap">{notes.observations}</p></div>}
            </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const formatCurrency = (value: string | number | undefined) => {
    if (!value && value !== 0) return "-";
    const num = typeof value === "string" ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) : value;
    if (Number.isNaN(num)) return "-";
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  };
  
  const formatPercentage = (value: string | number | undefined) => {
    if (!value && value !== 0) return "-";
    const num = typeof value === "string" ? parseFloat(value.replace(',', '.')) : value;
    if (Number.isNaN(num)) return "-";
    return `${num.toFixed(2).replace(".", ",")}%`;
  };

  const N3IndividualDetails = ({ notes }: { notes: N3IndividualNotes }) => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Visualizar detalhes do N3 Individual</AccordionTrigger>
        <AccordionContent>
            <div className="space-y-4 text-sm text-foreground/90 p-2">
                <div>
                    <h4 className="font-semibold mb-2">Indicadores Principais</h4>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Captação:</span>
                            <span className="font-mono font-medium">{formatCurrency(notes.captacao)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Churn PF:</span>
                            <span className="font-mono font-medium">{formatPercentage(notes.churnPF)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">ROA:</span>
                            <span className="font-mono font-medium">{formatPercentage(notes.roa)}</span>
                        </div>
                    </div>
                </div>
                <Separator />
                {notes.esforcos && <div><h4 className="font-semibold mb-1">Indicadores de Esforços</h4><p className="whitespace-pre-wrap">{notes.esforcos}</p></div>}
                {notes.planoAcao && <div><h4 className="font-semibold mb-1">Plano de Ação</h4><p className="whitespace-pre-wrap">{notes.planoAcao}</p></div>}
            </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
  
  const RiskAssessmentDetails = ({ notes }: { notes: string }) => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Visualizar detalhes do Índice de Risco</AccordionTrigger>
        <AccordionContent>
            <div className="text-sm text-foreground/90 p-2 whitespace-pre-wrap">
                {notes}
            </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  function isN3IndividualNotes(notes: any): notes is N3IndividualNotes {
    return notes && (typeof notes.captacao !== 'undefined' || typeof notes.esforcos !== 'undefined');
  }

  function isN2IndividualNotes(notes: any): notes is N2IndividualNotes {
    return notes && typeof notes.captacaoTIME !== 'undefined' && typeof notes.notaRanking !== 'undefined';
  }

  function isQualityIndexNotes(notes: any): notes is QualityIndexNotes {
    return notes && typeof notes.performanceTime !== 'undefined' && typeof notes.qualityScore !== 'undefined';
  }

  const N2IndividualDetails = ({ notes }: { notes: N2IndividualNotes }) => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Visualizar detalhes do N2 Individual</AccordionTrigger>
        <AccordionContent>
            <div className="space-y-4 text-sm text-foreground/90 p-2">
                <div>
                    <h4 className="font-semibold mb-2">Indicadores TIME</h4>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Captação TIME:</span>
                            <span className="font-mono font-medium">{formatCurrency(notes.captacaoTIME)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Churn PF TIME:</span>
                            <span className="font-mono font-medium">{formatPercentage(notes.churnPFTIME)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">ROA TIME:</span>
                            <span className="font-mono font-medium">{formatPercentage(notes.roaTIME)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Nota Ranking:</span>
                            <span className="font-mono font-medium">{Math.round(notes.notaRanking)} %</span>
                        </div>
                    </div>
                </div>
                <Separator />
                {notes.planoAcao && <div><h4 className="font-semibold mb-1">Plano de Ação</h4><p className="whitespace-pre-wrap">{notes.planoAcao}</p></div>}
                {notes.anotacoes && <div><h4 className="font-semibold mb-1">Anotações</h4><p className="whitespace-pre-wrap">{notes.anotacoes}</p></div>}
            </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const QualityIndexDetails = ({ notes }: { notes: QualityIndexNotes }) => {
    const getFlagColor = (flag: "red" | "neutral" | "green") => {
      if (flag === "red") return "text-destructive";
      if (flag === "green") return "text-green-600";
      return "text-muted-foreground";
    };

    const getFlagLabel = (flag: "red" | "neutral" | "green") => {
      if (flag === "red") return "Red Flag";
      if (flag === "green") return "Green Flag";
      return "Neutro";
    };

    return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Visualizar detalhes do Índice de Qualidade</AccordionTrigger>
          <AccordionContent>
              <div className="space-y-4 text-sm text-foreground/90 p-2">
                  <div>
                      <h4 className="font-semibold mb-2">Categorias Avaliadas</h4>
                      <div className="space-y-2">
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Performance TIME:</span>
                              <span className={cn("font-medium", getFlagColor(notes.performanceTime))}>
                                  {getFlagLabel(notes.performanceTime)}
                              </span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Relacionamento TIME:</span>
                              <span className={cn("font-medium", getFlagColor(notes.relacionamentoTime))}>
                                  {getFlagLabel(notes.relacionamentoTime)}
                              </span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Remuneração:</span>
                              <span className={cn("font-medium", getFlagColor(notes.remuneracao))}>
                                  {getFlagLabel(notes.remuneracao)}
                              </span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Desenvolvimento Técnico:</span>
                              <span className={cn("font-medium", getFlagColor(notes.desenvolvimentoTecnico))}>
                                  {getFlagLabel(notes.desenvolvimentoTecnico)}
                              </span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Processos de Gestão:</span>
                              <span className={cn("font-medium", getFlagColor(notes.processosGestao))}>
                                  {getFlagLabel(notes.processosGestao)}
                              </span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Aderência a Campanhas:</span>
                              <span className={cn("font-medium", getFlagColor(notes.aderenciaCampanhas))}>
                                  {getFlagLabel(notes.aderenciaCampanhas)}
                              </span>
                          </div>
                      </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                      <span className="font-semibold">Índice de Qualidade Total:</span>
                      <span className={cn("font-bold text-lg", notes.qualityScore > 0 ? "text-green-600" : notes.qualityScore < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {notes.qualityScore}
                      </span>
                  </div>
              </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };
  
  // Função para agrupar interações por mês
  function groupByMonth(interactions: Interaction[]) {
    const groups = new Map<string, { key: string; label: string; interactions: Interaction[] }>();
    
    interactions.forEach(interaction => {
      if (!interaction.date) return;
      const date = new Date(interaction.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      if (!groups.has(key)) {
        groups.set(key, { key, label: capitalizedMonth, interactions: [] });
      }
      groups.get(key)!.interactions.push(interaction);
    });
    
    return Array.from(groups.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(group => ({
        ...group,
        interactions: group.interactions.sort((a, b) => 
          (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0)
        )
      }));
  }

  // Componente para renderizar uma interação individual
  const InteractionItem = ({ item }: { item: Interaction }) => (
    <div className="relative flex items-start gap-4">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary z-10">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground", item.type === 'Índice de Risco' && "text-destructive")}>
            {item.type ? interactionIcons[item.type] : null}
        </span>
      </div>
      <div className="flex-1 pt-0.5">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium">{item.type}</p>
        </div>
        <div className="flex items-center text-xs text-muted-foreground gap-2">
            <span>{item.date ? formatDate(item.date) : 'Data indisponível'}</span>
            {item.source && (
                <>
                    <span className="text-muted-foreground/50">|</span>
                    <span>Origem: {item.source}</span>
                </>
            )}
        </div>
        {item.type === 'Índice de Risco' && typeof item.riskScore === 'number' && (
            <div className="text-xs font-bold text-foreground mt-2">
              Pontuação: {item.riskScore}
            </div>
        )}
        {item.type === 'Índice de Qualidade' && typeof item.qualityScore === 'number' && (
            <div className={cn("text-xs font-bold mt-2", item.qualityScore > 0 ? "text-green-600" : item.qualityScore < 0 ? "text-destructive" : "text-muted-foreground")}>
              Índice de Qualidade: {item.qualityScore}
            </div>
        )}
        {item.type === 'Feedback' && typeof item.notes === 'object' && item.notes && 'indicator' in item.notes && item.notes.indicator && (
            <div className="text-sm font-bold text-foreground mt-2">
              Indicador: {item.notes.indicator}
            </div>
        )}
        <div className="mt-2 text-sm">
            {typeof item.notes === 'string' && item.type === 'Feedback' ? (
                 <p className="whitespace-pre-wrap">{item.notes}</p>
            ) : typeof item.notes === 'object' && item.type === 'Feedback' && item.notes && 'content' in item.notes ? (
                 <p className="whitespace-pre-wrap">{item.notes.content}</p>
            ) : typeof item.notes === 'string' && item.type === 'Índice de Risco' ? (
                <RiskAssessmentDetails notes={item.notes} />
            ) : item.type === '1:1' && item.notes ? (
                <OneOnOneDetails notes={item.notes as OneOnOneNotes} />
            ) : item.type === 'N3 Individual' && isN3IndividualNotes(item.notes) ? (
                <N3IndividualDetails notes={item.notes as N3IndividualNotes} />
            ) : item.type === 'N2 Individual' && isN2IndividualNotes(item.notes) ? (
                <N2IndividualDetails notes={item.notes as N2IndividualNotes} />
            ) : item.type === 'Índice de Qualidade' && isQualityIndexNotes(item.notes) ? (
                <QualityIndexDetails notes={item.notes as QualityIndexNotes} />
            ) : null}
        </div>
      </div>
    </div>
  );

export function Timeline({ interactions, isLoading }: { interactions: Interaction[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-3 w-[80px]" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (interactions.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">Nenhuma interação registrada para este colaborador.</p>
  }

  const monthGroups = groupByMonth(interactions);
  
  // Determinar o mês mais recente (primeiro grupo) para expandir por padrão
  const defaultOpenMonth = monthGroups.length > 0 ? [monthGroups[0].key] : [];
  
  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={defaultOpenMonth} className="w-full space-y-4">
        {monthGroups.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border rounded-lg">
            <Card>
              <CardHeader className="p-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>div>svg]:rotate-180">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-base">{group.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-normal">
                        {group.interactions.length} {group.interactions.length === 1 ? 'interação' : 'interações'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent className="px-4 pb-4 pt-2">
                <CardContent className="p-0">
                  <div className="relative space-y-6">
                    <div className="absolute left-3 top-3 h-[calc(100%-1.5rem)] w-0.5 bg-border" aria-hidden="true" />
                    {group.interactions.map((item) => (
                      <InteractionItem key={item.id} item={item} />
                    ))}
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
