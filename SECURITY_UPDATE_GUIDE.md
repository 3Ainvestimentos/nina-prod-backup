# 🛡️ Guia de Atualização de Segurança (React2Shell)

**Vulnerabilidade:** CVE-2025-55182 (React2Shell)  
**Nível:** Crítico  
**Data:** Dezembro 2025  

## O que é?
React2Shell é uma vulnerabilidade crítica em React Server Components (RSC) que afeta Next.js e outros frameworks. Permite execução remota de código (RCE).

## Versões Afetadas e Correções

Se você estiver usando Next.js, verifique sua versão no `package.json` e atualize conforme a tabela abaixo:

| Versão Vulnerável | Versão Corrigida (Patch) |
|-------------------|--------------------------|
| Next.js 15.0.x    | **15.0.5**               |
| Next.js 15.1.x    | **15.1.9**               |
| Next.js 15.2.x    | **15.2.6**               |
| Next.js 15.3.x    | **15.3.6**               |
| Next.js 15.4.x    | **15.4.8**               |
| Next.js 15.5.x    | **15.5.7**               |
| Next.js 16.0.x    | **16.0.7**               |

> **Nota:** Se estiver usando versões Canary, consulte o boletim oficial da Vercel para o commit específico.

## Como Atualizar (Exemplo para v15.3.x)

1. Abra o arquivo `package.json`.
2. Localize a dependência `next`.
3. Altere a versão para a correspondente corrigida (ex: `15.3.6`).

```json
// Antes
"next": "15.3.3"

// Depois
"next": "15.3.6"
```

4. Execute o comando para atualizar:

```bash
npm install
```

5. Valide a instalação:

```bash
npm list next
```
Deve retornar `next@15.3.6`.

6. Verifique se o projeto compila:

```bash
npm run build
```

## Referências
- [Vercel Security Bulletin](https://vercel.com/blog/security-bulletin-nextjs-react2shell)
