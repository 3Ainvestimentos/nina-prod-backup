# 🔄 FEEDBACK PARA WORKER - Loading Flow

**Especificação original:** loading-flow.md
**Análise do Orchestrator:** Score 78/100 - REJEITADO

---

## O que precisa ser corrigido:

### 1. Mudanças em `login/page.tsx` precisam ser mais específicas
- O Worker sugeriu "Procure por onde o código faz redirect" - isso é vago
- Precisa indicar as linhas exatas ou fornecer o código completo modificado
- O arquivo tem 450+ linhas, é difícil saber onde aplicar as mudanças

### 2. Verificar nome correto do campo do hook `useUser`
- O código original (`loading/page.tsx`) usa `loading`
- A sugestão usa `isUserLoading`
- Consultar `src/firebase/provider.tsx` para verificar qual é o correto
- O hook `useUser` retorna `{ user, isUserLoading, userError }` (verificado)
- Portanto, usar `isUserLoading` está **CORRETO**, mas precisa atualizar para manter consistência

### 3. Evitar loop de redirecionamento
- Se o usuário não tem permissão:
  - `/loading` → mostra erro → redireciona para `/login`
  - `/login` pode detectar que user existe e redirecionar de volta para `/loading` ou `/dashboard`
  - Isso pode criar um loop infinito
- **Solução:** Adicionar parâmetro de query `?reason=no-permission` ou usar localStorage para marcar que já tentou

---

## Sugestões específicas:

### Para `login/page.tsx`:
1. Encontrar o `useEffect` que verifica se `user` existe e redireciona (provavelmente linhas ~200-250)
2. Modificar para redirecionar para `/loading` em vez de `/dashboard`
3. Adicionar verificação de query param `reason` para mostrar mensagem de erro

### Para evitar loop:
```typescript
// No loading/page.tsx, ao redirecionar para login com erro:
router.replace("/login?reason=no-permission");

// No login/page.tsx, verificar se veio com reason:
const searchParams = useSearchParams();
const reason = searchParams.get('reason');

// Se veio com reason, não redirecionar automaticamente
if (reason === 'no-permission') {
  // Mostrar mensagem de erro e não redirecionar
  setAuthError("Você não tem permissão para acessar esta aplicação.");
}
```

---

## Arquivos que precisam de revisão:

- `src/app/loading/page.tsx` - Adicionar query param ao redirecionar para login
- `src/app/login/page.tsx` - Fornecer código completo ou seções específicas com contexto de linhas

---

## Próxima iteração:

O Worker deve:
1. Ler `src/app/login/page.tsx` completo
2. Identificar onde fazer as mudanças
3. Fornecer código com contexto (linhas antes e depois)
4. Implementar solução para evitar loop de redirecionamento

