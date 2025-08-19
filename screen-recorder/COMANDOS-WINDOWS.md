# 🚀 Guia Rápido - Windows PowerShell

## Setup Inicial (Execute UMA VEZ)

```powershell
# 1. Navegar para a pasta
cd "C:\Users\Hardd\Documents\AUTOMACAO\screen-recorder"

# 2. Instalar dependências
npm install

# 3. Instalar Chromium do Playwright
npx playwright install chromium

# 4. Instalar dependências do sistema (se necessário)
npx playwright install-deps
```

## 📹 Comandos de Gravação

### Quando você disser "GRAVAR":
```powershell
# Primeira gravação (sem sessão salva)
npm run record:marketplace
```

**O que vai acontecer:**
1. ✅ Chromium abre com overlay VERMELHO
2. ✅ Botão "Record" aparece no canto
3. ✅ Elementos ficam destacados quando você passa o mouse
4. ✅ Código TypeScript é gerado em tempo real
5. ✅ Você faz login manual no Facebook
6. ✅ Navega para Marketplace
7. ✅ Clica em "Criar novo anúncio"
8. ✅ Preenche campos (NÃO PUBLICA!)

### Continuar gravação (com sessão salva):
```powershell
# Se já fez login antes
npm run record:marketplace:continue
```

### Quando você disser "PARAR":
1. ❌ Feche a janela do Chromium
2. ✅ Arquivo salvo automaticamente em: `tests/marketplace.recorder.spec.ts`
3. ✅ Sessão salva em: `auth.json`

## 🧪 Comandos de Teste

### Executar teste com Inspector Visual:
```powershell
# Modo debug com pausa em cada passo
npm run test:marketplace
```

### Executar teste normal:
```powershell
# Sem debug
npx playwright test tests/marketplace.recorder.spec.ts
```

## 🔄 Comandos de "REFAZER"

### Regravar tudo do zero:
```powershell
# Deletar sessão e começar novamente
Remove-Item auth.json -ErrorAction SilentlyContinue
npm run record:marketplace
```

### Regravar só um trecho:
```powershell
# Usar sessão existente
npm run record:marketplace:continue
```

## 📋 Checklist de Gravação

### ✅ Antes de gravar:
- [ ] Facebook aberto em outra aba (para verificar se está logado)
- [ ] Decidir que ações vai gravar (ex: criar anúncio, buscar produto)
- [ ] Preparar dados de teste (título, preço, categoria)

### ✅ Durante a gravação:
- [ ] Aguardar elementos carregarem (3-5 segundos)
- [ ] Clicar devagar e com precisão
- [ ] Verificar se o código está sendo gerado no painel
- [ ] NÃO publicar anúncios reais

### ✅ Após gravar:
- [ ] Verificar arquivo `tests/marketplace.recorder.spec.ts`
- [ ] Verificar arquivo `auth.json` foi criado
- [ ] Testar execução com `npm run test:marketplace`

## 🎯 Seletores que o Playwright vai gerar

### ✅ BONS (o que esperamos):
```typescript
page.getByRole('button', { name: 'Criar novo anúncio' })
page.getByLabel('Título')
page.getByPlaceholder('Preço')
page.getByText('Vender item')
```

### ❌ RUINS (que vamos refatorar):
```typescript
page.locator('.x1234567')
page.locator('div:nth-child(3)')
page.locator('#fb-root > div > div')
```

## 🚨 Troubleshooting

### Erro: "Chromium not found"
```powershell
npx playwright install chromium
```

### Erro: "Cannot find module @playwright/test"
```powershell
npm install
```

### Erro: "Page not found" ou elementos não carregam
```powershell
# Aguardar mais tempo, Facebook é lento
# Verificar se está logado
# Tentar novamente
```

### Sessão expirou
```powershell
Remove-Item auth.json
npm run record:marketplace
```

## 📁 Arquivos Importantes

- `tests/marketplace.recorder.spec.ts` → Seu teste gravado
- `auth.json` → Sessão do Facebook (NÃO COMPARTILHAR)
- `playwright.config.ts` → Configurações
- `package.json` → Scripts e dependências

---

**🎬 PRONTO! Agora é só dizer "GRAVAR" que eu te dou o comando exato!**