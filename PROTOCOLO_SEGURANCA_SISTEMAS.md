# Protocolo de Segurança para Novos Sistemas

**Baseado em:** CRM Interno (Nina 1.0)  
**Objetivo:** Garantir que novos sistemas tenham o mesmo nível de segurança  
**Versão:** 1.0

---

## 📋 Como Usar Este Protocolo

Este protocolo deve ser seguido **antes** de colocar qualquer sistema em produção. Cada item deve ser verificado e implementado.

**Legenda:**
- 👤 **HUMANO**: Ação que deve ser feita manualmente por um desenvolvedor/administrador
- 🤖 **FERRAMENTA/AI**: Pode ser implementado via ferramentas, AI ou automação
- ⚠️ **CRÍTICO**: Item obrigatório antes de produção
- ✅ **CHECKLIST**: Marque quando concluído

---

## 1. Autenticação e Autorização

### 1.1 Autenticação OAuth/SSO

#### 👤 HUMANO - Configuração Inicial
- [ ] **Definir provedor de autenticação** (Google OAuth, Auth0, etc.)
- [ ] **Criar credenciais OAuth no console do provedor**
- [ ] **Configurar redirect URIs permitidos**
- [ ] **Definir escopos mínimos necessários** (princípio do menor privilégio)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Implementar autenticação OAuth 2.0
- [ ] Adicionar suporte a popup e redirect (fallback)
- [ ] Implementar controle de chamadas simultâneas de login
- [ ] Adicionar tratamento de erros de autenticação

#### 👤 HUMANO - Revisão e Validação
- [ ] **Revisar código de autenticação implementado** (verificar se está correto)
- [ ] **Testar manualmente o fluxo de login** (popup, redirect, cancelamento)
- [ ] **Verificar tratamento de erros** (testar cenários de falha)
- [ ] **Validar que não há vazamento de informações** em mensagens de erro
- [ ] **Testar com múltiplas contas** (diferentes domínios, roles)

**Prompt para AI:**
```
Implemente autenticação OAuth 2.0 com:
- Suporte a popup e redirect como fallback
- Controle para evitar múltiplas chamadas simultâneas
- Tratamento adequado de erros (popup bloqueado, cancelado, etc.)
- Integração com [Firebase Auth / Auth0 / outro]
```

### 1.2 Validação de Domínio de Email

#### 👤 HUMANO - Definição
- [ ] **Listar domínios de email autorizados** (ex: @empresa.com.br)
- [ ] **Documentar exceções** (se houver)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Validar domínio de email no frontend durante login
- [ ] Configurar hosted domain no OAuth (`hd` parameter)
- [ ] Adicionar validação no backend/Cloud Functions
- [ ] Implementar mensagens de erro claras para domínios não autorizados

#### 👤 HUMANO - Teste e Validação
- [ ] **Testar manualmente login com domínio autorizado** (deve funcionar)
- [ ] **Testar manualmente login com domínio não autorizado** (deve bloquear)
- [ ] **Verificar mensagem de erro** (deve ser clara mas não expor detalhes técnicos)
- [ ] **Validar que validação ocorre no frontend E backend** (defesa em profundidade)

**Prompt para AI:**
```
Implemente validação de domínio de email:
- Lista de domínios permitidos: [@empresa.com.br, @subsidiaria.com.br]
- Validação no frontend durante login
- Configuração de hosted domain no OAuth
- Validação também no backend
- Mensagens de erro informativas
```

### 1.3 Sistema de Roles e Permissões

#### 👤 HUMANO - Definição
- [ ] **Definir roles do sistema** (Admin, Diretor, Líder, Colaborador, etc.)
- [ ] **Mapear permissões por role** (quem pode ler/escrever/deletar o quê)
- [ ] **Definir lista de emails admin** (para funcionalidades críticas)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Criar estrutura de roles no banco de dados
- [ ] Implementar verificação de permissões no frontend
- [ ] Implementar validação de permissões no backend
- [ ] Criar helpers/funções para verificar roles
- [ ] Adicionar proteção de rotas baseada em roles

#### 👤 HUMANO - Revisão e Teste
- [ ] **Revisar mapeamento de permissões implementado** (verificar se está correto)
- [ ] **Testar manualmente cada role** (verificar acesso permitido e bloqueado)
- [ ] **Validar lista de emails admin** (verificar se está correta e atualizada)
- [ ] **Testar escalação de privilégios** (usuário comum não pode acessar área admin)
- [ ] **Revisar helpers de verificação de roles** (verificar lógica)

**Prompt para AI:**
```
Implemente sistema de roles e permissões:
- Roles: [Admin, Diretor, Líder, Colaborador]
- Permissões por role: [definir o que cada role pode fazer]
- Verificação no frontend antes de exibir funcionalidades
- Validação no backend em todas as operações críticas
- Helpers para verificar permissões
```

### 1.4 Proteção de Rotas

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Implementar middleware de autenticação para rotas protegidas
- [ ] Adicionar redirecionamento automático para login quando não autenticado
- [ ] Criar tela de loading durante verificação de acesso
- [ ] Validar permissões antes de renderizar componentes

#### 👤 HUMANO - Teste Manual
- [ ] **Testar acesso sem autenticação** (deve redirecionar para login)
- [ ] **Testar acesso com autenticação mas sem permissão** (deve bloquear)
- [ ] **Verificar tela de loading** (não deve expor informações sensíveis)
- [ ] **Testar todas as rotas protegidas** (verificar que estão protegidas)
- [ ] **Validar que não há "flash" de conteúdo** antes do redirecionamento

**Prompt para AI:**
```
Implemente proteção de rotas:
- Middleware que verifica autenticação em todas as rotas do dashboard
- Redirecionamento automático para /login quando não autenticado
- Tela de loading durante verificação de acesso
- Validação de permissões antes de renderizar componentes
- Usar [Next.js middleware / React Router guards / outro]
```

---

## 2. Regras de Segurança do Banco de Dados

### 2.1 Firestore Security Rules (ou equivalente)

#### 👤 HUMANO - Definição
- [ ] **Mapear todas as coleções/tabelas do sistema**
- [ ] **Definir permissões por coleção** (quem pode ler/escrever/deletar)
- [ ] **Identificar dados críticos** que não podem ser escritos pelo client-side

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Criar regras de segurança que exigem autenticação (`isSignedIn()`)
- [ ] Implementar funções helper para verificar roles (`isAdmin()`, `isDirector()`, etc.)
- [ ] Bloquear escrita client-side em dados críticos (`allow write: if false`)
- [ ] Adicionar validação de dados nas regras (quando possível)
- [ ] Remover todas as regras permissivas (`if true`)

#### 👤 HUMANO - Revisão e Teste Crítico
- [ ] **Revisar TODAS as regras de segurança criadas** (verificar lógica)
- [ ] **Procurar por regras permissivas** (`if true`) e remover manualmente
- [ ] **Testar acesso sem autenticação** (deve ser bloqueado)
- [ ] **Testar escrita client-side em dados críticos** (deve ser bloqueada)
- [ ] **Validar funções helper** (`isAdmin()`, `isDirector()`) estão corretas
- [ ] **Fazer auditoria completa das regras** (coleção por coleção)
- [ ] **Testar cada operação** (read, write, delete) para cada coleção

**Prompt para AI:**
```
Crie Firestore Security Rules com:
- Autenticação obrigatória para todas as operações
- Funções helper: isSignedIn(), isAdmin(), isDirector()
- Permissões por coleção:
  - /employees: read/update para autenticados, delete apenas admin
  - /leaderRankings: read para autenticados, write bloqueado (apenas Cloud Functions)
  - [definir outras coleções]
- Nenhuma regra permissiva (if true)
```

### 2.2 Soft Delete

#### 👤 HUMANO - Decisão
- [ ] **Decidir se o sistema precisa de soft delete** (preservar histórico)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Implementar campo `_isDeleted: true` ao invés de deletar
- [ ] Filtrar registros deletados em todas as queries
- [ ] Adicionar filtro automático em hooks/helpers de leitura

#### 👤 HUMANO - Validação
- [ ] **Verificar que soft delete está funcionando** (registros não aparecem mas não são deletados)
- [ ] **Testar queries** (verificar que registros deletados não aparecem)
- [ ] **Validar que histórico é preservado** (dados antigos ainda existem)

**Prompt para AI:**
```
Implemente soft delete:
- Ao invés de deletar, marcar como _isDeleted: true
- Filtrar automaticamente registros deletados em todas as queries
- Adicionar filtro em hooks customizados de leitura
- Preservar histórico de dados
```

---

## 3. Criptografia de Dados Sensíveis

### 3.1 Identificação de Dados Sensíveis

#### 👤 HUMANO - Análise e Auditoria
- [ ] **Identificar todos os dados sensíveis** (tokens OAuth, senhas, dados pessoais, etc.)
- [ ] **Decidir quais dados precisam de criptografia** (tokens, dados pessoais críticos)
- [ ] **Fazer auditoria do banco de dados** (procurar dados sensíveis em texto plano)
- [ ] **Listar todos os campos que contêm dados sensíveis**

### 3.2 Implementação de Criptografia

#### 👤 HUMANO - Configuração e Validação
- [ ] **Criar Key Ring no Cloud KMS** (ou serviço equivalente)
- [ ] **Criar chave de criptografia**
- [ ] **Configurar permissões IAM** para Cloud Functions acessarem KMS
- [ ] **Documentar localização e nomes** (Key Ring, Key Name, Location)
- [ ] **Testar criptografia manualmente** (criptografar e descriptografar um texto de teste)
- [ ] **Verificar permissões IAM** (apenas funções necessárias têm acesso)
- [ ] **Validar que chave está em região adequada** (compliance, latência)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Criar utilitários de criptografia/descriptografia
- [ ] Implementar prefixo para identificar dados criptografados (ex: `ENC:`)
- [ ] Criptografar dados sensíveis antes de salvar no banco
- [ ] Descriptografar automaticamente ao recuperar
- [ ] Adicionar cache de descriptografia (TTL: 5 minutos) para performance
- [ ] Suportar dados legados não criptografados (migração gradual)

#### 👤 HUMANO - Teste e Validação
- [ ] **Revisar código de criptografia** (verificar implementação)
- [ ] **Testar criptografia/descriptografia** (verificar que funciona corretamente)
- [ ] **Verificar que dados estão criptografados no banco** (inspecionar Firestore)
- [ ] **Validar prefixo ENC:** (dados criptografados devem ter prefixo)
- [ ] **Testar cache** (verificar TTL e funcionamento)
- [ ] **Validar suporte a dados legados** (testar com dados não criptografados)

**Prompt para AI:**
```
Implemente criptografia com Cloud KMS:
- Utilitários: encrypt() e decrypt()
- Prefixo ENC: para identificar dados criptografados
- Criptografar [tokens OAuth / dados sensíveis] antes de salvar
- Descriptografar automaticamente ao recuperar
- Cache de descriptografia (TTL: 5 minutos)
- Suporte a dados legados não criptografados
- Key Ring: [nome], Key Name: [nome], Location: [região]
```

---

## 4. Gerenciamento de Segredos

### 4.1 Identificação de Segredos

#### 👤 HUMANO - Auditoria Completa
- [ ] **Listar todos os segredos do sistema** (API keys, client secrets, tokens, etc.)
- [ ] **Buscar segredos hardcoded no código** (usar grep/ripgrep para buscar padrões):
  ```bash
  # Buscar por padrões suspeitos
  grep -r "api[_-]key" .
  grep -r "secret" .
  grep -r "password" .
  grep -r "token" .
  ```
- [ ] **Revisar histórico do Git** (verificar se segredos foram commitados)
- [ ] **Verificar arquivos de configuração** (não devem conter segredos)
- [ ] **Listar todas as variáveis de ambiente necessárias**

### 4.2 Configuração de Segredos

#### 👤 HUMANO - Configuração e Validação
- [ ] **Configurar Firebase Secrets** (ou serviço equivalente):
  ```bash
  firebase functions:secrets:set GOOGLE_CLIENT_ID
  firebase functions:secrets:set GOOGLE_CLIENT_SECRET
  ```
- [ ] **Criar arquivo `.env.example`** (sem valores reais, apenas nomes)
- [ ] **Adicionar `.env` ao `.gitignore`** (verificar se está lá)
- [ ] **Configurar variáveis de ambiente** no ambiente de produção
- [ ] **Verificar que secrets estão configurados** (testar acesso)
- [ ] **Validar que `.env.example` não contém valores reais**
- [ ] **Revisar `.gitignore`** (garantir que arquivos sensíveis estão ignorados)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Remover todos os segredos hardcoded do código
- [ ] Implementar leitura de secrets via `process.env`
- [ ] Adicionar validação de existência de secrets antes de usar
- [ ] Criar mensagens de erro informativas quando secrets não configurados
- [ ] Configurar Cloud Functions com `secrets` no `runWith()`

#### 👤 HUMANO - Verificação Final
- [ ] **Revisar código após remoção de segredos** (garantir que foram removidos)
- [ ] **Testar sistema sem secrets configurados** (deve mostrar erro claro)
- [ ] **Testar sistema com secrets configurados** (deve funcionar)
- [ ] **Verificar mensagens de erro** (não devem expor informações sensíveis)
- [ ] **Fazer busca final por segredos** (garantir que não há nenhum hardcoded)

**Prompt para AI:**
```
Implemente gerenciamento de segredos:
- Remover todos os segredos hardcoded
- Ler secrets via process.env
- Validar existência antes de usar
- Mensagens de erro claras quando não configurado
- Configurar Cloud Functions com secrets no runWith()
- Criar .env.example (sem valores reais)
```

---

## 5. Validação de Inputs

### 5.1 Validação com Schemas (Zod)

#### 👤 HUMANO - Definição e Revisão
- [ ] **Listar todos os formulários do sistema**
- [ ] **Definir regras de validação** para cada campo (tipo, formato, limites)
- [ ] **Documentar regras de validação** (criar documento de referência)
- [ ] **Revisar schemas Zod criados** (verificar se estão corretos)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Criar schemas Zod para todos os formulários
- [ ] Validar tipos, formatos e limites
- [ ] Adicionar mensagens de erro personalizadas
- [ ] Integrar com react-hook-form (ou biblioteca equivalente)

#### 👤 HUMANO - Teste Manual
- [ ] **Testar cada formulário** (tentar enviar dados inválidos)
- [ ] **Verificar mensagens de erro** (devem ser claras e em português)
- [ ] **Testar limites** (valores mínimos e máximos)
- [ ] **Validar formatos** (email, URL, data, etc.)
- [ ] **Revisar schemas implementados** (comparar com definição)

**Prompt para AI:**
```
Crie schemas Zod para validação:
- Formulário [nome]: validar campos [lista]
- Tipos corretos (string, number, date, etc.)
- Formatos (email, URL, etc.)
- Limites (min/max length, min/max value)
- Mensagens de erro personalizadas em português
- Integração com react-hook-form
```

### 5.2 Sanitização de HTML

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Instalar e configurar DOMPurify
- [ ] Criar função de sanitização (remover todas as tags e atributos)
- [ ] Aplicar sanitização em todos os campos de texto livre:
  - Nomes, descrições, notas, comentários
- [ ] Configurar: `ALLOWED_TAGS: []`, `ALLOWED_ATTR: []`

#### 👤 HUMANO - Teste de Segurança
- [ ] **Testar sanitização manualmente** (inserir HTML/script e verificar remoção)
- [ ] **Tentar inserir XSS** (`<script>alert('XSS')</script>`) e verificar bloqueio
- [ ] **Verificar que tags HTML são removidas** (testar vários tipos de tags)
- [ ] **Validar que sanitização ocorre antes de salvar** (inspecionar banco de dados)
- [ ] **Testar em todos os campos de texto livre** (não apenas um)

**Prompt para AI:**
```
Implemente sanitização de HTML:
- Usar DOMPurify
- Função sanitize() que remove todas as tags e atributos
- Aplicar em todos os campos de texto livre
- Configuração: ALLOWED_TAGS: [], ALLOWED_ATTR: []
- Aplicar antes de salvar no banco de dados
```

### 5.3 TypeScript Strict

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Habilitar TypeScript strict mode
- [ ] Criar interfaces/tipos para todas as entidades
- [ ] Validar tipos em tempo de compilação
- [ ] Corrigir todos os erros de tipo

#### 👤 HUMANO - Revisão
- [ ] **Executar typecheck** (`npm run typecheck` ou `tsc --noEmit`)
- [ ] **Revisar interfaces criadas** (verificar se estão completas e corretas)
- [ ] **Corrigir erros de tipo manualmente** (se necessário)
- [ ] **Validar que não há `any` desnecessários** (buscar por `: any`)

**Prompt para AI:**
```
Configure TypeScript strict:
- Habilitar strict mode no tsconfig.json
- Criar interfaces para todas as entidades do sistema
- Corrigir todos os erros de tipo
- Garantir tipagem forte em todo o código
```

---

## 6. Proteção contra XSS

### 6.1 Sanitização de Entrada

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Aplicar DOMPurify em todos os inputs de usuário
- [ ] Remover scripts e código malicioso
- [ ] Proteger campos de texto, descrições, notas

#### 👤 HUMANO - Teste de Penetração Básico
- [ ] **Tentar inserir payloads XSS conhecidos** (verificar bloqueio)
- [ ] **Testar diferentes tipos de ataques XSS** (reflected, stored, DOM-based)
- [ ] **Verificar que scripts não são executados** (inspecionar DOM)
- [ ] **Testar em diferentes navegadores** (Chrome, Firefox, Safari)

**Prompt para AI:**
```
Proteja contra XSS:
- Sanitizar todos os inputs com DOMPurify
- Remover scripts e código malicioso
- Aplicar em: campos de texto, descrições, notas, comentários
```

### 6.2 Renderização Segura

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Usar renderização segura do React (escape automático)
- [ ] Evitar `dangerouslySetInnerHTML`
- [ ] Usar componentes seguros de UI (shadcn/ui ou equivalente)

#### 👤 HUMANO - Auditoria de Código
- [ ] **Buscar por `dangerouslySetInnerHTML`** no código (não deve existir)
- [ ] **Revisar componentes customizados** (verificar renderização segura)
- [ ] **Verificar que React está escapando conteúdo** (testar renderização)
- [ ] **Validar componentes de UI** (garantir que são seguros)

**Prompt para AI:**
```
Garanta renderização segura:
- Usar renderização padrão do React (escape automático)
- Nunca usar dangerouslySetInnerHTML
- Usar componentes seguros de UI
- Validar que não há XSS em componentes customizados
```

---

## 7. Segurança de Cloud Functions / Backend

### 7.1 Configuração de Segurança

#### 👤 HUMANO - Configuração e Revisão
- [ ] **Definir origens permitidas no CORS** (apenas domínios necessários)
- [ ] **Configurar CORS adequadamente** (origens permitidas)
- [ ] **Revisar permissões IAM** das Cloud Functions (princípio do menor privilégio)
- [ ] **Listar todas as Cloud Functions** e suas permissões necessárias
- [ ] **Validar que CORS não permite `*`** (apenas origens específicas)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Configurar CORS com origens permitidas
- [ ] Validar todos os parâmetros obrigatórios
- [ ] Tratar erros sem expor informações sensíveis
- [ ] Adicionar logs estruturados para auditoria
- [ ] Validar método HTTP (OPTIONS, GET, POST)

#### 👤 HUMANO - Teste e Validação
- [ ] **Testar CORS manualmente** (requisições de origens não permitidas devem falhar)
- [ ] **Revisar tratamento de erros** (não deve expor stack traces)
- [ ] **Verificar logs** (devem ser estruturados e não expor dados sensíveis)
- [ ] **Testar validação de parâmetros** (enviar requisições inválidas)
- [ ] **Validar métodos HTTP** (bloquear métodos não permitidos)

**Prompt para AI:**
```
Configure segurança em Cloud Functions:
- CORS com origens permitidas: [lista]
- Validação de parâmetros obrigatórios
- Tratamento de erros genérico (não expor stack traces)
- Logs estruturados para auditoria
- Validação de método HTTP
```

### 7.2 Princípio do Menor Privilégio

#### 👤 HUMANO - Auditoria de Permissões
- [ ] **Listar todas as Cloud Functions** do sistema
- [ ] **Revisar permissões IAM** de cada Cloud Function
- [ ] **Garantir acesso mínimo necessário** (apenas o que cada função precisa)
- [ ] **Documentar permissões necessárias por função** (criar documento)
- [ ] **Listar quais funções acessam KMS, Firestore, etc.**
- [ ] **Remover permissões desnecessárias** (se houver)
- [ ] **Validar que funções críticas têm apenas permissões necessárias**

---

## 8. Atualizações de Segurança

### 8.1 Dependências

#### 👤 HUMANO - Verificação e Atualização
- [ ] **Executar verificação de vulnerabilidades**:
  ```bash
  npm audit
  # ou
  yarn audit
  ```
- [ ] **Analisar relatório de vulnerabilidades** (identificar críticas)
- [ ] **Pesquisar vulnerabilidades críticas** (entender impacto)
- [ ] **Atualizar dependências críticas** com vulnerabilidades conhecidas
- [ ] **Testar sistema após atualização** (garantir que não quebrou)
- [ ] **Documentar processo de atualização** (criar SECURITY_UPDATE_GUIDE.md)
- [ ] **Criar plano de atualização** (quando atualizar cada dependência)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Criar documentação de vulnerabilidades conhecidas
- [ ] Documentar processo de atualização
- [ ] Adicionar script de verificação de segurança

#### 👤 HUMANO - Revisão de Documentação
- [ ] **Revisar documentação criada** (verificar se está completa e correta)
- [ ] **Validar processo de atualização** (seguir o processo documentado)
- [ ] **Testar script de verificação** (garantir que funciona)

**Prompt para AI:**
```
Crie documentação de segurança:
- Arquivo SECURITY_UPDATE_GUIDE.md
- Listar vulnerabilidades conhecidas e versões corrigidas
- Processo de atualização passo a passo
- Script para verificar versões de dependências
```

### 8.2 Monitoramento

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Implementar logs estruturados em Cloud Functions
- [ ] Adicionar tratamento de erros com mensagens apropriadas
- [ ] Criar listener de erros no frontend (Firebase Error Listener)

#### 👤 HUMANO - Revisão de Logs
- [ ] **Revisar logs gerados** (verificar formato e conteúdo)
- [ ] **Validar que logs não expõem dados sensíveis** (tokens, senhas, etc.)
- [ ] **Testar listener de erros** (simular erros e verificar comportamento)
- [ ] **Configurar alertas** (se necessário, para erros críticos)
- [ ] **Revisar nível de log** (info, warn, error - garantir adequado)

**Prompt para AI:**
```
Implemente monitoramento:
- Logs estruturados em Cloud Functions
- Tratamento de erros com mensagens apropriadas
- Listener de erros no frontend
- Não expor informações sensíveis nos logs
```

---

## 9. Proteção de Dados Pessoais (LGPD/GDPR)

### 9.1 Minimização de Dados

#### 👤 HUMANO - Análise e Documentação
- [ ] **Revisar quais dados são coletados** (fazer inventário completo)
- [ ] **Garantir que apenas dados necessários são coletados** (remover desnecessários)
- [ ] **Documentar propósito de cada dado coletado** (criar documento LGPD/GDPR)
- [ ] **Revisar formulários** (identificar campos desnecessários)
- [ ] **Criar política de privacidade** (se necessário)

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Remover campos desnecessários de formulários
- [ ] Implementar soft delete para preservar histórico sem expor dados ativos

#### 👤 HUMANO - Validação
- [ ] **Validar que campos desnecessários foram removidos**
- [ ] **Testar soft delete** (verificar que dados não aparecem mas são preservados)

### 9.2 Controle de Acesso a Dados

#### 🤖 FERRAMENTA/AI - Implementação
- [ ] Restringir acesso por roles
- [ ] Validar permissões antes de exibir dados
- [ ] Criptografar dados pessoais sensíveis

#### 👤 HUMANO - Teste de Acesso
- [ ] **Testar acesso a dados pessoais** (usuário sem permissão não acessa)
- [ ] **Validar que dados sensíveis estão criptografados** (inspecionar banco)
- [ ] **Verificar que permissões são validadas** (testar diferentes roles)
- [ ] **Revisar quais dados pessoais são exibidos** (garantir minimização)

---

## 10. Arquitetura de Segurança

### 10.1 Defesa em Profundidade

#### 👤 HUMANO - Auditoria de Arquitetura
- [ ] **Verificar que existem múltiplas camadas de proteção:**
  - Camada 1: Autenticação
  - Camada 2: Validação de domínio/usuário
  - Camada 3: Verificação no banco de dados
  - Camada 4: Validação de roles
  - Camada 5: Regras de segurança do banco
  - Camada 6: Validação e sanitização de inputs
- [ ] **Testar cada camada individualmente** (garantir que todas funcionam)
- [ ] **Testar bypass de camadas** (tentar pular uma camada e verificar bloqueio)
- [ ] **Documentar arquitetura de segurança** (criar documento)
- [ ] **Criar diagrama de camadas de proteção** (visual)

#### 🤖 FERRAMENTA/AI - Documentação
- [ ] Gerar diagrama de camadas de proteção (se possível)

---

## ✅ Checklist Final Antes de Produção

### 👤 HUMANO - Verificação Manual Completa
- [ ] **Auditoria final de segredos:**
  - [ ] Todos os segredos estão em variáveis de ambiente (nenhum hardcoded)
  - [ ] Busca final por segredos no código (grep/ripgrep)
  - [ ] Verificar histórico do Git (não há segredos commitados)
- [ ] **Validação de regras de segurança:**
  - [ ] Regras de segurança do banco estão configuradas corretamente
  - [ ] Testar cada regra manualmente (read, write, delete)
  - [ ] Verificar que não há regras permissivas (`if true`)
- [ ] **Revisão de permissões:**
  - [ ] Permissões IAM estão com menor privilégio necessário
  - [ ] Revisar permissões de cada Cloud Function
  - [ ] Validar que funções críticas têm apenas permissões necessárias
- [ ] **Verificação de dependências:**
  - [ ] Dependências atualizadas (sem vulnerabilidades críticas conhecidas)
  - [ ] Executar `npm audit` e analisar resultados
  - [ ] Verificar versões de dependências críticas
- [ ] **Configurações de segurança:**
  - [ ] CORS configurado apenas para origens necessárias
  - [ ] Domínios de email autorizados estão corretos
  - [ ] Roles e permissões estão mapeadas corretamente
  - [ ] KMS configurado corretamente (chaves, permissões)
- [ ] **Testes manuais de segurança:**
  - [ ] Testar autenticação (login, logout, redirecionamento)
  - [ ] Testar validação de domínio (bloquear domínios não autorizados)
  - [ ] Testar permissões (usuário sem permissão não acessa)
  - [ ] Testar sanitização (tentar inserir HTML/script)
  - [ ] Testar regras de segurança (tentar acessar sem autenticação)
  - [ ] Testar criptografia (verificar que dados estão criptografados)

### 👤 HUMANO - Execução de Testes Automatizados
- [ ] **Executar `npm audit`** (sem vulnerabilidades críticas)
  - [ ] Analisar relatório completo
  - [ ] Identificar vulnerabilidades críticas
  - [ ] Criar plano de correção
- [ ] **Executar `npm run typecheck`** (sem erros de tipo)
  - [ ] Corrigir erros de tipo manualmente
  - [ ] Revisar interfaces e tipos
- [ ] **Executar `npm run lint`** (sem erros críticos)
  - [ ] Corrigir erros de lint manualmente
  - [ ] Revisar código após correções
- [ ] **Executar testes de segurança:**
  - [ ] Testar autenticação (login, logout, redirecionamento)
  - [ ] Testar validação de domínio (bloquear domínios não autorizados)
  - [ ] Testar permissões (usuário sem permissão não acessa)
  - [ ] Testar sanitização (tentar inserir HTML/script)
  - [ ] Testar regras de segurança (tentar acessar sem autenticação)
- [ ] **Documentar resultados dos testes** (criar relatório)

---

## 📝 Template de Prompt para AI

Quando for implementar segurança em um novo sistema, use este prompt:

```
Implemente segurança completa baseada no protocolo:

1. Autenticação:
   - Provedor: [Google OAuth / Auth0 / outro]
   - Domínios autorizados: [lista]
   - Roles: [lista]

2. Banco de Dados:
   - Tipo: [Firestore / PostgreSQL / outro]
   - Coleções/Tabelas: [lista]
   - Permissões por coleção: [definir]

3. Dados Sensíveis:
   - Tokens OAuth: criptografar com KMS
   - [outros dados sensíveis]

4. Segredos:
   - [lista de segredos]
   - Usar Firebase Secrets / variáveis de ambiente

5. Validação:
   - Schemas Zod para: [lista de formulários]
   - Sanitização DOMPurify em: [campos de texto livre]

6. Proteção XSS:
   - Sanitizar todos os inputs
   - Renderização segura

7. Cloud Functions:
   - CORS: [origens permitidas]
   - Validação de parâmetros
   - Logs estruturados

Seguir exatamente o protocolo de segurança documentado.
```

---

## 🔄 Manutenção Contínua

### 👤 HUMANO - Tarefas Periódicas Obrigatórias
- [ ] **Mensalmente:**
  - [ ] Executar `npm audit` e analisar resultados
  - [ ] Verificar logs de segurança (erros, tentativas de acesso)
  - [ ] Revisar lista de usuários admin (remover desnecessários)
  - [ ] Verificar que segredos ainda estão configurados corretamente
- [ ] **Trimestralmente:**
  - [ ] Revisar permissões IAM (todas as Cloud Functions)
  - [ ] Auditoria de regras de segurança do banco
  - [ ] Revisar lista de domínios autorizados
  - [ ] Verificar que criptografia está funcionando (testar manualmente)
  - [ ] Revisar logs de acesso (identificar padrões suspeitos)
- [ ] **Semestralmente:**
  - [ ] Auditoria completa de segurança (seguir protocolo completo)
  - [ ] Revisar arquitetura de segurança (verificar camadas)
  - [ ] Testar todos os cenários de segurança manualmente
  - [ ] Revisar documentação de segurança (atualizar se necessário)
  - [ ] Verificar compliance LGPD/GDPR (se aplicável)
- [ ] **Quando necessário:**
  - [ ] Atualizar dependências com vulnerabilidades conhecidas
  - [ ] Revisar após incidentes de segurança
  - [ ] Atualizar após mudanças significativas no sistema

### 🤖 FERRAMENTA/AI - Automação
- [ ] Configurar alertas de vulnerabilidades (Dependabot, Snyk, etc.)
- [ ] Automatizar testes de segurança
- [ ] Gerar relatórios periódicos de segurança

---

**Versão do Protocolo:** 1.0  
**Última Atualização:** Janeiro 2025  
**Baseado em:** CRM Interno (Nina 1.0)

