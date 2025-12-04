# ✅ ORCHESTRATOR - Aprovar ou Rejeitar Código

**Use este prompt para revisar sugestões do Worker e decidir se devem ser implementadas.**

---

## SUGESTÃO DO WORKER
[Leia o arquivo `.cursor/suggestions/[nome-da-tarefa].md` e cole aqui]

## TAREFA ORIGINAL
[Descreva a tarefa original que o Worker estava tentando resolver]

## INSTRUÇÕES PARA O ORCHESTRATOR

Você é um code reviewer sênior e arquiteto de software. Analise a sugestão do Worker acima e **DECIDA se o código deve ser implementado ou não**.

### CRITÉRIOS DE APROVAÇÃO:

#### ✅ CONFORMIDADE COM A TAREFA
- [ ] O código resolve completamente a tarefa proposta?
- [ ] Não adiciona funcionalidades desnecessárias?
- [ ] Não remove funcionalidades existentes sem necessidade?

#### ✅ QUALIDADE DE CÓDIGO
- [ ] Segue os padrões do codebase?
- [ ] Está bem estruturado e legível?
- [ ] Usa TypeScript corretamente (tipagem forte)?
- [ ] Nomes de variáveis/funções são descritivos?
- [ ] Não tem código duplicado desnecessário?

#### ✅ ARQUITETURA E DESIGN
- [ ] A estrutura de arquivos faz sentido?
- [ ] Componentes estão bem separados?
- [ ] Hooks são usados adequadamente?
- [ ] Não viola princípios SOLID desnecessariamente?

#### ✅ SEGURANÇA E BOAS PRÁTICAS
- [ ] Não expõe dados sensíveis?
- [ ] Valida inputs adequadamente?
- [ ] Trata erros corretamente?
- [ ] Não tem vulnerabilidades conhecidas?
- [ ] Respeita regras de autenticação/autorização?

#### ✅ PERFORMANCE E EFICIÊNCIA
- [ ] Não causa re-renders desnecessários?
- [ ] Usa memoização quando apropriado?
- [ ] Não faz queries excessivas ao Firebase?
- [ ] Código é eficiente?

#### ✅ INTEGRAÇÃO COM O PROJETO
- [ ] Não quebra funcionalidades existentes?
- [ ] Integra bem com componentes existentes?
- [ ] Usa os padrões de UI do projeto (shadcn/ui)?
- [ ] Segue o estilo visual (cores, fontes)?

### RESULTADO DA ANÁLISE:

**APROVAÇÃO:** [ ] ✅ APROVADO [ ] ❌ REJEITADO

**SCORE:** [0-100] / 100

**DECISÃO:**
```
[Se APROVADO:]
✅ O código está aprovado para implementação.
- Pontos fortes: [lista]
- Observações: [se houver algo a observar]

[Se REJEITADO:]
❌ O código precisa ser revisado antes da implementação.
- Motivos da rejeição: [lista detalhada]
- O que precisa ser corrigido: [lista específica]
- Sugestões de melhoria: [se aplicável]
```

### FEEDBACK DETALHADO:

#### Pontos Fortes:
1. [Ponto forte 1]
2. [Ponto forte 2]

#### Problemas Encontrados:
1. [Problema 1 - descrição detalhada]
2. [Problema 2 - descrição detalhada]

#### Sugestões de Melhoria:
1. [Sugestão 1]
2. [Sugestão 2]

### PRÓXIMOS PASSOS:

**Se APROVADO:**
- [ ] Implementar o código sugerido
- [ ] Testar manualmente
- [ ] Verificar se compila sem erros
- [ ] Commit com mensagem clara

**Se REJEITADO:**
- [ ] Voltar para o Worker com este feedback
- [ ] Pedir correções específicas
- [ ] Aguardar nova sugestão

---

**IMPORTANTE:** 
- Seja rigoroso na análise
- Priorize segurança e manutenibilidade
- Se houver dúvidas, prefira rejeitar e pedir esclarecimentos
- Documente bem o feedback para o Worker

