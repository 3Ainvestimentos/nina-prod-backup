## 📋 ESPECIFICAÇÃO TÉCNICA

### 1. TAREFA PRINCIPAL
Implementar card "Ações Diretor" no dashboard de liderança com duas ações mensais globais ("Análise do Índice de Qualidade" e "Análise do Índice de Risco"), controladas por checkboxes simples e exclusivas para o Diretor.

### 2. REQUISITOS FUNCIONAIS
- [ ] **Novos Tipos de Interação (Exclusivos para Diretor):**
    - `"Análise do Índice de Qualidade"`
    - `"Análise do Índice de Risco"`
- **Interface (Dashboard):**
    - Adicionar card "Ações Diretor" no componente `LeaderTrackingContent` (visível APENAS para Diretores e Admins).
    - Posicionamento: Entre o card de "Progresso de Interações" e o card de "Frequência de Interações".
    - Conteúdo do Card:
        - Título: "Ações Diretor"
        - Descrição: "Registre as análises mensais dos índices globais."
        - Lista com 2 itens (Checkboxes):
            1. "Análise do Índice de Qualidade"
            2. "Análise do Índice de Risco"
        - Cada item mostra: Label, Checkbox, Status ("Realizado 1/1" ou "Realizado 0/1").
- **Comportamento:**
    - **Marcar Checkbox:** Cria um documento na subcoleção `interactions` do **próprio Diretor** (`employees/{directorId}/interactions`).
        - Dados: `type`, `date` (ISO atual), `authorId` (uid do diretor), `notes` (vazio ou texto padrão).
    - **Desmarcar Checkbox:** Remove o documento correspondente do mês atual.
    - **Estado Inicial:** Verifica se existe interação do tipo no mês corrente para marcar/desmarcar o checkbox.

### 3. REQUISITOS NÃO-FUNCIONAIS
- **Performance:** Otimizar busca de interações do diretor.
- **Segurança:** Apenas usuários com `isDirector: true` ou `isAdmin: true` podem ver e interagir com este card.

### 4. ARQUIVOS A CRIAR/MODIFICAR
- `src/lib/types.ts`
    - Adicionar os novos strings ao Union Type `InteractionType`.
- `src/components/leader-tracking-content.tsx`
    - Adicionar hook para buscar interações do *CurrentUser* (Diretor).
    - Implementar a renderização do Card "Ações Diretor" (com verificação de permissão).
    - Implementar funções `handleToggleAction`.

### 5. RESTRIÇÕES E CONSIDERAÇÕES
- As interações são "Globais", salvas no perfil do Diretor.
- Validação de data: `isSameMonth` e `isSameYear` usando `date-fns`.

### 6. DEPENDÊNCIAS
- `firebase/firestore`: `addDoc`, `deleteDoc`, `query`, `where`.
- `date-fns`: Para comparação de datas.

### 7. PLANO DE TESTES (Validação Manual)
Como o projeto não possui framework de testes automatizados configurado, a validação será manual seguindo este roteiro:

- [ ] **Caso de Teste 1: Permissão de Visualização**
  - **Cenário:** Logar com usuário Diretor/Admin.
  - **Resultado Esperado:** O card "Ações Diretor" deve estar visível.
  - **Cenário Negativo:** Logar com usuário Líder comum.
  - **Resultado Esperado:** O card NÃO deve aparecer.

- [ ] **Caso de Teste 2: Interação de Marcar (Check)**
  - **Ação:** Clicar no checkbox "Análise do Índice de Qualidade".
  - **Resultado Esperado:**
    - Feedback visual imediato (checkbox marcado).
    - Toast de sucesso "Análise registrada".
    - Contador atualiza para "Realizado 1/1".
    - Documento criado no Firestore na coleção do diretor.

- [ ] **Caso de Teste 3: Interação de Desmarcar (Uncheck)**
  - **Ação:** Clicar no checkbox já marcado.
  - **Resultado Esperado:**
    - Checkbox desmarcado.
    - Toast de "Análise removida".
    - Contador volta para "Realizado 0/1".
    - Documento removido do Firestore.

- [ ] **Caso de Teste 4: Persistência**
  - **Ação:** Marcar um item e recarregar a página (F5).
  - **Resultado Esperado:** O item deve permanecer marcado.
