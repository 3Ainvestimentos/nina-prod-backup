---
name: Auditoria e Correções de Segurança (Nina 1.0)
overview: Implementar correções de segurança OWASP, atualizar dependências vulneráveis, reforçar regras do Firestore e validar o sistema de Custom Claims existente.
todos:
  - id: firestore-rules-fix
    content: "Adicionar isSignedIn() nas firestore.rules onde houver allow read: if true"
    status: pending
  - id: owasp-xss-fix-functions
    content: Substituir innerHTML por textContent em google-auth.ts na cloud function
    status: pending
  - id: deps-audit-fix
    content: Executar npm audit fix --force para resolver vulnerabilidades de dompurify/jspdf
    status: pending
  - id: cleanup-deps
    content: Remover pacotes depreciados e não utilizados (jaeger exporter)
    status: pending
  - id: validate-custom-claims
    content: Testar e validar o fluxo de Custom Claims isAdmin na tela de Admin
    status: pending
---

# Plano de Auditoria e Correções de Segurança - Nina 1.0

Este plano visa resolver as vulnerabilidades identificadas sem alterar drasticamente a lógica de negócios ou a acessibilidade atual do sistema.

## 1. Reforço de Regras do Firestore

Adicionar validação de autenticação em todas as regras que atualmente permitem acesso público (`if true`).

- Arquivo: [`firestore.rules`](firestore.rules)
- Mudança: Substituir `allow read: if true;` por `allow read: if isSignedIn();` em todos os blocos relevantes (`/employees`, `/roles`, `/teams`, `/leaderRankings`).

## 2. Correção de Vulnerabilidades OWASP (XSS)

Mitigar o uso de `dangerouslySetInnerHTML` garantindo que os dados sejam estáticos ou sanitizados.

- **Layout:** [`src/app/layout.tsx`](src/app/layout.tsx) - O uso para `themeInitializer` é seguro (conteúdo estático), mas manteremos sob observação.
- **Gráficos:** [`src/components/ui/chart.tsx`](src/components/ui/chart.tsx) - Verificar se o dado injetado vem de fontes externas e, se necessário, usar um sanitizador simples.
- **Cloud Functions:** [`functions/src/google-auth.ts`](functions/src/google-auth.ts) - Substituir `innerHTML` por `textContent` onde for apenas texto simples.

## 3. Atualização de Dependências

Corrigir as vulnerabilidades altas e moderadas reportadas pelo `npm audit`.

- Executar: `npm audit fix --force` (especialmente para atualizar `dompurify` usado pelo `jspdf`).
- Atualizar manualmente pacotes críticos se o `audit fix` não resolver.

## 4. Validação e Refinamento de Custom Claims

Garantir que o sistema de `isAdmin` via Custom Claims esteja operando corretamente conforme a tela de Admin já existente.

- Verificar se a Cloud Function `setupFirstAdmin` em [`functions/src/setup-admin.ts`](functions/src/setup-admin.ts) está sendo chamada corretamente pelo frontend em [`src/app/dashboard/admin/page.tsx`](src/app/dashboard/admin/page.tsx).
- Confirmar que o botão "Verificar Custom Claims" reflete corretamente o estado do usuário após a promoção.