# 📋 ESPECIFICAÇÃO TÉCNICA: Loading Flow

## 1. TAREFA PRINCIPAL
Modificar o fluxo de autenticação para que a tela de "Carregando CRM" seja exibida sempre ao iniciar a aplicação, mostrando a tela de login apenas quando necessário (usuário não autenticado ou erro de autenticação).

## 2. REQUISITOS FUNCIONAIS
- [ ] A tela de loading ("Carregando CRM Interno") deve ser a primeira tela exibida ao abrir a aplicação
- [ ] Se o usuário já estiver autenticado (sessão válida), redirecionar diretamente para o dashboard sem mostrar a tela de login
- [ ] A tela de login só deve aparecer quando:
  - [ ] O usuário não estiver autenticado (primeira vez ou sessão expirada)
  - [ ] Ocorrer erro de autenticação (token inválido, erro de rede, etc.)
- [ ] Após login bem-sucedido, mostrar a tela de loading e redirecionar para o dashboard (sem mostrar a tela de login)
- [ ] Manter a validação de permissões existente (apenas Líder, Diretor, Admin podem acessar)

## 3. REQUISITOS NÃO-FUNCIONAIS
- [ ] Performance: O redirecionamento deve ser rápido (< 500ms para usuários já autenticados)
- [ ] Segurança: Manter todas as validações de autenticação e autorização existentes
- [ ] UX: Transição suave entre loading → dashboard (sem flash de tela de login)
- [ ] Manutenibilidade: Código limpo e bem documentado

## 4. ARQUIVOS A CRIAR/MODIFICAR
- `src/app/loading/page.tsx` - Modificar para incluir lógica de autenticação silenciosa
- `src/app/login/page.tsx` - Modificar para ser chamada apenas quando necessário
- `src/app/page.tsx` - Manter redirecionamento para /loading (já está correto)

## 5. RESTRIÇÕES E CONSIDERAÇÕES
- Não quebrar o fluxo de login existente para novos usuários
- Manter compatibilidade com o Firebase Auth
- Preservar a validação de domínio (@3ainvestimentos.com.br)
- Preservar a verificação de roles (Líder, Diretor, Admin)
- Não expor dados sensíveis durante o processo
- Tratar casos de erro de rede/timeout

## 6. DEPENDÊNCIAS
- Firebase Auth (já instalado)
- Next.js Router (já instalado)
- Hooks existentes: `useUser`, `useAuth`, `useFirestore`

## 7. TESTES NECESSÁRIOS
- [ ] Usuário já autenticado: deve ir direto para dashboard (sem ver login)
- [ ] Usuário não autenticado: deve ver loading → login
- [ ] Login bem-sucedido: deve ver loading → dashboard
- [ ] Erro de autenticação: deve mostrar login com mensagem de erro
- [ ] Token expirado: deve mostrar login
- [ ] Usuário sem permissão (Colaborador): deve mostrar mensagem de acesso negado

## 8. FLUXO VISUAL

```
┌─────────────────────────────────────────────────────────────┐
│                    USUÁRIO ABRE A APP                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TELA DE LOADING                           │
│                  "Carregando CRM Interno"                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Usuário já está │
                    │  autenticado?   │
                    └─────────────────┘
                     │             │
                    SIM           NÃO
                     │             │
                     ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │ Validar  │  │ TELA DE LOGIN│
              │ permissão│  └──────────────┘
              └──────────┘         │
                   │               ▼
                   │        ┌──────────────┐
                   │        │ Login bem    │
                   │        │ sucedido?    │
                   │        └──────────────┘
                   │         │           │
                   │        SIM         NÃO
                   │         │           │
                   │         ▼           ▼
                   │   ┌──────────┐ ┌──────────┐
                   │   │ Validar  │ │ Mostrar  │
                   │   │ permissão│ │  erro    │
                   │   └──────────┘ └──────────┘
                   │         │
                   ▼         ▼
              ┌──────────────────┐
              │ Tem permissão?   │
              │(Líder/Dir/Admin) │
              └──────────────────┘
               │              │
              SIM            NÃO
               │              │
               ▼              ▼
        ┌───────────┐  ┌───────────────┐
        │ DASHBOARD │  │ Acesso negado │
        └───────────┘  │ (fazer logout)│
                       └───────────────┘
```

## 9. CONTEXTO TÉCNICO

### Fluxo atual:
1. `/` → redirect para `/loading`
2. `/loading` → verifica auth → se logado vai para `/dashboard`, senão vai para `/login`
3. `/login` → faz login → volta para `/loading` ou vai direto para `/dashboard`

### Problema atual:
- A tela de login aparece mesmo quando o usuário já está autenticado (flash rápido)
- O fluxo não é otimizado para usuários que já possuem sessão válida

### Solução proposta:
1. `/loading` verifica autenticação silenciosamente
2. Se autenticado e com permissão → vai direto para `/dashboard`
3. Se não autenticado → vai para `/login`
4. Se erro de auth → vai para `/login` com mensagem
5. `/login` após sucesso → vai para `/loading` (que redireciona para dashboard)

