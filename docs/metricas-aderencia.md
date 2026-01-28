# 📊 Métricas de Aderência - Nina 1.0

**Objetivo:** Definir métricas para medir a aderência ao uso da plataforma e identificar oportunidades de melhoria.

**Última atualização:** 2025-01-27

---

## 🎯 Filosofia das Métricas

**Foco em Ações, Não em Acesso**

Este documento define métricas baseadas em **ações reais** dos usuários no sistema (criar interações, PDI, projetos, etc.), não em métricas de acesso/login. 

**Por quê?**
- O uso efetivo é medido pelo que o usuário **faz**, não pela frequência de login
- O ranking já calcula aderência baseado em interações
- Métricas de login podem ser enganosas (usuário pode logar mas não usar)
- Ações são mais fáceis de rastrear e mais significativas para análise

**O que medimos:**
- ✅ Criação/edição de interações
- ✅ Criação/edição de PDI
- ✅ Criação/edição de projetos
- ✅ Uso de funcionalidades avançadas
- ✅ Qualidade dos dados inseridos
- ❌ Não medimos: login, tempo de sessão, frequência de acesso

---

## 📋 Índice

1. [Métricas de Uso Baseadas em Ações](#1-métricas-de-uso-baseadas-em-ações)
2. [Métricas de Aderência a Processos](#2-métricas-de-aderência-a-processos)
3. [Métricas de Qualidade de Dados](#3-métricas-de-qualidade-de-dados)
4. [Métricas de Engajamento](#4-métricas-de-engajamento)
5. [Métricas de Eficácia](#5-métricas-de-eficácia)
6. [Métricas Técnicas](#6-métricas-técnicas)
7. [Como Implementar](#7-como-implementar)

---

## 1. Métricas de Uso Baseadas em Ações

> **Nota:** Estas métricas são baseadas em ações reais no sistema (interações, PDI, projetos), não em login/acesso. O uso efetivo é medido pelo que o usuário faz, não pela frequência de login.

### 1.1. Taxa de Usuários Ativos por Ações
**Descrição:** Percentual de usuários que realizaram pelo menos uma ação relevante no período (criar interação, PDI, projeto, etc.).

**Cálculo:**
```
Taxa de Usuários Ativos = (Usuários com pelo menos 1 ação no período / Total de usuários elegíveis) × 100

Onde "ação" inclui:
- Criar/editar interação
- Criar/editar PDI
- Criar/editar projeto
- Criar/editar premissa
- Visualizar ranking (para diretores/admins)
```

**Meta:** ≥ 85% dos líderes/diretores/admins ativos mensalmente

**Granularidade:** Por role (Líder, Diretor, Admin), por mês

---

### 1.2. Taxa de Retenção por Ações
**Descrição:** Percentual de usuários que continuam realizando ações no sistema após o primeiro uso.

**Cálculo:**
```
Taxa de Retenção (30 dias) = (Usuários com ações nos últimos 30 dias / Usuários que fizeram primeira ação há 30+ dias) × 100
```

**Meta:** ≥ 75% de retenção em 30 dias

**Granularidade:** Por role, por período

---

### 1.3. Taxa de Edição de Interações
**Descrição:** Percentual de interações que foram editadas após criação (indica cuidado com qualidade dos dados).

**Cálculo:**
```
Taxa de Edição = (Interações editadas / Total de interações criadas) × 100
```

**Observação:** Interações editadas podem indicar:
- Correção de dados
- Adição de informações complementares
- Ajuste de detalhes

**Meta:** ≥ 15% de interações editadas (indica atenção aos detalhes)

**Granularidade:** Por tipo de interação, por líder, por período

---

### 1.4. Taxa de Uso de Funcionalidades Avançadas
**Descrição:** Percentual de líderes que utilizam funcionalidades além das obrigatórias.

**Funcionalidades avançadas:**
- Criação de Projetos
- Criação de Premissas
- Uso de Feedback (além do mínimo)
- Análise de Risco detalhada
- Análise de Qualidade (diretores)

**Cálculo:**
```
Taxa de Uso Avançado = (Líderes usando funcionalidades avançadas / Total de líderes) × 100
```

**Meta:** ≥ 50% de líderes usando pelo menos 1 funcionalidade avançada

**Granularidade:** Por funcionalidade, por líder

---

## 2. Métricas de Aderência a Processos

### 2.1. Taxa de Aderência a Interações Obrigatórias

#### 2.1.1. Aderência a 1:1 (Trimestral)
**Descrição:** Percentual de colaboradores que receberam 1:1 nos meses obrigatórios (Mar, Jun, Set, Dez).

**Cálculo:**
```
Aderência 1:1 = (Colaboradores com 1:1 registrado no mês obrigatório / Total de colaboradores sob gestão) × 100
```

**Meta:** ≥ 95% de aderência nos meses obrigatórios

**Granularidade:** Por líder, por mês, por trimestre

---

#### 2.1.2. Aderência a Índice de Risco (Mensal)
**Descrição:** Percentual de colaboradores com Índice de Risco registrado mensalmente.

**Cálculo:**
```
Aderência Índice de Risco = (Colaboradores com Índice de Risco no mês / Total de colaboradores sob gestão) × 100
```

**Meta:** ≥ 90% de aderência mensal

**Granularidade:** Por líder, por mês

---

#### 2.1.3. Aderência a N3 Individual (Segmento)
**Descrição:** Percentual de colaboradores que receberam N3 Individual conforme frequência esperada por segmento.

**Cálculo:**
```
Aderência N3 = (N3 realizadas no mês / N3 esperadas no mês) × 100

Onde:
- Alfa: 4 N3/mês esperadas
- Beta: 2 N3/mês esperadas
- Senior: 1 N3/mês esperada
```

**Meta:** ≥ 85% de aderência por segmento

**Granularidade:** Por líder, por segmento, por mês

---

#### 2.1.4. Aderência a PDI (Semestral)
**Descrição:** Percentual de colaboradores com PDI (Diagnóstico) registrado nos meses obrigatórios (Jan, Jul).

**Cálculo:**
```
Aderência PDI = (Colaboradores com PDI registrado no mês obrigatório / Total de colaboradores sob gestão) × 100
```

**Meta:** ≥ 90% de aderência nos meses obrigatórios

**Granularidade:** Por líder, por semestre

---

#### 2.1.5. Aderência a N2 Individual (Diretores)
**Descrição:** Percentual de líderes que receberam N2 Individual conforme frequência esperada.

**Cálculo:**
```
Aderência N2 = (N2 realizadas no período / N2 esperadas no período) × 100

Onde a frequência esperada depende da frequência de reunião do líder:
- Semanal: 4 N2/mês
- Quinzenal: 2 N2/mês
- Mensal: 1 N2/mês
```

**Meta:** ≥ 85% de aderência

**Granularidade:** Por diretor, por líder, por mês

---

#### 2.1.6. Aderência a Índice de Qualidade (Diretores)
**Descrição:** Percentual de líderes com Índice de Qualidade registrado mensalmente.

**Cálculo:**
```
Aderência Índice de Qualidade = (Líderes com Índice de Qualidade no mês / Total de líderes sob gestão) × 100
```

**Meta:** ≥ 90% de aderência mensal

**Granularidade:** Por diretor, por mês

---

### 2.2. Taxa de Aderência Global por Líder
**Descrição:** Score consolidado de aderência de um líder considerando todas as interações obrigatórias.

**Cálculo:**
```
Score de Aderência = Média ponderada de todas as aderências de interações obrigatórias

Pesos sugeridos:
- 1:1: 25%
- Índice de Risco: 25%
- N3 Individual: 30%
- PDI: 20%
```

**Meta:** ≥ 90% de score global

**Granularidade:** Por líder, por mês, por trimestre, por ano

---

### 2.3. Taxa de Aderência a Prazos
**Descrição:** Percentual de interações registradas dentro do prazo esperado.

**Cálculo:**
```
Aderência a Prazos = (Interações registradas no mês obrigatório / Total de interações esperadas) × 100
```

**Observação:** Considerar janela de tolerância (ex: 1:1 pode ser registrado até 15 dias após o mês obrigatório)

**Meta:** ≥ 85% dentro do prazo, ≥ 95% com tolerância

---

### 2.4. Taxa de Completude de PDI
**Descrição:** Percentual de ações de PDI concluídas dentro do prazo.

**Cálculo:**
```
Completude PDI = (Ações de PDI concluídas / Total de ações de PDI criadas) × 100
```

**Meta:** ≥ 80% de ações concluídas

**Granularidade:** Por colaborador, por líder, por período

---

## 3. Métricas de Qualidade de Dados

### 3.1. Taxa de Preenchimento de Campos Obrigatórios
**Descrição:** Percentual de interações com todos os campos obrigatórios preenchidos.

**Cálculo:**
```
Taxa de Preenchimento = (Interações com campos obrigatórios completos / Total de interações) × 100
```

**Campos obrigatórios por tipo:**
- **1:1:** companyGrowth, leaderGrowth, teamGrowth, personalLife, observations
- **N3 Individual:** captacao, churnPF, roa, esforcos, planoAcao
- **N2 Individual:** captacaoTIME, churnPFTIME, roaTIME, notaRanking, planoAcao, anotacoes
- **Índice de Qualidade:** Todos os 6 flags (performanceTime, relacionamentoTime, etc.)
- **Índice de Risco:** riskScore calculado

**Meta:** ≥ 95% de preenchimento completo

---

### 3.2. Taxa de Interações com Conteúdo Significativo
**Descrição:** Percentual de interações com conteúdo textual relevante (não apenas placeholders ou texto genérico).

**Cálculo:**
```
Taxa de Conteúdo Significativo = (Interações com conteúdo relevante / Total de interações) × 100
```

**Critérios de "conteúdo significativo":**
- Texto com ≥ 20 caracteres
- Não contém apenas espaços ou caracteres especiais
- Não é texto genérico padrão (ex: "N/A", "Sem observações")

**Meta:** ≥ 80% de interações com conteúdo significativo

---

### 3.3. Taxa de Atualização de Dados de Colaboradores
**Descrição:** Percentual de colaboradores com dados atualizados (diagnóstico, riskScore, etc.).

**Cálculo:**
```
Taxa de Atualização = (Colaboradores com dados atualizados nos últimos 90 dias / Total de colaboradores) × 100
```

**Meta:** ≥ 85% de colaboradores com dados atualizados

---

### 3.4. Taxa de Consistência de Dados
**Descrição:** Percentual de dados consistentes entre diferentes fontes (ex: leaderId vs leaderEmail).

**Cálculo:**
```
Taxa de Consistência = (Registros com dados consistentes / Total de registros) × 100
```

**Verificações:**
- leaderId corresponde a um employee válido
- leaderEmail corresponde ao email do leaderId
- Campos relacionados estão sincronizados

**Meta:** ≥ 98% de consistência

---

## 4. Métricas de Engajamento

### 4.1. Taxa de Criação de Diagnósticos
**Descrição:** Percentual de colaboradores com diagnóstico registrado (PDI).

**Cálculo:**
```
Taxa de Diagnóstico = (Colaboradores com diagnóstico registrado / Total de colaboradores sob gestão) × 100
```

**Meta:** ≥ 90% de colaboradores com diagnóstico

**Granularidade:** Por líder, por período

---

### 4.2. Taxa de Uso de Análises
**Descrição:** Percentual de líderes que utilizam as páginas de análise (Risco, Qualidade).

**Cálculo:**
```
Taxa de Uso de Análises = (Líderes que visualizaram análises no período / Total de líderes) × 100
```

**Observação:** Medido pela criação/visualização de interações de análise, não apenas acesso à página.

**Meta:** ≥ 60% de líderes usando análises

**Granularidade:** Por tipo de análise, por período

---

### 4.3. Taxa de Criação de Projetos
**Descrição:** Percentual de líderes que criaram pelo menos um projeto.

**Cálculo:**
```
Taxa de Criação = (Líderes com pelo menos 1 projeto / Total de líderes) × 100
```

**Meta:** ≥ 50% de líderes com projetos criados

**Granularidade:** Por período

---

### 4.4. Taxa de Interações em Projetos
**Descrição:** Percentual de projetos com interações registradas (indica uso efetivo de projetos).

**Cálculo:**
```
Taxa de Interações em Projetos = (Projetos com pelo menos 1 interação / Total de projetos) × 100
```

**Meta:** ≥ 70% de projetos com interações

**Granularidade:** Por líder, por período

---

### 4.5. Taxa de Uso de Feedback
**Descrição:** Percentual de líderes que utilizam a funcionalidade de Feedback (além das interações obrigatórias).

**Cálculo:**
```
Taxa de Uso de Feedback = (Líderes que registraram pelo menos 1 feedback no período / Total de líderes) × 100
```

**Meta:** ≥ 60% de líderes usando feedback

**Granularidade:** Por período

---

### 4.6. Taxa de Uso de Premissas
**Descrição:** Percentual de líderes que utilizam a funcionalidade de Premissas e Projeções.

**Cálculo:**
```
Taxa de Uso de Premissas = (Líderes com pelo menos 1 premissa criada / Total de líderes) × 100
```

**Meta:** ≥ 40% de líderes usando premissas

**Granularidade:** Por período

---

### 4.7. Taxa de Colaboradores com Timeline Completa
**Descrição:** Percentual de colaboradores com histórico completo de interações (sem grandes lacunas temporais).

**Cálculo:**
```
Taxa de Timeline Completa = (Colaboradores com timeline completa / Total de colaboradores sob gestão) × 100

Onde "timeline completa" significa:
- Interações registradas regularmente
- Sem lacunas maiores que 2 meses consecutivos
- Pelo menos 1 interação nos últimos 30 dias
```

**Meta:** ≥ 80% de colaboradores com timeline completa

**Granularidade:** Por líder, por período

---

### 4.8. Taxa de Diversificação de Tipos de Interação
**Descrição:** Percentual de líderes que utilizam múltiplos tipos de interação (não apenas os obrigatórios).

**Cálculo:**
```
Taxa de Diversificação = (Líderes usando ≥3 tipos diferentes de interação / Total de líderes) × 100

Tipos de interação:
- 1:1
- N3 Individual
- Índice de Risco
- Feedback
- PDI
- N2 Individual (diretores)
- Índice de Qualidade (diretores)
```

**Meta:** ≥ 70% de líderes usando múltiplos tipos

**Granularidade:** Por período

---

### 4.9. Taxa de Interações por Colaborador
**Descrição:** Média de interações registradas por colaborador no período (indica intensidade de acompanhamento).

**Cálculo:**
```
Média de Interações = Total de interações registradas / Total de colaboradores sob gestão
```

**Observação:** Considerar apenas interações não-obrigatórias (Feedback) ou todas as interações.

**Meta:** ≥ 2 interações/mês por colaborador (incluindo obrigatórias)

**Granularidade:** Por líder, por período

---

### 4.10. Taxa de Uso de Projetos vs Interações Individuais
**Descrição:** Percentual de interações registradas em projetos vs interações individuais (indica uso de funcionalidade de projetos).

**Cálculo:**
```
Taxa de Uso de Projetos = (Interações em projetos / Total de interações) × 100
```

**Meta:** ≥ 20% de interações em projetos (quando projetos existem)

**Granularidade:** Por líder, por período

---

## 5. Métricas de Eficácia

### 5.1. Taxa de Melhoria de Risk Score
**Descrição:** Percentual de colaboradores que melhoraram seu Risk Score ao longo do tempo.

**Cálculo:**
```
Taxa de Melhoria = (Colaboradores com Risk Score melhorado / Total de colaboradores acompanhados) × 100

Onde:
- Melhoria = Risk Score atual < Risk Score de 3 meses atrás
```

**Meta:** ≥ 60% de colaboradores com melhoria em 6 meses

---

### 5.2. Taxa de Conclusão de Ações de PDI
**Descrição:** Percentual de ações de PDI concluídas dentro do prazo.

**Cálculo:**
```
Taxa de Conclusão = (Ações concluídas dentro do prazo / Total de ações criadas) × 100
```

**Meta:** ≥ 75% de ações concluídas dentro do prazo

---

### 5.3. Taxa de Evolução de Quality Score (Líderes)
**Descrição:** Percentual de líderes que melhoraram seu Quality Score.

**Cálculo:**
```
Taxa de Evolução = (Líderes com Quality Score melhorado / Total de líderes acompanhados) × 100
```

**Meta:** ≥ 50% de líderes com melhoria em 6 meses

---

### 5.4. Taxa de Visualização do Ranking
**Descrição:** Percentual de líderes/diretores que visualizaram a página de ranking (indica interesse em acompanhar performance).

**Cálculo:**
```
Taxa de Visualização = (Usuários que visualizaram ranking no período / Total de usuários elegíveis) × 100
```

**Observação:** Medido pela criação de interações N2 Individual (que calcula ranking) ou acesso à página de ranking.

**Meta:** ≥ 70% de líderes/diretores visualizando ranking

**Granularidade:** Por período

---

### 5.5. Taxa de Melhoria Contínua
**Descrição:** Percentual de colaboradores/líderes que melhoraram em múltiplas métricas simultaneamente.

**Cálculo:**
```
Taxa de Melhoria Contínua = (Colaboradores/líderes com melhoria em ≥2 métricas / Total acompanhados) × 100

Métricas consideradas:
- Risk Score (colaboradores)
- Quality Score (líderes)
- Aderência a interações
- Completude de PDI
```

**Meta:** ≥ 40% com melhoria contínua em 6 meses

**Granularidade:** Por período

---

## 6. Métricas Técnicas

### 6.1. Taxa de Erros do Sistema
**Descrição:** Percentual de operações que resultaram em erro.

**Cálculo:**
```
Taxa de Erros = (Operações com erro / Total de operações) × 100
```

**Tipos de erros:**
- Erros de autenticação
- Erros de permissão
- Erros de validação
- Erros de salvamento
- Erros de carregamento

**Meta:** ≤ 2% de taxa de erros

---

### 6.2. Tempo Médio de Resposta
**Descrição:** Tempo médio de resposta das operações do sistema.

**Métricas:**
- Tempo de carregamento de páginas
- Tempo de salvamento de interações
- Tempo de carregamento de dados

**Meta:** ≤ 2 segundos para operações críticas

---

### 6.3. Taxa de Disponibilidade
**Descrição:** Percentual de tempo que o sistema está disponível.

**Cálculo:**
```
Disponibilidade = (Tempo disponível / Tempo total) × 100
```

**Meta:** ≥ 99.5% de disponibilidade (uptime)

---

## 7. Como Implementar

### 7.1. Coleta de Dados

#### 7.1.1. Eventos a Rastrear
- Criação/edição de interações (todos os tipos)
- Criação/edição de PDI (ações e diagnósticos)
- Criação/edição de projetos
- Criação/edição de interações em projetos
- Criação/edição de premissas
- Visualização de ranking (através de criação de N2 Individual)
- Erros do sistema

#### 7.1.2. Onde Armazenar
- **Firestore:** Criar coleção `analytics` ou `metrics`
- **Cloud Functions:** Processar eventos e calcular métricas
- **Dashboard Admin:** Visualizar métricas em tempo real

### 7.2. Estrutura de Dados Sugerida

```typescript
interface Metric {
  id: string;
  type: 'usage' | 'adherence' | 'quality' | 'engagement' | 'efficacy' | 'technical';
  category: string; // ex: 'interaction_1on1', 'login_frequency'
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  periodStart: string; // ISO 8601
  periodEnd: string; // ISO 8601
  value: number; // Valor da métrica
  target: number; // Meta
  metadata?: {
    leaderId?: string;
    employeeId?: string;
    role?: string;
    [key: string]: any;
  };
  calculatedAt: string; // ISO 8601
}

interface UserActivity {
  userId: string;
  date: string; // ISO 8601
  events: {
    type: 'interaction_create' | 'interaction_edit' | 'pdi_create' | 'pdi_edit' | 'project_create' | 'project_interaction' | 'premissa_create' | 'error';
    timestamp: string; // ISO 8601
    metadata?: {
      interactionType?: string;
      employeeId?: string;
      projectId?: string;
      [key: string]: any;
    };
  }[];
}
```

### 7.3. Funções Cloud Functions Sugeridas

1. **`calculateAdherenceMetrics`** - Calcula métricas de aderência diariamente
2. **`calculateUsageMetrics`** - Calcula métricas de uso semanalmente
3. **`calculateQualityMetrics`** - Calcula métricas de qualidade mensalmente
4. **`generateAdherenceReport`** - Gera relatório consolidado mensal

### 7.4. Dashboard de Métricas

Criar página `/dashboard/admin/metrics` com:
- Visão geral das métricas principais
- Gráficos de tendência
- Comparação entre líderes
- Alertas de métricas abaixo da meta
- Exportação de relatórios

### 7.5. Alertas e Notificações

- Enviar alertas quando métricas ficarem abaixo da meta
- Notificar líderes sobre aderência baixa
- Notificar admins sobre problemas técnicos

---

## 8. Priorização de Implementação

### Fase 1 (Crítico - Implementar Primeiro)
1. ✅ Taxa de Aderência a Interações Obrigatórias (todas)
2. ✅ Taxa de Aderência Global por Líder
3. ✅ Taxa de Preenchimento de Campos Obrigatórios
4. ✅ Taxa de Usuários Ativos por Ações

### Fase 2 (Importante)
5. ✅ Taxa de Completude de PDI
6. ✅ Taxa de Retenção por Ações
7. ✅ Taxa de Erros do Sistema
8. ✅ Taxa de Uso de Funcionalidades Avançadas

### Fase 3 (Desejável)
9. ✅ Taxa de Melhoria de Risk Score
10. ✅ Taxa de Consistência de Dados
11. ✅ Taxa de Edição de Interações
12. ✅ Taxa de Colaboradores com Timeline Completa

---

## 9. Exemplos de Relatórios

### 9.1. Relatório de Aderência Mensal por Líder
```
Líder: João Silva
Período: Janeiro 2025

Interações Obrigatórias:
- 1:1: 12/15 (80%) ⚠️ Meta: 95%
- Índice de Risco: 15/15 (100%) ✅
- N3 Individual: 45/50 (90%) ✅
- PDI: 15/15 (100%) ✅

Score Global: 92.5% ✅
```

### 9.2. Relatório de Uso por Ações
```
Período: Janeiro 2025

Usuários Ativos (por ações): 43/50 (86%) ✅
Taxa de Retenção (30 dias): 82% ✅
Taxa de Uso de Funcionalidades Avançadas: 52% ✅
- Projetos criados: 28 líderes (56%)
- Premissas criadas: 18 líderes (36%)
- Feedback utilizado: 32 líderes (64%)

Taxa de Edição de Interações: 18% ✅
```

---

## 10. Próximos Passos

1. **Revisar e aprovar métricas** com stakeholders
2. **Definir metas específicas** por período e role
3. **Implementar coleta de dados** (Cloud Functions)
4. **Criar dashboard de métricas** (página admin)
5. **Configurar alertas** e notificações
6. **Validar métricas** com dados reais
7. **Ajustar metas** baseado em baseline

---

**Nota:** Este documento é um guia inicial. As métricas devem ser revisadas e ajustadas conforme o uso real do sistema e feedback dos usuários.

