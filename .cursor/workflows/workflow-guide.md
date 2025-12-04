# 🎯 GUIA DO WORKFLOW - Worker + Orchestrator

Este guia explica como usar o sistema onde o **Worker sugere código** e o **Orchestrator aprova/rejeita** antes da implementação.

## 📊 FLUXO DO WORKFLOW

```
1. WORKER (modelo mais barato - Haiku 4.5) → Sugere código
   ↓
2. ORCHESTRATOR (você ou modelo mais caro - Opus 4.5) → Analisa e aprova/rejeita
   ↓
3a. APROVADO → Implementa o código
3b. REJEITADO → Volta para WORKER com feedback
```

## 🚀 COMO USAR

### PASSO 1: Worker Sugere Código

1. Abra o arquivo `.cursor/workflows/worker-prompt.md`
2. Preencha:
   - **TAREFA:** O que você quer implementar
   - **CONTEXTO:** Informações relevantes do projeto
   - **ARQUIVOS RELEVANTES:** Arquivos similares que o Worker deve consultar
3. Cole no Cursor Chat
4. **Selecione o modelo Haiku 4.5** para economizar tokens
5. O Worker vai gerar uma sugestão de código
6. **Peça para salvar** a sugestão em `.cursor/suggestions/[nome].md`

**Exemplo de tarefa:**
```
Adicionar um botão de toggle para alternar entre gráfico de barras 
e linha no dashboard de risco, similar ao que existe no ranking.
```

### PASSO 2: Orchestrator Analisa e Decide

1. Abra o arquivo `.cursor/workflows/orchestrator-prompt.md`
2. Preencha:
   - **SUGESTÃO DO WORKER:** Cole a sugestão salva
   - **TAREFA ORIGINAL:** Descreva a tarefa original
3. Cole no Cursor Chat
4. **Você mesmo analisa** (ou use um modelo mais caro como Opus 4.5)
5. Siga o checklist de aprovação
6. Decida: **APROVADO** ou **REJEITADO**
7. Documente o feedback detalhado

**DICA:** Você pode fazer a análise manualmente (mais rápido) ou pedir para um modelo mais caro fazer (mais rigoroso).

### PASSO 3: Implementar ou Corrigir

**Se APROVADO:**
1. Implemente o código sugerido
2. Teste manualmente
3. Verifique se compila (`npm run typecheck`)
4. Commit com mensagem clara

**Se REJEITADO:**
1. Voltar para o PASSO 1 (Worker)
2. Cole o feedback do Orchestrator
3. Peça para o Worker revisar e sugerir novamente
4. Repita até aprovação

## 💰 ECONOMIA DE TOKENS

### Cenário Tradicional (tudo com modelo caro):
- Planejamento: ~2k tokens
- Geração (3 iterações): ~30k tokens
- **Total: ~32k tokens**

### Com Worker (Haiku) + Orchestrator:
- Worker (Haiku 4.5, 3 iterações): ~3k tokens
- Orchestrator (você mesmo ou Opus 4.5, 1x): ~2k tokens
- **Total: ~5k tokens**

**Economia: ~85% de tokens!**

## 📝 EXEMPLO COMPLETO

### 1. Tarefa:
```
"Adicionar filtro por data no ranking de líderes"
```

### 2. Worker sugere:
```markdown
## 📝 SUGESTÃO DE IMPLEMENTAÇÃO

### Arquivos a Modificar:
- `src/app/dashboard/ranking/page.tsx` - Adicionar DateRangePicker e lógica de filtro

### Mudanças Propostas:

#### Arquivo: `src/app/dashboard/ranking/page.tsx`
```typescript
// Adicionar estado para dateRange
const [dateRange, setDateRange] = useState<DateRange | undefined>();

// Filtrar dados baseado no range
const filteredLeaders = useMemo(() => {
  if (!dateRange?.from || !dateRange?.to) return leaders;
  // ... lógica de filtro
}, [leaders, dateRange]);

// Adicionar DateRangePicker no JSX
<DateRangePicker
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>
```

**Explicação:** Usa o componente DateRangePicker existente e filtra os dados no useMemo para performance.
```

### 3. Orchestrator analisa:
```
✅ APROVADO - Score: 92/100

Pontos fortes:
- Usa componente existente (DateRangePicker)
- Performance otimizada com useMemo
- Segue padrões do projeto

Observações:
- Verificar se precisa resetar filtro ao mudar de view (Ranking/Histórico)
```

### 4. Implementação:
- Código é implementado
- Testado manualmente
- Commit: "feat: adiciona filtro por data no ranking"

