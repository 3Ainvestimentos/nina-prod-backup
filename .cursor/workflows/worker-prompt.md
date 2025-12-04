# 🔨 WORKER - Sugerir Código

**Use este prompt com um modelo mais barato (Haiku 4.5) para gerar sugestões de código.**

---

## TAREFA
[Descreva o que você quer implementar]

## CONTEXTO DO PROJETO
- **Stack:** Next.js 15, React 18, TypeScript, Firebase, Tailwind CSS
- **Componentes:** shadcn/ui
- **Padrões:** 
  - Usar hooks customizados quando apropriado
  - Seguir estrutura de pastas existente
  - Usar Firebase para backend (Firestore + Auth)
  - Validação com Zod quando necessário
  - Tratamento de erros explícito

## ARQUIVOS RELEVANTES
[Liste arquivos similares ou relacionados que o Worker deve consultar]

## INSTRUÇÕES PARA O WORKER

Você é um desenvolvedor. Analise a tarefa acima e **SUGIRA** código para implementá-la.

### REGRAS:
1. **SUGIRA, não implemente ainda** - O código será revisado antes de ser aplicado
2. Siga os padrões do codebase (consulte arquivos similares)
3. Use TypeScript com tipagem forte
4. Siga as convenções do projeto:
   - Componentes em `src/components/`
   - Páginas em `src/app/`
   - Hooks em `src/hooks/`
   - Utils em `src/lib/`
5. Use shadcn/ui para componentes de UI
6. Mantenha código limpo e legível
7. Adicione comentários quando necessário

### FORMATO DA SUGESTÃO:

```markdown
## 📝 SUGESTÃO DE IMPLEMENTAÇÃO

### Arquivos a Criar/Modificar:
- `src/path/to/file1.tsx` - [descrição]
- `src/path/to/file2.tsx` - [descrição]

### Mudanças Propostas:

#### Arquivo 1: `src/path/to/file1.tsx`
\`\`\`typescript
[código sugerido aqui]
\`\`\`

**Explicação:** [Por que essa abordagem?]

#### Arquivo 2: `src/path/to/file2.tsx`
\`\`\`typescript
[código sugerido aqui]
\`\`\`

**Explicação:** [Por que essa abordagem?]

### Dependências Necessárias:
- [ ] Nenhuma nova dependência
- [ ] Dependência X (já instalada)
- [ ] Nova dependência Y (precisa instalar)

### Considerações:
- [Consideração 1]
- [Consideração 2]
```

---

**IMPORTANTE:** 
- Salve a sugestão em `.cursor/suggestions/[nome-da-tarefa].md`
- Aguarde aprovação do Orchestrator antes de implementar
- Se houver feedback, revise e sugira novamente

