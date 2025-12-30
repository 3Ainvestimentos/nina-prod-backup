---
name: Data Security Hardening
overview: Plano incremental de robustez no armazenamento de dados seguindo melhores práticas de Data Security, DevSecOps e Cloud Security. Implementação em 5 fases, priorizando criptografia de dados sensíveis, backups automatizados, auditoria e validação de integridade.
todos:
  - id: phase1-kms-setup
    content: "Fase 1.1: Configurar Cloud KMS (key ring, keys, IAM) e criar utilitários de criptografia"
    status: pending
  - id: phase1-encrypt-tokens
    content: "Fase 1.2: Criptografar tokens OAuth antes de salvar no Firestore"
    status: pending
    dependencies:
      - phase1-kms-setup
  - id: phase1-migrate-tokens
    content: "Fase 1.3: Migrar tokens existentes para formato criptografado"
    status: pending
    dependencies:
      - phase1-encrypt-tokens
  - id: phase2-backup-config
    content: "Fase 2.1: Configurar Firestore Scheduled Backups com retenção"
    status: pending
  - id: phase2-backup-function
    content: "Fase 2.2: Criar Cloud Function para backup manual e validação"
    status: pending
    dependencies:
      - phase2-backup-config
  - id: phase2-restore-test
    content: "Fase 2.3: Criar script de teste de restauração e documentar processo"
    status: pending
    dependencies:
      - phase2-backup-function
  - id: phase3-audit-triggers
    content: "Fase 3.1: Criar Cloud Function triggers para auditoria de mudanças"
    status: pending
  - id: phase3-audit-structure
    content: "Fase 3.2: Criar estrutura de logs de auditoria e regras Firestore"
    status: pending
    dependencies:
      - phase3-audit-triggers
  - id: phase3-audit-dashboard
    content: "Fase 3.3: Criar dashboard de auditoria no frontend"
    status: pending
    dependencies:
      - phase3-audit-structure
  - id: phase4-validators
    content: "Fase 4.1: Criar schemas Zod e validar dados no backend"
    status: pending
  - id: phase4-integrity-checker
    content: "Fase 4.2: Criar verificador de integridade de dados"
    status: pending
    dependencies:
      - phase4-validators
  - id: phase4-soft-delete
    content: "Fase 4.3: Melhorar soft delete com retenção configurável"
    status: pending
    dependencies:
      - phase4-integrity-checker
  - id: phase5-monitoring
    content: "Fase 5.1: Configurar Cloud Monitoring e alertas"
    status: pending
  - id: phase5-logging
    content: "Fase 5.2: Implementar logging estruturado em Cloud Functions"
    status: pending
    dependencies:
      - phase5-monitoring
  - id: phase5-security-dashboard
    content: "Fase 5.3: Criar dashboard de métricas de segurança"
    status: pending
    dependencies:
      - phase5-logging
---

# Plano

de Robustez no Armazenamento de Dados

## Objetivo

Implementar melhorias incrementais na segurança e robustez do armazenamento de dados, seguindo melhores práticas de Data Security, DevSecOps e Cloud Security.

## Análise do Estado Atual

### Pontos Críticos Identificados:

1. **Tokens OAuth em texto plano** - `refreshToken` armazenado sem criptografia no Firestore
2. **Sem backup automatizado** - Dependência apenas de backups manuais
3. **Sem auditoria de mudanças** - Não há log de alterações críticas
4. **Validação de dados limitada** - Validação apenas no frontend
5. **Sem retenção de dados** - Política de retenção não implementada
6. **Soft delete inconsistente** - Implementado mas pode ser melhorado

### Arquivos Principais:

- `functions/src/google-auth.ts` - Armazena tokens OAuth
- `firestore.rules` - Regras de segurança
- `src/lib/types.ts` - Estruturas de dados
- `functions/src/index.ts` - Cloud Functions principais

---

## Fase 1: Criptografia de Dados Sensíveis (CRÍTICO)

### Objetivo

Criptografar dados sensíveis antes de armazenar no Firestore, especialmente tokens OAuth.

### Implementação:

#### 1.1 Configurar Cloud KMS

- Criar key ring e keys no Cloud KMS
- Configurar IAM para Cloud Functions acessarem KMS
- Criar função utilitária para criptografia/descriptografia

**Arquivos:**

- `functions/src/kms-utils.ts` (novo) - Utilitários de criptografia
- `functions/src/google-auth.ts` - Modificar para criptografar tokens antes de salvar

#### 1.2 Criptografar Tokens OAuth

- Criptografar `refreshToken` antes de salvar no Firestore
- Descriptografar ao recuperar para uso
- Manter compatibilidade com tokens existentes (migração)

**Arquivos:**

- `functions/src/google-auth.ts` - Adicionar criptografia
- `functions/src/migrations.ts` - Migração de tokens existentes

#### 1.3 Criptografar Campos Sensíveis de Employees

- Identificar campos sensíveis (emails, dados pessoais)
- Aplicar criptografia seletiva conforme necessidade

**Arquivos:**

- `functions/src/kms-utils.ts` - Funções de criptografia
- `functions/src/index.ts` - Aplicar em Cloud Functions que salvam dados

---

## Fase 2: Backup Automatizado e Disaster Recovery

### Objetivo

Implementar backups automatizados do Firestore com retenção configurável.

### Implementação:

#### 2.1 Configurar Firestore Backup Schedule

- Habilitar Firestore Scheduled Backups
- Configurar frequência (diária recomendada)
- Definir retenção (30-90 dias)

**Arquivos:**

- `firebase.json` - Adicionar configuração de backup
- `functions/src/backup-manager.ts` (novo) - Gerenciar backups

#### 2.2 Cloud Function para Backup Manual

- Criar função para trigger manual de backup
- Validar integridade dos backups
- Notificações de status

**Arquivos:**

- `functions/src/backup-manager.ts` - Função de backup
- `functions/src/index.ts` - Exportar função

#### 2.3 Teste de Restauração

- Documentar processo de restauração
- Criar script de teste de restauração
- Validar integridade após restauração

**Arquivos:**

- `scripts/test-restore.ts` (novo) - Script de teste

---

## Fase 3: Auditoria e Logging de Mudanças

### Objetivo

Implementar auditoria completa de mudanças em dados críticos.

### Implementação:

#### 3.1 Cloud Function Triggers para Auditoria

- Criar triggers `onWrite` para coleções críticas
- Registrar mudanças em coleção de auditoria
- Incluir: quem, quando, o que, antes/depois

**Arquivos:**

- `functions/src/audit-logger.ts` (novo) - Sistema de auditoria
- `functions/src/index.ts` - Registrar triggers

#### 3.2 Estrutura de Logs de Auditoria

- Criar coleção `/auditLogs/{logId}`
- Campos: timestamp, userId, action, collection, documentId, before, after, ipAddress

**Arquivos:**

- `src/lib/types.ts` - Adicionar tipo `AuditLog`
- `firestore.rules` - Regras para coleção de auditoria (somente leitura para admins)

#### 3.3 Dashboard de Auditoria

- Interface para visualizar logs de auditoria
- Filtros por usuário, data, ação, coleção

**Arquivos:**

- `src/app/dashboard/admin/audit/page.tsx` (novo) - Página de auditoria

---

## Fase 4: Validação e Integridade de Dados

### Objetivo

Implementar validação robusta no backend e verificação de integridade.

### Implementação:

#### 4.1 Validação com Zod no Backend

- Criar schemas Zod para todas as entidades
- Validar dados em Cloud Functions antes de salvar
- Retornar erros detalhados

**Arquivos:**

- `functions/src/validators/` (novo diretório) - Schemas Zod
- `employee-validator.ts`
- `interaction-validator.ts`
- `project-validator.ts`
- `functions/src/index.ts` - Aplicar validação em todas as funções

#### 4.2 Verificação de Integridade

- Cloud Function para verificar integridade de dados
- Detectar inconsistências (referências quebradas, dados órfãos)
- Relatório de integridade

**Arquivos:**

- `functions/src/data-integrity-checker.ts` (novo) - Verificador de integridade

#### 4.3 Soft Delete Melhorado

- Padronizar uso de `_isDeleted` e `_deletedAt`
- Cloud Function para limpeza automática após período de retenção
- Política de retenção configurável

**Arquivos:**

- `functions/src/soft-delete-manager.ts` (novo) - Gerenciador de soft delete
- `firestore.rules` - Atualizar regras para filtrar deletados

---

## Fase 5: Monitoramento e Alertas

### Objetivo

Implementar monitoramento proativo e alertas para anomalias.

### Implementação:

#### 5.1 Cloud Monitoring e Alertas

- Configurar alertas para:
- Falhas de backup
- Tentativas de acesso não autorizado
- Mudanças em dados críticos
- Uso anômalo de recursos

**Arquivos:**

- `monitoring/alerts.yaml` (novo) - Configuração de alertas

#### 5.2 Logging Estruturado

- Padronizar logs em Cloud Functions
- Usar severity levels (INFO, WARN, ERROR)
- Incluir contexto relevante

**Arquivos:**

- `functions/src/logger.ts` (novo) - Logger estruturado
- Atualizar todas as Cloud Functions para usar logger

#### 5.3 Dashboard de Métricas

- Interface para visualizar métricas de segurança
- Estatísticas de auditoria, backups, integridade

**Arquivos:**

- `src/app/dashboard/admin/security/page.tsx` (novo) - Dashboard de segurança

---

## Dependências e Configurações

### Serviços Firebase/Google Cloud Necessários:

1. **Cloud KMS** - Criptografia de dados sensíveis
2. **Firestore Scheduled Backups** - Backups automatizados
3. **Cloud Monitoring** - Monitoramento e alertas
4. **Cloud Logging** - Logs estruturados

### Variáveis de Ambiente:

- `KMS_KEY_RING` - Nome do key ring
- `KMS_KEY_NAME` - Nome da chave de criptografia
- `KMS_LOCATION` - Região do KMS
- `BACKUP_RETENTION_DAYS` - Dias de retenção de backup

### Permissões IAM Necessárias:

- `cloudkms.cryptoKeyVersions.useToEncrypt`
- `cloudkms.cryptoKeyVersions.useToDecrypt`
- `firestore.backups.create`
- `firestore.backups.list`
- `logging.logEntries.create`

---

## Ordem de Implementação Recomendada

1. **Fase 1** (Crítico) - Criptografia de tokens OAuth
2. **Fase 2** (Alto) - Backups automatizados
3. **Fase 3** (Médio) - Auditoria de mudanças
4. **Fase 4** (Médio) - Validação e integridade
5. **Fase 5** (Baixo) - Monitoramento e alertas

---

## Considerações de Segurança

- **Princípio do Menor Privilégio**: Aplicar IAM mínimo necessário
- **Criptografia em Trânsito e Repouso**: Garantir ambos
- **Rotação de Chaves**: Implementar rotação periódica de chaves KMS
- **Segredos**: Nunca commitar chaves ou secrets no código
- **Compliance**: Considerar LGPD/GDPR para dados pessoais

---

## Testes Necessários

- Testes unitários para funções de criptografia