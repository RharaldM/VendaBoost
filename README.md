# Vendaboost Puppeteer - Automação Segura do Facebook Marketplace

## ⚠️ IMPORTANTE - Correções de Segurança Implementadas

Este projeto foi **completamente refatorado** para seguir as melhores práticas de segurança e estabilidade.

### 🔒 Mudanças de Segurança

#### ✅ Credenciais Removidas
- **Antes**: Credenciais em texto claro no `.env`
- **Agora**: Login manual obrigatório, sem credenciais armazenadas

#### ✅ 2FA Seguro
- **Antes**: Tentativas de bypass automático do 2FA
- **Agora**: Aguarda resolução manual do 2FA (até 5 minutos)

#### ✅ Sessão Persistente
- **Antes**: Cookies salvos em arquivo JSON (frágil)
- **Agora**: `userDataDir` do Chromium para persistência robusta

#### ✅ Puppeteer Puro
- **Antes**: `puppeteer-extra-plugin-stealth` (zona cinzenta)
- **Agora**: Puppeteer puro com boas práticas

#### ✅ Flags Otimizadas
- **Antes**: User-Agent fixo e muitas flags desnecessárias
- **Agora**: Apenas flags essenciais, UA dinâmico

## 🚀 Como Usar

### 1. Instalação
```bash
npm install
```

### 2. Configuração
```bash
# Copie o .env.example para .env (se necessário)
cp .env.example .env

# Configure as variáveis de ambiente no seu provedor de hospedagem
```

### 3. Primeiro Uso (Login Manual)
```bash
# Execute com headless=false para fazer login manual
HEADLESS=false npm start
```

**IMPORTANTE**: Na primeira execução:
1. O navegador abrirá em modo visível
2. Faça login manualmente no Facebook
3. Complete qualquer verificação 2FA se solicitada
4. A sessão será salva automaticamente em `./user-data/`

### 4. Uso Normal
```bash
# Após o login inicial, pode usar headless
npm start
```

## 📡 API Endpoints

### POST /schedule-item
Agenda publicação de item no Marketplace.

**Body:**
```json
{
  "title": "Título do produto",
  "price": 100.50,
  "description": "Descrição detalhada",
  "photoPath": "/caminho/para/foto.jpg",
  "location": "Cidade, Estado"
}
```

### GET /health
Verifica status do servidor.

## 🏗️ Deploy

### Estratégia Recomendada: Node.js Completo

Use **apenas uma** das opções abaixo:

#### Opção 1: Railway/Render
```bash
# Configure as variáveis no painel
HEADLESS=true
USER_DATA_DIR=/tmp/user-data
PORT=3000
```

#### Opção 2: VPS/Servidor Próprio
```bash
# Configure PM2 ou similar
pm2 start server.js --name vendaboost
```

## 🔧 Variáveis de Ambiente

```bash
# Servidor
PORT=3000
NODE_ENV=production

# Puppeteer
HEADLESS=true                    # false para debug/primeiro login
USER_DATA_DIR=./user-data       # Diretório para sessão persistente

# Deploy
NODE_ENV=development            # production para servidores
```

## 🛡️ Segurança

### ✅ Boas Práticas Implementadas
- ✅ Sem credenciais hardcoded
- ✅ Login manual obrigatório
- ✅ Sessão persistente segura
- ✅ Sem bypass de 2FA
- ✅ Puppeteer puro (sem plugins de stealth)
- ✅ Flags mínimas necessárias
- ✅ .gitignore adequado

### ⚠️ Considerações
- **Login**: Deve ser feito manualmente na primeira execução
- **2FA**: Será solicitado normalmente, sem tentativas de bypass
- **Sessão**: Persistida de forma segura via `userDataDir`
- **Detecção**: Menor risco por usar Puppeteer puro com timing humano

## 📁 Estrutura do Projeto

```
├── server.js           # Servidor Express
├── automation.js       # Lógica do Puppeteer (refatorada)
├── index.html         # Interface web
├── script.js          # Frontend JavaScript
├── styles.css         # Estilos
├── .env               # Configurações (SEM credenciais)
├── .gitignore         # Arquivos ignorados
├── package.json       # Dependências (limpas)
└── user-data/         # Sessão do navegador (ignorado no git)
```

## 🔄 Migração de Versões Antigas

Se você tinha uma versão anterior:

1. **Backup**: Faça backup dos seus dados
2. **Limpe**: Delete `facebook-cookies.json` e `node_modules/`
3. **Instale**: `npm install` (dependências atualizadas)
4. **Configure**: Remova credenciais do `.env`
5. **Login**: Execute com `HEADLESS=false` para login manual

## 📞 Suporte

Para dúvidas sobre segurança ou implementação, consulte:
- Documentação do Puppeteer: https://pptr.dev/
- Boas práticas de automação web
- Políticas do Facebook sobre automação

---

**⚠️ AVISO LEGAL**: Use esta ferramenta de acordo com os Termos de Serviço do Facebook. O uso inadequado pode resultar em suspensão da conta.
