# Guia de Migração - Vendaboost Puppeteer

## Visão Geral da Migração

Este guia detalha o processo de reestruturação do projeto monolítico atual para uma arquitetura modular com backend separado, aplicação desktop Electron e portal web React.

## Estrutura Atual vs Nova Estrutura

### Estrutura Atual

```
Vendaboost-Puppeter/
├── server.js              # Servidor Express monolítico
├── automation.js          # Lógica do Puppeteer
├── index.html            # Interface web básica
├── script.js             # Frontend JavaScript
├── styles.css            # Estilos CSS
├── package.json          # Dependências
└── user-data/            # Dados de sessão
```

### Nova Estrutura

```
marketplace-automation/
├── backend/              # API Backend (Node.js/Express)
├── desktop-app/          # Aplicação Desktop (Electron)
├── web-portal/           # Portal Web (React)
├── docker-compose.yml    # Orquestração
└── shared/               # Código compartilhado
```

## Plano de Migração

### Fase 1: Preparação e Backup

1. **Backup do projeto atual**

   ```bash
   cp -r Vendaboost-Puppeter Vendaboost-Puppeter-backup
   ```

2. **Análise de dependências**

   * Express\@5.1.0

   * Puppeteer\@24.16.1

   * Socket.IO\@4.8.1

   * Body-parser\@2.2.0

   * Dotenv\@17.2.1

3. **Identificação de funcionalidades**

   * Sistema de logs em tempo real

   * Automação do Facebook Marketplace

   * Interface web básica

   * Persistência de sessão

   * API REST para agendamento

### Fase 2: Criação da Estrutura Backend

1. **Criar diretório backend**

   ```bash
   mkdir -p marketplace-automation/backend/src/{controllers,models,routes,services,middleware,utils}
   mkdir -p marketplace-automation/backend/{data,uploads,user-data}
   ```

2. **Migrar server.js para backend/src/app.js**

   * Extrair configuração do Express

   * Separar rotas em arquivos específicos

   * Modularizar sistema de logs

   * Configurar middleware CORS

3. **Migrar automation.js para backend/src/services/puppeteerService.js**

   * Refatorar como serviço

   * Adicionar tratamento de erros

   * Implementar padrão singleton para browser

   * Adicionar configurações flexíveis

4. **Criar estrutura de dados**

   * publications.json para histórico

   * logs.json para persistência de logs

   * session.json para dados de sessão

### Fase 3: Desenvolvimento do Portal Web React

1. **Inicializar projeto React**

   ```bash
   cd marketplace-automation
   npm create vite@latest web-portal -- --template react
   cd web-portal
   npm install axios socket.io-client @tailwindcss/forms
   ```

2. **Migrar interface atual**

   * Converter index.html para componentes React

   * Migrar script.js para hooks e services

   * Converter styles.css para TailwindCSS

   * Implementar roteamento com React Router

3. **Implementar funcionalidades**

   * Dashboard com estatísticas

   * Formulário de agendamento

   * Visualizador de logs em tempo real

   * Histórico de publicações

### Fase 4: Desenvolvimento da Aplicação Desktop

1. **Inicializar projeto Electron**

   ```bash
   mkdir desktop-app
   cd desktop-app
   npm init -y
   npm install electron electron-builder
   npm install react react-dom @vitejs/plugin-react
   ```

2. **Configurar Electron**

   * main.js para processo principal

   * Integração com Puppeteer local

   * Menu nativo e system tray

   * Auto-updater

3. **Reutilizar componentes React**

   * Compartilhar componentes com web-portal

   * Adaptar para interface desktop

   * Adicionar funcionalidades específicas

### Fase 5: Containerização com Docker

1. **Criar Dockerfiles**

   * backend/Dockerfile

   * web-portal/Dockerfile

   * docker-compose.yml para orquestração

2. **Configurar volumes**

   * Persistência de dados

   * Uploads de imagens

   * Logs e sessões

## Mapeamento de Código

### server.js → Múltiplos Arquivos

**LogManager Class**

```javascript
// Atual: server.js (linhas 18-50)
// Novo: backend/src/services/logService.js
class LogService {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }
  // ... métodos migrados
}
```

**Express Routes**

```javascript
// Atual: server.js (linhas 80-150)
// Novo: backend/src/routes/publications.js
const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');

router.post('/schedule-item', publicationController.scheduleItem);
router.get('/health', publicationController.health);

module.exports = router;
```

**Socket.IO Configuration**

```javascript
// Atual: server.js (linhas 51-79)
// Novo: backend/src/services/socketService.js
class SocketService {
  constructor(server) {
    this.io = new Server(server, { /* config */ });
    this.setupEventHandlers();
  }
  // ... métodos migrados
}
```

### automation.js → puppeteerService.js

```javascript
// Atual: automation.js (função postMarketplaceItem)
// Novo: backend/src/services/puppeteerService.js
class PuppeteerService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async postMarketplaceItem(itemData) {
    // Lógica migrada com melhorias
  }

  async initBrowser() {
    // Configuração do navegador
  }

  async closeBrowser() {
    // Limpeza de recursos
  }
}
```

### Frontend HTML/CSS/JS → React Components

**index.html → App.jsx**

```jsx
// Atual: index.html (estrutura estática)
// Novo: web-portal/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Logs from './pages/Logs';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**script.js → React Hooks**

```jsx
// Atual: script.js (lógica de formulário)
// Novo: web-portal/src/pages/Schedule.jsx
import { useState } from 'react';
import { useApi } from '../hooks/useApi';

function Schedule() {
  const [formData, setFormData] = useState({});
  const { scheduleItem, loading } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await scheduleItem(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Formulário React */}
    </form>
  );
}
```

## Checklist de Migração

### Backend

* [ ] Criar estrutura de pastas

* [ ] Migrar server.js para app.js modular

* [ ] Extrair LogManager para logService.js

* [ ] Migrar automation.js para puppeteerService.js

* [ ] Criar controllers para rotas

* [ ] Implementar models para dados

* [ ] Configurar middleware de erro

* [ ] Adicionar validação de dados

* [ ] Configurar CORS adequadamente

* [ ] Testar todas as rotas

### Web Portal

* [ ] Inicializar projeto React com Vite

* [ ] Configurar TailwindCSS

* [ ] Migrar HTML para componentes

* [ ] Implementar roteamento

* [ ] Criar serviço de API

* [ ] Implementar Socket.IO client

* [ ] Migrar formulários

* [ ] Adicionar validação frontend

* [ ] Implementar dashboard

* [ ] Testar responsividade

### Desktop App

* [ ] Configurar Electron

* [ ] Criar processo principal

* [ ] Integrar React renderer

* [ ] Configurar Puppeteer local

* [ ] Implementar menu nativo

* [ ] Adicionar system tray

* [ ] Configurar auto-updater

* [ ] Testar build e distribuição

### Docker

* [ ] Criar Dockerfile para backend

* [ ] Criar Dockerfile para web-portal

* [ ] Configurar docker-compose.yml

* [ ] Configurar volumes persistentes

* [ ] Testar orquestração

* [ ] Documentar deploy

### Testes

* [ ] Testar migração de dados

* [ ] Validar funcionalidades existentes

* [ ] Testar integração entre serviços

* [ ] Verificar logs em tempo real

* [ ] Testar automação do Puppeteer

* [ ] Validar persistência de sessão

## Comandos de Migração

### 1. Backup e Preparação

```bash
# Backup do projeto atual
cp -r . ../Vendaboost-Puppeter-backup

# Criar nova estrutura
mkdir marketplace-automation
cd marketplace-automation
```

### 2. Setup Backend

```bash
mkdir -p backend/src/{controllers,models,routes,services,middleware,utils}
mkdir -p backend/{data,uploads,user-data}
cd backend
npm init -y
npm install express socket.io puppeteer dotenv body-parser cors
```

### 3. Setup Web Portal

```bash
cd ..
npm create vite@latest web-portal -- --template react
cd web-portal
npm install axios socket.io-client react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 4. Setup Desktop App

```bash
cd ..
mkdir desktop-app
cd desktop-app
npm init -y
npm install electron electron-builder
npm install react react-dom @vitejs/plugin-react
```

### 5. Docker Setup

```bash
cd ..
# Criar docker-compose.yml
# Criar Dockerfiles para cada serviço
docker-compose up --build
```

## Considerações Importantes

1. **Preservação de Dados**: Migrar dados de sessão e logs existentes
2. **Compatibilidade**: Manter APIs compatíveis durante transição
3. **Testes**: Validar cada funcionalidade após migração
4. **Performance**: Otimizar comunicação entre serviços
5. **Segurança**: Implementar autenticação adequada
6. **Monitoramento**: Manter sistema de logs robusto

## Próximos Passos

Após completar a migração:

1. Implementar testes automatizados
2. Configurar CI/CD pipeline
3. Adicionar monitoramento de performance
4. Implementar sistema de backup
5. Documentar APIs com Swagger
6. Criar guia de deployment

