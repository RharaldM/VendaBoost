# Facebook Marketplace Playwright Recorder

Projeto para gravação automatizada de ações no Facebook Marketplace usando Playwright Codegen com overlay visual e seletores robustos.

## 🚀 Setup Inicial

### 1. Instalar Dependências

```bash
# Instalar dependências do Node.js e Playwright
npm run install:deps
```

### 2. Comandos por Sistema Operacional

#### Windows PowerShell
```powershell
# Gravar ações no Marketplace (primeira vez)
npm run record:marketplace

# Continuar gravação com sessão salva
npm run record:marketplace:continue

# Executar teste com Inspector
npm run test:marketplace
```

#### Windows CMD
```cmd
# Gravar ações no Marketplace
npx playwright codegen --target=typescript --lang=pt-BR --color-scheme=dark --save-storage=auth.json --output=tests/marketplace.recorder.spec.ts https://www.facebook.com/marketplace/

# Executar teste com Inspector
npm run test:marketplace:cmd
```

#### macOS/Linux
```bash
# Gravar ações no Marketplace
npx playwright codegen --target=typescript --lang=pt-BR --color-scheme=dark --save-storage=auth.json --output=tests/marketplace.recorder.spec.ts https://www.facebook.com/marketplace/

# Executar teste com Inspector
npm run test:marketplace:unix
```

## 📋 Fluxo de Trabalho

### Quando disser "GRAVAR":
1. Execute: `npm run record:marketplace`
2. O Chromium abrirá com overlay vermelho
3. Faça login manual no Facebook
4. Navegue até Marketplace
5. Clique em "Criar novo anúncio" → "Vender item"
6. Preencha campos (Título, Preço, Categoria, Localização)
7. **NÃO PUBLIQUE** - pare antes do botão final

### Quando disser "PARAR":
1. Feche a janela do Codegen
2. O arquivo `tests/marketplace.recorder.spec.ts` será salvo automaticamente
3. A sessão será salva em `auth.json`

### Quando disser "REFAZER":
1. Execute: `npm run record:marketplace:continue` (usa sessão salva)
2. Ou delete `auth.json` e execute `npm run record:marketplace`

## 🎯 Seletores Robustos Recomendados

```typescript
// ✅ BONS - Baseados em acessibilidade
page.getByRole('button', { name: /anunciar|vender|publicar/i })
page.getByLabel('Título do anúncio')
page.getByPlaceholder('Preço')
page.getByText('Criar novo anúncio')
locator.filter({ hasText: /texto/i })

// ❌ EVITAR - CSS frágil
page.locator('.x1234567')
page.locator('#specific-id')
```

## 🔧 Configurações

- **Headless**: `false` (modo visual)
- **Locale**: `pt-BR`
- **Viewport**: `1366x900`
- **Timeout**: `30s` para ações, `60s` para navegação
- **Trace**: Salvo apenas em falhas
- **Storage State**: `auth.json` para reutilizar login

## 📁 Estrutura de Arquivos

```
screen-recorder/
├── package.json          # Scripts e dependências
├── playwright.config.ts  # Configuração do Playwright
├── auth.json            # Sessão salva (criado após login)
├── tests/
│   └── marketplace.recorder.spec.ts  # Teste gravado
└── test-results/        # Relatórios e traces
```

## 🛡️ Dicas de Robustez

1. **Aguardar carregamento**:
   ```typescript
   await page.waitForLoadState('networkidle');
   await page.waitForTimeout(3000); // Para elementos dinâmicos
   ```

2. **Listas dinâmicas**:
   ```typescript
   const firstItem = page.getByRole('listitem').first();
   ```

3. **Timeouts personalizados**:
   ```typescript
   await expect(element).toBeVisible({ timeout: 15000 });
   ```

4. **Filtros específicos**:
   ```typescript
   page.getByRole('button').filter({ hasText: /criar/i })
   ```

## ⚠️ Importante

- **NÃO** publique anúncios reais durante a gravação
- **NÃO** compartilhe credenciais no código
- Use apenas recursos nativos do Playwright
- Respeite os Termos de Serviço do Facebook
- O arquivo `auth.json` contém dados sensíveis - não commite no Git

## 🐛 Troubleshooting

### Erro de autenticação:
```bash
# Delete a sessão e grave novamente
rm auth.json
npm run record:marketplace
```

### Elementos não encontrados:
- Verifique se a página carregou completamente
- Use seletores mais específicos
- Adicione `waitForTimeout` se necessário

### Teste falhando:
```bash
# Execute com debug visual
npm run test:marketplace
```