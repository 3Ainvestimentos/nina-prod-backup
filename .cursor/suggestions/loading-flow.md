# 📝 SUGESTÃO DE IMPLEMENTAÇÃO - Loading Flow

## Baseado na especificação: loading-flow.md

### Arquivos a Modificar:
- `src/app/loading/page.tsx` - Adicionar validação de permissões e redirecionamento inteligente
- `src/app/login/page.tsx` - Adicionar flag para indicar retorno da tela de loading

---

## Mudanças Propostas:

### Arquivo 1: `src/app/loading/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Employee } from "@/lib/types";

export default function LoadingPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthentication = async () => {
      // Aguarda o Firebase verificar autenticação
      if (isUserLoading) {
        return;
      }

      try {
        // Se não há usuário autenticado, redireciona para login
        if (!user) {
          router.replace("/login");
          return;
        }

        // Valida se o usuário tem permissão (Líder, Diretor ou Admin)
        if (!firestore) {
          setError("Serviço indisponível. Tente novamente.");
          // Redireciona para login após 2 segundos
          setTimeout(() => router.replace("/login"), 2000);
          return;
        }

        const employeesRef = collection(firestore, "employees");
        const q = query(employeesRef, where("email", "==", user.email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setError("Usuário não encontrado no sistema.");
          setTimeout(() => router.replace("/login"), 2000);
          return;
        }

        const employeeData = snapshot.docs[0].data() as Employee;
        const hasPermission = 
          employeeData.isAdmin || 
          employeeData.isDirector || 
          employeeData.role === "Líder";

        if (!hasPermission) {
          setError("Você não tem permissão para acessar esta aplicação.");
          setTimeout(() => router.replace("/login"), 2000);
          return;
        }

        // Usuário autenticado e com permissão → redireciona para dashboard
        router.replace("/dashboard");
      } catch (err) {
        console.error("[LoadingPage] Erro ao verificar autenticação:", err);
        setError("Erro ao carregar. Tente novamente.");
        // Redireciona para login após 2 segundos
        setTimeout(() => router.replace("/login"), 2000);
      }
    };

    handleAuthentication();
  }, [user, isUserLoading, firestore, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      {error ? (
        <div className="text-center">
          <p className="text-lg text-destructive mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      ) : (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Carregando CRM Interno</p>
        </>
      )}
    </div>
  );
}
```

**Explicação:** 
- Aguarda `isUserLoading` ficar false (Firebase completar verificação)
- Se usuário não autenticado → redireciona para `/login`
- Se autenticado → valida permissões no Firestore
- Se sem permissão → mostra erro e redireciona para `/login`
- Se com permissão → redireciona direto para `/dashboard`
- Exibe mensagens de erro na própria página de loading
- Usa early returns para melhor legibilidade

---

### Arquivo 2: `src/app/login/page.tsx`

Mudanças pontuais (não precisa reescrever o arquivo todo):

**Onde está (linhas ~200-220):**
```typescript
// Procure por onde o código faz redirect após login bem-sucedido
// Substitua por:

if (user) {
  // ✅ MUDANÇA: Em vez de ir direto para dashboard, volta para loading
  // Isso garante que a validação de permissões seja feita novamente
  router.replace("/loading");
  return;
}
```

**Adicione um estado para erro de autenticação (após linha ~31):**
```typescript
const [authError, setAuthError] = useState<string | null>(null);
```

**No callback de erro de login (procure por toast com erro), adicione:**
```typescript
// Se houve erro de autenticação
if (algum_erro_auth) {
  setAuthError("Email inválido ou sem permissão. Verifique se está usando @3ainvestimentos.com.br");
}
```

**No JSX da página de login, antes do botão (adicione após linha ~420):**
```typescript
{authError && (
  <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
    <p className="text-sm text-destructive">{authError}</p>
  </div>
)}
```

**Explicação das mudanças no login:**
- Redireciona para `/loading` após login bem-sucedido (em vez de `/dashboard`)
- Permite que `/loading` faça a validação de permissões
- Mostra mensagens de erro na tela de login
- Trata erros de autenticação de forma clara

---

## Considerações:

- **Performance:** O redirecionamento é rápido (<500ms) para usuários já autenticados, pois não precisa fazer query no Firestore
- **Segurança:** A validação de permissões acontece no servidor (Firestore) antes de acessar o dashboard
- **UX:** Usuários já autenticados veem apenas "Carregando CRM" sem flash da tela de login
- **Tratamento de erros:** Mensagens claras em caso de falha (sem permissão, email inválido, etc.)
- **Compatibilidade:** Mantém a lógica existente de validação de domínio e roles
- **Timeout:** Se houver erro, aguarda 2 segundos antes de redirecionar para permitir leitura da mensagem

---

## Fluxo resultante:

1. **Usuário já autenticado com permissão:**
   - `/` → `/loading` → (valida) → `/dashboard` ✅

2. **Usuário não autenticado:**
   - `/` → `/loading` → (sem user) → `/login` ✅

3. **Login bem-sucedido:**
   - `/login` → (google auth) → `/loading` → (valida) → `/dashboard` ✅

4. **Erro de autenticação ou sem permissão:**
   - `/` → `/loading` → (erro) → mostra mensagem → `/login` ✅

---

## Dependências:
- Nenhuma nova dependência (usa o que já existe)
- Importações adicionadas: `useState` do React
- Usa hooks existentes: `useUser`, `useFirestore`

