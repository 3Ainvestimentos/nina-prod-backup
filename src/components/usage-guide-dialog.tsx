
"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const guideSections = [
    {
        title: "Dashboard de Liderança",
        content: "Esta é a tela principal, seu centro de comando. Oferece uma visão completa e em tempo real do status das interações com sua equipe. A tabela de frequência mostra o progresso das interações obrigatórias (1:1, PDI, Índice de Risco, N3 Individual) para cada colaborador. Use o menu expansível (clicando no nome do colaborador) para ver um resumo detalhado e a aderência geral de cada um."
    },
    {
        title: "Acompanhamento Individual",
        content: "O coração do registro histórico. Aqui você pode selecionar um colaborador para visualizar uma linha do tempo cronológica com todas as interações já realizadas. Para registrar um novo evento, basta usar o botão 'Nova Interação'. Formulários específicos e guiados estão disponíveis para 1:1, N3 Individual e Avaliação de Risco, garantindo que as informações corretas sejam coletadas em cada tipo de conversa."
    },
    {
        title: "Plano de Desenvolvimento Individual (PDI)",
        content: "Gerencie ativamente o crescimento de cada membro da equipe. Nesta página, você pode adicionar ou editar um 'Diagnóstico Profissional', que é uma avaliação geral do momento do colaborador (pontos fortes, fracos, etc.). Abaixo, a tabela de ações permite criar, editar e acompanhar tarefas específicas de desenvolvimento (como cursos, leituras ou projetos), cada uma com descrição, prazos e status."
    },
    {
        title: "Análise de Risco",
        content: "Uma ferramenta visual para comparar e analisar o índice de risco dos colaboradores. A página permite selecionar múltiplos membros da equipe para uma análise lado a lado. O gráfico de barras mostra a distribuição de risco atual, ideal para identificar quem precisa de mais atenção, enquanto o gráfico de linhas exibe a evolução histórica, ajudando a identificar tendências e o impacto de suas ações ao longo do tempo."
    },
    {
        title: "Ranking de Aderência",
        content: "Uma forma de medir e incentivar a performance da liderança. Esta página exibe um ranking de líderes baseado no 'Índice de Aderência', que é o percentual de interações obrigatórias realizadas em relação ao total previsto para o período. É o principal indicador de engajamento da liderança com o processo de gestão. Use os filtros para analisar por período."
    }
];

const faqSections = [
    {
        question: "Quais interações são obrigatórias e quando devo realizá-las?",
        answer: "As interações obrigatórias e suas frequências são:\n\n- **N3 Individual:** A frequência varia com o segmento do colaborador (Alfa: 4/mês, Beta: 2/mês, Senior: 1/mês).\n- **Índice de Risco:** Deve ser registrado mensalmente para acompanhar a evolução do colaborador.\n- **1:1 (One-on-One):** É uma interação trimestral. Os registros são esperados nos meses de Março, Junho, Setembro e Dezembro.\n- **PDI (Diagnóstico):** A avaliação do diagnóstico é semestral. Os registros são esperados nos meses de Janeiro e Julho."
    },
    {
        question: "Qual o limite de registros por tipo de interação?",
        answer: "Para garantir a organização e a qualidade dos dados, o sistema aplica limites mensais para o registro de interações por colaborador:\n\n- **N3 Individual:** O limite depende do segmento do colaborador (Alfa: 4/mês, Beta: 2/mês, Senior: 1/mês).\n- **Feedback:** É possível registrar até 10 interações de feedback por mês.\n- **Índice de Risco:** Limitado a 1 registro por mês.\n- **1:1 (One-on-One):** Limitado a 1 registro por mês.\n- **PDI (Ações e Diagnóstico):** Limitado a 1 registro por mês."
    },
    {
        question: "Como o 'Índice de Aderência' é calculado no Ranking?",
        answer: "O Índice de Aderência mede a proporção de interações obrigatórias que um líder realizou com sua equipe em relação ao total previsto para o período selecionado. Por exemplo, se um líder deveria ter 10 interações no mês e realizou 8, seu índice será de 80%. Apenas as interações 'N3 Individual', 'Índice de Risco', '1:1' e 'PDI' contam para este cálculo."
    },
    {
        question: "Por que não consigo ver todos os colaboradores nos filtros?",
        answer: "Seu nível de acesso determina quem você pode visualizar. Líderes veem apenas os membros de sua equipe direta. Diretores e Administradores têm permissão para visualizar todos os colaboradores da empresa e podem usar o filtro de equipes para focar em um líder específico."
    },
     {
        question: "O que significa o status 'Realizado X/Y'?",
        answer: "Este status indica o progresso de uma interação obrigatória que ocorre várias vezes. Por exemplo, 'Realizado 1/4' para um 1:1 significa que uma das quatro interações anuais esperadas já foi registrada. Quando todas as interações do período forem concluídas, o status mudará para 'Executada'."
    },
    {
        question: "Por que devo preencher o Índice de Risco todo mês? Como vejo os dados?",
        answer: "O preenchimento mensal é crucial para criar uma série histórica. Isso permite que você, na página 'Análise de Risco', visualize a evolução da percepção de risco de um colaborador ao longo do tempo em um gráfico de linhas. Essa análise histórica é muito mais valiosa do que um dado pontual, pois revela tendências, o impacto de ações de desenvolvimento e possíveis pontos de atenção."
    },
    {
        question: "Realizei um 1:1 fora do mês obrigatório. Por que o status no dashboard não mudou?",
        answer: "O dashboard e o Índice de Aderência funcionam com base em um cronograma fixo para garantir uma medição padronizada para toda a liderança (ex: 1:1 é esperado em Março, Junho, etc.). Interações realizadas fora desses meses são importantes e ficam registradas no histórico do colaborador na página 'Acompanhamento Individual', mas não contam para a meta de aderência daquele período específico."
    }
];


export function UsageGuideDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton tooltip="Guia de Uso" className="w-full">
          <BookOpen />
          <span>Guia de Uso</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Guia de Uso do CRM Interno 1.0</DialogTitle>
          <DialogDescription>
            Encontre aqui todas as informações sobre as funcionalidades da plataforma.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="faq">Perguntas Frequentes (FAQ)</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-6 -mr-6">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-0">
                            <AccordionTrigger>Autenticação</AccordionTrigger>
                            <AccordionContent className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                                <p>O login é seguro e realizado exclusivamente através de contas Google corporativas. Após a autenticação, o sistema verifica se o usuário possui um papel de `Líder`, `Diretor` ou `Admin` para conceder o acesso. Usuários com o papel de `Colaborador` não têm permissão para acessar o dashboard.</p>
                            </AccordionContent>
                        </AccordionItem>
                        {guideSections.map((section, index) => (
                            <AccordionItem value={`item-${index + 1}`} key={index}>
                                <AccordionTrigger>{section.title}</AccordionTrigger>
                                <AccordionContent className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                                    <p>{section.content}</p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </ScrollArea>
            </TabsContent>
            <TabsContent value="faq" className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-6 -mr-6">
                    <Accordion type="single" collapsible className="w-full">
                        {faqSections.sort((a,b) => a.question.localeCompare(b.question)).map((faq, index) => (
                            <AccordionItem value={`faq-${index}`} key={index}>
                                <AccordionTrigger>{faq.question}</AccordionTrigger>
                                <AccordionContent className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                                    <p className="whitespace-pre-wrap">{faq.answer}</p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </ScrollArea>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

    