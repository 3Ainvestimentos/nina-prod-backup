# Fase 2: Configuração de Backups Automatizados - Guia de Setup

**Data:** 23/12/2025  
**Status:** ⚠️ Configuração Manual Necessária

---

## 📋 Pré-requisitos

- Acesso ao Google Cloud Console
- Permissões de administrador no projeto Firebase
- Projeto: `studio-9152494730-25d31`

---

## 🔧 Configuração: Firestore Scheduled Backups

### Opção 1: Via Google Cloud Console (Recomendado)

#### Passo 1: Acessar Firestore

1. Acesse: https://console.firebase.google.com/project/studio-9152494730-25d31/firestore
2. Ou via Google Cloud: https://console.cloud.google.com/firestore/databases?project=studio-9152494730-25d31

#### Passo 2: Criar Schedule de Backup

1. No menu lateral, clique em **"Backups"** ou **"Backup schedules"**
2. Clique em **"+ CREATE BACKUP SCHEDULE"** ou **"Criar agendamento de backup"**

#### Passo 3: Configurar Parâmetros

Preencha os campos:

- **Nome do schedule:** `weekly-backup` (ou qualquer nome)
- **Frequência:** `Weekly` (Semanal)
- **Dia da semana:** Escolha um dia (ex: Domingo)
- **Hora:** Escolha um horário (ex: 03:00)
- **Retenção:** `45 days` (45 dias)
- **Região:** `us-central1` (mesma região do Firestore)

#### Passo 4: Confirmar

1. Revise as configurações
2. Clique em **"CREATE"** ou **"CRIAR"**

#### Passo 5: Verificar

1. Você verá o schedule na lista de backups
2. O primeiro backup será criado no próximo horário agendado

---

### Opção 2: Via gcloud CLI

Se você tem `gcloud` instalado e autenticado:

```bash
# Criar schedule de backup semanal com retenção de 45 dias
gcloud firestore backups schedules create \
  --database="(default)" \
  --recurrence=weekly \
  --retention=45d \
  --location=us-central1 \
  --project=studio-9152494730-25d31
```

**Verificar schedule criado:**
```bash
gcloud firestore backups schedules list \
  --database="(default)" \
  --location=us-central1 \
  --project=studio-9152494730-25d31
```

---

## ✅ Validação

### Como verificar se está funcionando:

1. **Aguardar primeiro backup:**
   - O primeiro backup será criado no próximo horário agendado
   - Exemplo: Se configurou para domingo 03:00, aguarde até domingo

2. **Verificar no Console:**
   - Firebase Console > Firestore > Backups
   - Deve aparecer um backup com nome `auto-YYYYMMDD-HHMMSS`

3. **Verificar via Interface:**
   - Acesse `/dashboard/admin` > Aba "Backup"
   - Clique em "Atualizar Lista"
   - Deve aparecer backups automáticos na lista

---

## 📊 Configuração Atual

| Parâmetro | Valor |
|-----------|-------|
| **Frequência** | Semanal |
| **Retenção** | 45 dias |
| **Região** | us-central1 |
| **Bucket** | `studio-9152494730-25d31-backups` |

---

## 🔍 Troubleshooting

### Problema: "Backup schedule não aparece"

**Solução:**
- Verifique se está na região correta (us-central1)
- Verifique permissões IAM
- Tente criar via gcloud CLI

### Problema: "Backups não estão sendo criados"

**Solução:**
- Verifique se o schedule está ativo
- Verifique logs do Cloud Scheduler
- Verifique se há erros no Console

### Problema: "Não consigo ver backups na interface"

**Solução:**
- Verifique se o bucket `studio-9152494730-25d31-backups` existe
- Verifique permissões do service account
- Tente listar via gcloud: `gcloud firestore backups list`

---

## 📝 Próximos Passos

Após configurar o Scheduled Backup:

1. ✅ Aguardar primeiro backup automático
2. ✅ Testar interface de backup manual
3. ✅ Validar lista de backups
4. ✅ Testar validação de backup

---

**Última atualização:** 23/12/2025

