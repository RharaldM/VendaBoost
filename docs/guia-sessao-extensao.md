# 🔑 Guia: Como Usar a Automação com Dados da Extensão

Este guia explica como configurar e usar corretamente a automação VendaBoost com os dados de sessão capturados pela extensão Chrome.

## 📋 Pré-requisitos

1. **Extensão Chrome VendaBoost** instalada e funcionando
2. **Sessão ativa no Facebook** através da extensão
3. **Node.js** instalado no sistema
4. **Projeto compilado** (`npm run build`)

## 🚀 Execução Correta

### Comando Principal
```bash
npx tsx src/cli.ts --auto-extension
```

### Com Debug (Recomendado para Troubleshooting)
```bash
npx tsx src/cli.ts --auto-extension --debug
```

### Parâmetros Importantes

| Parâmetro | Descrição | Obrigatório |
|-----------|-----------|-------------|
| `--auto-extension` | Carrega automaticamente a sessão mais recente da extensão | ✅ **SIM** |
| `--debug` | Exibe logs detalhados do processo | Opcional |
| `--flow flow.json` | Especifica arquivo de configuração do anúncio | Opcional (padrão: flow.json) |

## 🔄 Como Funciona

### 1. Captura da Sessão pela Extensão
- A extensão Chrome captura automaticamente os dados de sessão do Facebook
- Dados salvos em `data/sessions/current-session.json`
- Inclui: cookies, localStorage, sessionStorage, userAgent

### 2. Conversão Automática
Quando você usa `--auto-extension`, o sistema:
- Localiza o arquivo `current-session.json` mais recente
- Remove cookies conflitantes (ex: `dbln` de outros usuários)
- Converte para formato compatível com Playwright
- Salva como `vendaboost-session.json`

### 3. Aplicação da Sessão
- Cookies essenciais aplicados ao contexto do browser (`c_user`, `xs`, `datr`)
- UserAgent da extensão aplicado
- localStorage/sessionStorage restaurados
- Login automático no Facebook

## 🐛 Solução de Problemas

### Problema: "Continuar como..."
**Causa:** Múltiplas sessões conflitantes ou parâmetro incorreto
**Solução:**
```bash
# Limpar sessões antigas
rm data/sessions/session-*.json
# Executar com parâmetro correto
npx tsx src/cli.ts --auto-extension
```

### Problema: Pedindo Login/Senha
**Causa:** Cookies não aplicados ou expirados
**Solução:**
1. Verificar se a extensão capturou dados recentes
2. Executar com debug para ver logs detalhados:
```bash
npx tsx src/cli.ts --auto-extension --debug
```

### Problema: Erro "Nenhuma sessão encontrada"
**Causa:** Arquivo `current-session.json` não existe
**Solução:**
1. Abrir Facebook na extensão Chrome
2. Aguardar a extensão capturar os dados
3. Verificar se arquivo foi criado em `data/sessions/`

## 📁 Estrutura de Arquivos

```
data/
├── sessions/
│   ├── current-session.json     # Sessão atual da extensão
│   └── session-*.json          # Backups por timestamp
├── vendaboost-session.json     # Sessão convertida para Playwright
└── ...
```

## 🔍 Logs de Debug

Com `--debug`, você verá logs como:
```
📦 Convertendo sessão da extensão para Playwright
👤 Usuário: Pedro Santos Alves (ID: 61578151491865)
🔧 Aplicando 7 cookies, incluindo 3 essenciais:
  - c_user: 61578151491865... (exp: 20/08/2026)
  - xs: 49%3AMqnJQmd_vanmvQ... (exp: 20/08/2026)
  - datr: kfphaPIIU0DNs9... (exp: 15/08/2026)
✅ 7 cookies aplicados, 3 essenciais confirmados
✅ User Agent aplicado: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
```

## ⚠️ Avisos Importantes

1. **Sempre use `--auto-extension`** - Sem ele, a automação tentará funcionar sem dados de sessão
2. **Sessões expiram** - Se os cookies expirarem, será necessário recapturar via extensão
3. **Um usuário por vez** - A automação funciona com uma conta por sessão
4. **Backup automático** - O sistema faz backup das sessões com timestamp

## 📝 Exemplos de Uso

### Execução Básica
```bash
# Usar sessão da extensão com flow padrão
npx tsx src/cli.ts --auto-extension
```

### Com Arquivo de Flow Específico
```bash
# Usar sessão da extensão com flow personalizado
npx tsx src/cli.ts --auto-extension --flow meu-produto.json
```

### Debug Completo
```bash
# Ver todos os logs do processo
npx tsx src/cli.ts --auto-extension --debug --verbose
```

### Apenas Seleção de Grupos
```bash
# Assumindo anúncio já criado, apenas selecionar grupos
npx tsx src/cli.ts --auto-extension --groups-only --groups grupos.txt
```

## 🎯 Resumo Rápido

**✅ Comando Correto:**
```bash
npx tsx src/cli.ts --auto-extension
```

**❌ Comandos Incorretos:**
```bash
npx tsx src/cli.ts                    # Sem sessão da extensão
npx tsx src/cli.ts --extension-session # Parâmetro errado
npm start                             # Pode não carregar sessão
```

## 🔗 Links Relacionados

- [Configuração da Extensão](./extensao-chrome.md)
- [Estrutura de Flows](./flows.md)
- [Troubleshooting Geral](./troubleshooting.md)