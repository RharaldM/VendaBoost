# Problema: Painel não conecta ao Bridge - Porta Incorreta

## 🚨 Sintomas do Problema

- **Erro no console do painel:** `Failed to fetch`
- **Erro específico:** `TypeError: Failed to fetch` em `BridgeClient.getSessions`
- **Comportamento:** Painel carrega mas não consegue buscar sessões ou criar jobs
- **Automação:** Não executa porque não consegue se comunicar com o bridge

## 🔍 Causa Raiz

**Configuração de porta incorreta no painel:**

- **Bridge roda na porta:** `49017`
- **Painel configurado para:** `49018` ❌

## 📁 Arquivo Problema

**Localização:** `panel/src/lib/env.ts`

**Linha problema:**
```typescript
NEXT_PUBLIC_BRIDGE_URL: z.string().default('http://127.0.0.1:49018'), // ❌ PORTA ERRADA
```

## ✅ Solução

**1. Editar o arquivo:** `panel/src/lib/env.ts`

**2. Corrigir a linha 4:**
```typescript
// ANTES (errado)
NEXT_PUBLIC_BRIDGE_URL: z.string().default('http://127.0.0.1:49018'),

// DEPOIS (correto)
NEXT_PUBLIC_BRIDGE_URL: z.string().default('http://127.0.0.1:49017'),
```

**3. Recarregar a página do painel** (F5 ou Ctrl+R)

## 🔧 Como Identificar Este Problema

### Sintomas Visuais:
- ❌ Erro `Failed to fetch` no console do navegador
- ❌ Painel não carrega lista de sessões
- ❌ Botão "Publicar" não funciona
- ❌ Nenhum job é criado

### Verificação Rápida:
1. **Verificar se bridge está rodando:**
   ```bash
   # Deve responder "ok"
   curl http://127.0.0.1:49017/healthz
   ```

2. **Verificar configuração do painel:**
   ```bash
   # Verificar arquivo env.ts
   cat panel/src/lib/env.ts | grep BRIDGE_URL
   ```

3. **Verificar console do navegador:**
   - Abrir DevTools (F12)
   - Procurar erros de `Failed to fetch`

## 🎯 Prevenção

### Checklist antes de testar:
- [ ] Bridge rodando na porta **49017**
- [ ] Painel configurado para porta **49017**
- [ ] Painel recarregado após mudanças

### Comandos de verificação:
```bash
# Verificar se bridge está rodando
netstat -an | findstr 49017

# Ou verificar com curl
curl http://127.0.0.1:49017/healthz
```

## 📋 Informações Técnicas

**Serviços e Portas:**
- **Bridge:** `http://127.0.0.1:49017`
- **Painel:** `http://localhost:3001`

**Arquivos Envolvidos:**
- `src/server/bridge.ts` - Define porta 49017 do bridge
- `panel/src/lib/env.ts` - Configura URL de conexão do painel

**Endpoints do Bridge:**
- `GET /healthz` - Status do bridge
- `GET /sessions` - Lista sessões salvas
- `POST /jobs/marketplace.publish` - Cria job de publicação

## 🔄 Histórico

**Data:** 21/01/2025
**Contexto:** Durante desenvolvimento da integração painel + bridge
**Impacto:** Automação completamente não funcional via painel
**Tempo para resolução:** ~15 minutos de debug