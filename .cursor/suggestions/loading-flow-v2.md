# 📝 SUGESTÃO DE IMPLEMENTAÇÃO - Loading Flow v2 (CORRIGIDA)

## Baseado na especificação: loading-flow.md
## Feedback aplicado: loading-flow-feedback.md

---

## Análise do código atual:

A página de login (`login/page.tsx`) já faz:
1. Validação de domínio (@3ainvestimentos.com.br)
2. Verificação de permissões (Líder, Diretor, Admin)
3. Autorização do Google Calendar/Gmail
4. Redirecionamento para dashboard

**Problema:** O loading atual simplesmente redireciona para login se não houver user, causando flash da tela de login.

**Solução simplificada:** 
- Loading verifica autenticação
- Se autenticado → vai direto para dashboard (confiando que a sessão é válida)
- Se não autenticado → vai para login
- Login faz toda a validação (como já faz) e redireciona para dashboard

---

## Mudanças Propostas:

### Arquivo 1: `src/app/loading/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/firebase";
import { Loader2 } from "lucide-react";

export default function LoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const [message, setMessage] = useState("Carregando CRM Interno");

  useEffect(() => {
    // Aguarda o Firebase verificar autenticação
    if (isUserLoading) {
      return;
    }

    // Verifica se veio com parâmetro de erro
    const reason = searchParams.get('reason');
    if (reason === 'no-permission') {
      setMessage("Sem permissão. Redirecionando...");
      setTimeout(() => router.replace("/login?reason=no-permission"), 1500);
      return;
    }

    // Adiciona um delay mínimo de 100ms para melhor UX
    setTimeout(() => {
      if (user) {
        // Usuário autenticado → vai para dashboard
        // A validação de permissões acontecerá no dashboard ou já foi feita no login
        console.log("[Loading] Usuário autenticado, redirecionando para dashboard...");
        router.replace("/dashboard/v2");
      } else {
        // Usuário não autenticado → vai para login
        console.log("[Loading] Usuário não autenticado, redirecionando para login...");
        router.replace("/login");
      }
    }, 100);
  }, [user, isUserLoading, router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}
```

**Explicação:** 
- Simples e direto: verifica se tem user, vai para dashboard; se não, vai para login
- Mantém a lógica de validação de permissões no login (que já funciona)
- Adiciona suporte a parâmetro `reason` para mensagens de erro
- Usa `isUserLoading` (correto conforme o hook)

---

### Arquivo 2: `src/app/login/page.tsx`

**Mudanças específicas (não precisa reescrever o arquivo todo):**

#### 2.1. Adicionar import do useSearchParams (linha ~7):

```typescript
import { useRouter, useSearchParams } from "next/navigation";
```

#### 2.2. Adicionar estado para mensagem de erro (após linha 33):

```typescript
const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
```

#### 2.3. Adicionar hook useSearchParams (após linha 29):

```typescript
const searchParams = useSearchParams();
```

#### 2.4. Adicionar useEffect para ler parâmetros de erro (após linha 413, antes do return):

```typescript
// Verifica se veio com parâmetro de erro
useEffect(() => {
  const reason = searchParams.get('reason');
  if (reason === 'no-permission') {
    setAuthErrorMessage("Você não tem permissão para acessar esta aplicação. Apenas Líderes, Diretores e Admins podem acessar.");
  }
}, [searchParams]);
```

#### 2.5. Adicionar exibição de erro no JSX (após linha 428, antes do CardContent):

```typescript
{authErrorMessage && (
  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
    <p className="text-sm text-destructive text-center">{authErrorMessage}</p>
  </div>
)}
```

#### 2.6. Modificar redirecionamento após erro de permissão (linha ~385):

Onde está:
```typescript
} else {
  throw new Error("Seu perfil de 'Colaborador' não tem permissão de acesso.");
}
```

Manter como está, pois já faz signOut e mostra toast.

---

## Código completo das mudanças no login/page.tsx:

### Imports (linha ~7):
```typescript
// ANTES:
import { useRouter } from "next/navigation";

// DEPOIS:
import { useRouter, useSearchParams } from "next/navigation";
```

### Novos estados e hooks (linhas 28-33):
```typescript
export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams(); // NOVO
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null); // NOVO
  // ... resto dos estados
```

### Novo useEffect para ler parâmetros (após linha 413):
```typescript
// NOVO: Verifica se veio com parâmetro de erro
useEffect(() => {
  const reason = searchParams.get('reason');
  if (reason === 'no-permission') {
    setAuthErrorMessage("Você não tem permissão para acessar esta aplicação. Apenas Líderes, Diretores e Admins podem acessar.");
  }
}, [searchParams]);

const isLoading = isUserLoading || isVerifying || isSigningIn;
```

### Exibição de erro no JSX (linha ~428):
```typescript
        <div className="flex justify-center mb-8">
            <Image 
                src="https://firebasestorage.googleapis.com/v0/b/a-riva-hub.firebasestorage.app/o/Imagens%20institucionais%20(logos%20e%20etc)%2Flogo%20oficial%20preta.png?alt=media&token=ce88dc80-01cd-4295-b443-951e6c0210aa" 
                alt="3A RIVA Investimentos" 
                width={200} 
                height={100} 
                className="h-auto"
            />
        </div>
        {/* NOVO: Mensagem de erro */}
        {authErrorMessage && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <p className="text-sm text-destructive text-center">{authErrorMessage}</p>
          </div>
        )}
        <CardContent className="p-0">
```

---

## Considerações:

- **Simplicidade:** Mantém a lógica existente do login, apenas adiciona suporte a mensagens de erro via query param
- **Sem loop:** O parâmetro `reason=no-permission` evita que o login redirecione automaticamente
- **Performance:** Loading rápido (100ms) para usuários já autenticados
- **UX:** Mensagens de erro claras na tela de login
- **Compatibilidade:** Não quebra a lógica existente de validação de permissões e Google Auth

---

## Fluxo resultante:

1. **Usuário já autenticado:**
   - `/` → `/loading` → `/dashboard/v2` ✅ (sem flash de login)

2. **Usuário não autenticado:**
   - `/` → `/loading` → `/login` ✅

3. **Login bem-sucedido:**
   - `/login` → (google auth) → `/dashboard/v2` ✅ (lógica existente)

4. **Usuário sem permissão:**
   - `/login` → (verifica permissão) → toast de erro → signOut ✅ (lógica existente)

