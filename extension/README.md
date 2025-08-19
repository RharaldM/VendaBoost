# VendaBoost Cookie Extractor

Extensão Chrome para extrair cookies e informações de sessão do Facebook para uso com o sistema de automação VendaBoost Desktop.

## 📋 Funcionalidades

- ✅ Extração automática de cookies do Facebook
- ✅ Captura de informações de sessão (localStorage, sessionStorage)
- ✅ Verificação de status de login
- ✅ Exportação de dados em formato JSON
- ✅ Interface amigável com popup
- ✅ Armazenamento seguro de dados extraídos

## 🚀 Instalação

### 1. Preparar a Extensão
1. Certifique-se de que todos os arquivos estão na pasta `extension/`
2. Verifique se o `manifest.json` está configurado corretamente

### 2. Instalar no Chrome
1. Abra o Chrome e vá para `chrome://extensions/`
2. Ative o "Modo do desenvolvedor" no canto superior direito
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `extension/` deste projeto
5. A extensão será instalada e aparecerá na barra de ferramentas

## 📖 Como Usar

### 1. Fazer Login no Facebook
1. Navegue para `https://facebook.com`
2. Faça login normalmente com suas credenciais
3. Certifique-se de estar completamente logado

### 2. Extrair Dados de Sessão
1. Clique no ícone da extensão VendaBoost na barra de ferramentas
2. O popup mostrará o status do login
3. Clique em "Extrair Dados de Sessão"
4. Aguarde a confirmação de sucesso

### 3. Exportar para VendaBoost
1. Após extrair os dados, clique em "Exportar para VendaBoost"
2. Escolha onde salvar o arquivo JSON
3. O arquivo será baixado com nome `vendaboost-session-YYYY-MM-DD.json`

### 4. Usar com a Automação

Você pode usar os dados exportados de duas formas:

#### Opção 1: Arquivo Específico
```bash
vendaboost --flow flow.json --extension-session caminho/para/vendaboost-session-2024-01-20.json
```

#### Opção 2: Busca Automática (Recomendado)
```bash
vendaboost --flow flow.json --auto-extension
```

A opção `--auto-extension` busca automaticamente pelo arquivo de sessão mais recente na pasta de downloads, facilitando o uso diário.

#### Exemplos Completos
```bash
# Executar automação completa com extensão
vendaboost --flow flow.json --auto-extension

# Apenas seleção de grupos com dados da extensão
vendaboost --flow flow.json --groups-only --auto-extension

# Apenas criação de anúncio com dados da extensão
vendaboost --flow flow.json --listing-only --extension-session session.json
```

## 📁 Estrutura de Arquivos

```
extension/
├── manifest.json          # Configuração da extensão
├── content.js            # Script de conteúdo para extração
├── background.js         # Script de background para gerenciamento
├── popup.html           # Interface do popup
├── popup.js             # Lógica do popup
├── icon16.svg           # Ícone 16x16
├── icon48.svg           # Ícone 48x48
├── icon128.svg          # Ícone 128x128
└── README.md            # Este arquivo
```

## 🔒 Segurança e Privacidade

- ✅ A extensão só funciona em páginas do Facebook
- ✅ Dados são armazenados localmente no navegador
- ✅ Nenhum dado é enviado para servidores externos
- ✅ Cookies são extraídos apenas quando solicitado
- ✅ Dados podem ser limpos a qualquer momento

## 🛠️ Dados Extraídos

A extensão extrai as seguintes informações:

### Cookies Importantes
- `c_user` - ID do usuário
- `xs` - Token de sessão
- `fr` - Token de autenticação
- `sb` - Token de segurança
- `datr` - Token de dispositivo
- `wd` - Configurações de janela
- `dpr` - Densidade de pixels
- `locale` - Configuração de idioma

### Informações de Sessão
- User Agent do navegador
- Local Storage do Facebook
- Session Storage do Facebook
- Informações do usuário (nome e ID)
- Timestamp da extração

## 🔧 Solução de Problemas

### Extensão não aparece
- Verifique se o modo desenvolvedor está ativado
- Recarregue a extensão em `chrome://extensions/`

### Não consegue extrair dados
- Certifique-se de estar logado no Facebook
- Atualize a página do Facebook
- Verifique se não há bloqueadores de script

### Dados não são exportados
- Verifique as permissões de download do Chrome
- Tente extrair os dados novamente

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique se está usando a versão mais recente
2. Consulte os logs do console do Chrome (F12)
3. Reporte problemas com detalhes específicos

## 🔄 Atualizações

Para atualizar a extensão:
1. Substitua os arquivos na pasta `extension/`
2. Vá para `chrome://extensions/`
3. Clique no botão de recarregar da extensão VendaBoost

---

**⚠️ Aviso Legal**: Esta extensão é para uso pessoal e educacional. Respeite os termos de serviço do Facebook e use responsavelmente.