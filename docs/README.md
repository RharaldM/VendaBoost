# VendaBoost Desktop

Automação para publicação de anúncios no Facebook Marketplace com distribuição para grupos específicos.

## 🚀 Características

- **Automação Completa**: Cria anúncios no Marketplace e distribui para grupos por nome
- **Browser Visível**: Utiliza browser persistente para máxima compatibilidade
- **Seletores Robustos**: Múltiplas estratégias de localização de elementos
- **Suporte Multilíngue**: Funciona em Português, Inglês e Espanhol
- **Duas Fontes de Grupos**: Lista manual ou dados do "Download Your Information" do Facebook
- **CLI Intuitiva**: Interface de linha de comando fácil de usar

## 📋 Pré-requisitos

- **Node.js** 18+ 
- **npm** ou **yarn**
- **Conta do Facebook** com acesso ao Marketplace
- **Windows, macOS ou Linux**

## 🛠️ Instalação

1. **Clone ou baixe o projeto**
```bash
git clone <url-do-repositorio>
cd vendaboost-desktop
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o ambiente**
```bash
# Cria arquivos de exemplo
npm run create-examples

# Ou manualmente:
cp .env.example .env
```

4. **Compile o TypeScript**
```bash
npm run build
```

## ⚙️ Configuração

### 1. Arquivo `.env`
```env
# Diretório para dados do browser (perfil persistente)
USER_DATA_DIR=./user-profile

# URL inicial do Facebook
FB_START_URL=https://www.facebook.com/marketplace/create

# Delay entre ações (ms)
THROTTLE_MS=350

# Modo debug (manter browser aberto)
DEBUG=true

# Nível de log (debug, info, warn, error)
LOG_LEVEL=info
```

### 2. Arquivo `flow.json` (dados do anúncio)
```json
{
  "title": "iPhone 13 Pro Max 256GB",
  "price": 3500,
  "description": "iPhone em excelente estado, sem riscos, bateria 100%. Acompanha carregador original.",
  "category": "Eletrônicos",
  "condition": "Usado - Como novo",
  "images": [
    "C:\\caminho\\para\\foto1.jpg",
    "C:\\caminho\\para\\foto2.jpg"
  ],
  "location": "São Paulo, SP"
}
```

### 3. Arquivo `grupos.txt` (opcional)
```
Compra e Venda São Paulo
Marketplace SP
Eletrônicos Usados
# Linhas com # são comentários
```

## 🎯 Como Usar

### Execução Básica
```bash
# Apenas criar anúncio (sem grupos)
npm start

# Com grupos de arquivo .txt
npm start -- --groups grupos.txt

# Com grupos do DYI (Download Your Information)
npm start -- --dyi ./dyi-data/
```

### Opções Avançadas
```bash
# Modo headless (browser invisível)
npm start -- --headless

# Ajustar delay entre ações
npm start -- --throttle 500

# Modo verboso
npm start -- --verbose

# Modo debug
npm start -- --debug

# Apenas seleção de grupos (anúncio já criado)
npm start -- --groups-only --groups grupos.txt

# Apenas criação do anúncio
npm start -- --listing-only
```

### Criar Arquivos de Exemplo
```bash
npm run create-examples
```

## 📁 Estrutura do Projeto

```
src/
├── config.ts              # Configurações e schemas
├── logger.ts               # Sistema de logs
├── index.ts                # API principal
├── cli.ts                  # Interface de linha de comando
├── session/
│   └── browser.ts          # Gerenciamento do browser
├── facebook/
│   ├── marketplace.ts      # Automação do Marketplace
│   ├── groups.ts           # Seleção de grupos
│   └── assertions.ts       # Verificações de sucesso
└── utils/
    ├── i18n.ts             # Internacionalização
    └── files.ts            # Utilitários de arquivo
```

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Executa em modo desenvolvimento
npm run build        # Compila TypeScript
npm run start        # Executa versão compilada

# Utilitários
npm run create-examples  # Cria arquivos de exemplo
npm run clean           # Limpa arquivos compilados
```

## 📊 Logs e Debug

### Níveis de Log
- **error**: Apenas erros críticos
- **warn**: Avisos e erros
- **info**: Informações gerais (padrão)
- **debug**: Logs detalhados

### Arquivos de Log
Os logs são salvos em:
- `logs/vendaboost.log` - Log geral
- `logs/error.log` - Apenas erros

### Modo Debug
Com `DEBUG=true` ou `--debug`:
- Browser permanece aberto após execução
- Logs detalhados habilitados
- Útil para desenvolvimento e troubleshooting

## 🎭 Playwright e Browser

### Dados Persistentes
O browser utiliza um perfil persistente em `USER_DATA_DIR`, mantendo:
- Login do Facebook
- Cookies e sessões
- Configurações do browser

### Primeiro Uso
1. Execute o comando
2. Browser abrirá automaticamente
3. Faça login no Facebook manualmente
4. A automação continuará após o login

## 📥 Download Your Information (DYI)

Para usar grupos do DYI do Facebook:

1. **Baixe seus dados**:
   - Facebook → Configurações → Suas informações no Facebook
   - Baixar suas informações
   - Selecione "Grupos" e formato JSON

2. **Extraia o arquivo**:
   ```
   dyi-data/
   ├── groups/
   │   └── your_groups.json
   └── outros_arquivos...
   ```

3. **Use na CLI**:
   ```bash
   npm start -- --dyi ./dyi-data/
   ```

## ⚠️ Limitações e Boas Práticas

### Limitações do Facebook
- **Rate Limiting**: Facebook pode limitar ações muito rápidas
- **CAPTCHA**: Pode aparecer em caso de atividade suspeita
- **2FA**: Autenticação de dois fatores deve ser feita manualmente

### Boas Práticas
- **Throttling**: Use delays adequados (350ms+)
- **Grupos Limitados**: Não exceda 50 grupos por execução
- **Horários**: Evite horários de pico
- **Conteúdo**: Siga as políticas do Facebook

### Robustez
- **Múltiplas Estratégias**: Seletores com fallbacks
- **Retry Logic**: Tentativas automáticas em caso de falha
- **Verificação**: Confirmação de publicação bem-sucedida

## 🐛 Troubleshooting

### Problemas Comuns

**Browser não abre**
```bash
# Limpe o perfil do browser
rm -rf ./user-profile
```

**Elementos não encontrados**
```bash
# Execute em modo debug
npm start -- --debug --verbose
```

**Login não detectado**
```bash
# Verifique se está logado no Facebook
# Limpe cookies se necessário
```

**Grupos não encontrados**
```bash
# Verifique nomes exatos dos grupos
# Use modo debug para ver logs detalhados
```

### Logs Detalhados
```bash
# Modo debug completo
DEBUG=true LOG_LEVEL=debug npm start -- --debug --verbose
```

## 🔄 Atualizações

Para atualizar dependências:
```bash
npm update
npm audit fix
```

## 📄 Licença

Este projeto é fornecido como está, para uso educacional e pessoal. Respeite os termos de uso do Facebook.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**⚡ VendaBoost Desktop** - Automação inteligente para Facebook Marketplace