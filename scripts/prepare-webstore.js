#!/usr/bin/env node

/**
 * 🚀 Script de Preparação para Chrome Web Store
 * Automatiza a criação de todos os arquivos necessários para submissão
 */

import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WebStorePreparator {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.distPath = path.join(this.projectRoot, 'dist');
        this.webstorePath = path.join(this.projectRoot, 'webstore-package');
        this.assetsPath = path.join(this.webstorePath, 'store-assets');
        
        console.log('🎯 Iniciando preparação para Chrome Web Store...');
    }

    async prepare() {
        try {
            // 1. Limpar e criar diretórios
            await this.setupDirectories();
            
            // 2. Copiar arquivos da extensão
            await this.copyExtensionFiles();
            
            // 3. Validar manifest.json
            await this.validateManifest();
            
            // 4. Gerar arquivos de store
            await this.generateStoreAssets();
            
            // 5. Criar política de privacidade
            await this.createPrivacyPolicy();
            
            // 6. Gerar documentação
            await this.generateDocumentation();
            
            // 7. Criar ZIP final
            await this.createWebStoreZip();
            
            console.log('\n✅ Preparação concluída com sucesso!');
            console.log(`📁 Arquivos em: ${this.webstorePath}`);
            console.log(`📦 ZIP pronto: ${path.join(this.webstorePath, 'VendaBoost-WebStore.zip')}`);
            
        } catch (error) {
            console.error('❌ Erro na preparação:', error);
            process.exit(1);
        }
    }

    async setupDirectories() {
        console.log('📁 Configurando diretórios...');
        
        // Limpar diretório anterior
        if (await fs.pathExists(this.webstorePath)) {
            await fs.remove(this.webstorePath);
        }
        
        // Criar estrutura
        await fs.ensureDir(this.webstorePath);
        await fs.ensureDir(this.assetsPath);
        await fs.ensureDir(path.join(this.assetsPath, 'screenshots'));
        await fs.ensureDir(path.join(this.assetsPath, 'icons'));
    }

    async copyExtensionFiles() {
        console.log('📋 Copiando arquivos da extensão...');
        
        const extensionFiles = [
            'manifest.json',
            'popup.html',
            'popup.js', 
            'popup.css',
            'background.js',
            'content.js',
            'auth-styles.css'
        ];

        // Copiar arquivos principais
        for (const file of extensionFiles) {
            const srcPath = path.join(this.distPath, file);
            const destPath = path.join(this.webstorePath, file);
            
            if (await fs.pathExists(srcPath)) {
                await fs.copy(srcPath, destPath);
                console.log(`  ✓ ${file}`);
            } else {
                console.warn(`  ⚠️  ${file} não encontrado`);
            }
        }

        // Copiar pastas
        const folders = ['icons', 'chunks'];
        for (const folder of folders) {
            const srcPath = path.join(this.distPath, folder);
            const destPath = path.join(this.webstorePath, folder);
            
            if (await fs.pathExists(srcPath)) {
                await fs.copy(srcPath, destPath);
                console.log(`  ✓ ${folder}/`);
            }
        }
    }

    async validateManifest() {
        console.log('🔍 Validando e limpando manifest.json para produção...');
        
        const manifestPath = path.join(this.webstorePath, 'manifest.json');
        const manifest = await fs.readJson(manifestPath);
        
        // Validações obrigatórias
        const requiredFields = ['name', 'version', 'description', 'manifest_version'];
        const missing = requiredFields.filter(field => !manifest[field]);
        
        if (missing.length > 0) {
            throw new Error(`Campos obrigatórios ausentes no manifest: ${missing.join(', ')}`);
        }

        // ⚠️ LIMPEZA PARA PRODUÇÃO: Remover URLs localhost
        console.log('  🧹 Removendo URLs localhost para Chrome Web Store...');
        
        // Remover localhost de host_permissions
        if (manifest.host_permissions) {
            manifest.host_permissions = manifest.host_permissions.filter(
                permission => !permission.includes('localhost')
            );
            console.log('    ✓ Localhost removido de host_permissions');
        }

        // Remover localhost do Content Security Policy
        if (manifest.content_security_policy?.extension_pages) {
            manifest.content_security_policy.extension_pages = 
                manifest.content_security_policy.extension_pages.replace(
                    /\s*http:\/\/localhost:\*\*?/g, ''
                );
            console.log('    ✓ Localhost removido do CSP');
        }

        // Salvar manifest limpo
        await fs.writeJson(manifestPath, manifest, { spaces: 2 });

        // Verificar ícones
        if (!manifest.icons || !manifest.icons['128']) {
            console.warn('  ⚠️  Ícone 128x128 ausente - necessário para Web Store');
        }

        console.log(`  ✅ Manifest limpo e válido - ${manifest.name} v${manifest.version}`);
        return manifest;
    }

    async generateStoreAssets() {
        console.log('🎨 Gerando assets para Web Store...');
        
        // Criar descrição detalhada
        const storeDescription = {
            shortDescription: "Automatize suas vendas no Facebook Marketplace com agendamento inteligente",
            
            fullDescription: `🚀 VendaBoost - Automatização Inteligente para Facebook Marketplace

★ RECURSOS PRINCIPAIS:
• 📅 Agendamento automático de postagens
• 🎯 Gerenciamento de grupos do Facebook
• 📊 Analytics e estatísticas de vendas  
• 🔐 Sistema de login seguro
• 🖼️ Upload múltiplo de imagens
• ⚡ Interface moderna e intuitiva

★ COMO FUNCIONA:
1. Conecte-se com sua conta
2. Configure seus produtos e grupos
3. Agende suas postagens
4. Acompanhe resultados em tempo real

★ BENEFÍCIOS:
• Economize tempo nas suas vendas
• Alcance mais grupos simultaneamente
• Mantenha consistência nas postagens
• Aumente suas vendas online

★ SEGURANÇA:
• Criptografia de dados
• Login seguro
• Conformidade com políticas do Facebook
• Sem armazenamento de senhas

Ideal para empreendedores, revendedores e vendedores que querem otimizar suas vendas no Facebook Marketplace.`,

            features: [
                "Agendamento automático de posts",
                "Gerenciamento de grupos",
                "Upload múltiplo de imagens", 
                "Sistema de autenticação seguro",
                "Interface responsiva",
                "Analytics de vendas"
            ]
        };

        await fs.writeJson(
            path.join(this.assetsPath, 'store-description.json'), 
            storeDescription, 
            { spaces: 2 }
        );

        // Criar instruções de uso
        const instructions = `# 📖 Instruções de Uso - VendaBoost

## 🚀 Primeiros Passos

1. **Instalação**
   - Instale a extensão da Chrome Web Store
   - Clique no ícone VendaBoost na barra do navegador

2. **Login**
   - Faça login com suas credenciais
   - Crie uma conta se for novo usuário

3. **Configuração**
   - Acesse a aba "Grupos" 
   - Escaneie os grupos do Facebook
   - Selecione os grupos desejados

4. **Criação de Posts**
   - Vá para "Criar Post"
   - Adicione título, descrição e imagens
   - Selecione grupos de destino
   - Agende horário de publicação

5. **Monitoramento**
   - Acompanhe posts na aba "Agendados"
   - Visualize estatísticas na aba "Database"

## ⚙️ Configurações Avançadas

- **Intervalo entre posts:** Configure o tempo entre publicações
- **Tentativas de retry:** Defina quantas tentativas em caso de erro
- **Notificações:** Ative/desative alertas de status

## 🔒 Segurança

- Todos os dados são criptografados
- Login seguro com tokens JWT
- Conformidade com políticas do Facebook
`;

        await fs.writeFile(
            path.join(this.assetsPath, 'instructions.md'), 
            instructions
        );

        console.log('  ✓ Descrições da store criadas');
        console.log('  ✓ Instruções de uso geradas');
    }

    async createPrivacyPolicy() {
        console.log('📜 Criando política de privacidade...');
        
        const privacyPolicy = `# Política de Privacidade - VendaBoost

**Última atualização:** ${new Date().toLocaleDateString('pt-BR')}

## 1. Informações Coletadas

A extensão VendaBoost coleta apenas as informações necessárias para seu funcionamento:

### 1.1 Dados de Autenticação
- Nome de usuário e email para login
- Tokens de sessão (armazenados localmente)

### 1.2 Dados de Uso
- Posts agendados (armazenados localmente)
- Configurações da extensão
- Grupos do Facebook selecionados

## 2. Como Utilizamos os Dados

### 2.1 Propósito
- Autenticação segura do usuário
- Funcionamento do agendamento de posts
- Melhoria da experiência do usuário

### 2.2 Armazenamento
- Dados armazenados localmente no navegador
- Backup seguro no servidor (criptografado)
- Não compartilhamos dados com terceiros

## 3. Segurança

### 3.1 Proteção de Dados
- Criptografia de dados sensíveis
- Conexões HTTPS seguras
- Tokens de sessão com expiração

### 3.2 Acesso aos Dados
- Apenas você tem acesso aos seus dados
- Não vendemos ou compartilhamos informações
- Conformidade com LGPD e GDPR

## 4. Permissões da Extensão

### 4.1 Permissões Necessárias
- **storage:** Salvar configurações localmente
- **tabs:** Interagir com páginas do Facebook
- **activeTab:** Acessar conteúdo da aba ativa
- **scripting:** Executar scripts nas páginas

### 4.2 Uso das Permissões
- Utilizadas apenas para funcionalidades declaradas
- Não coletamos dados desnecessários
- Acesso limitado ao Facebook Marketplace

## 5. Seus Direitos

### 5.1 Controle de Dados
- Deletar conta e dados a qualquer momento
- Exportar seus dados
- Desativar recursos específicos

### 5.2 Transparência
- Código auditável
- Relatórios de segurança disponíveis
- Suporte técnico responsivo

## 6. Contato

Para dúvidas sobre privacidade:
- Email: privacy@vendaboost.com
- Suporte: suporte@vendaboost.com

## 7. Alterações na Política

- Notificações sobre mudanças importantes
- Histórico de versões disponível
- Aceitação necessária para mudanças significativas

Esta política está em conformidade com:
- Lei Geral de Proteção de Dados (LGPD)
- General Data Protection Regulation (GDPR)
- Políticas do Google Chrome Web Store
`;

        await fs.writeFile(
            path.join(this.assetsPath, 'privacy-policy.md'), 
            privacyPolicy
        );

        console.log('  ✓ Política de privacidade criada');
    }

    async generateDocumentation() {
        console.log('📚 Gerando documentação...');
        
        const webstoreGuide = `# 🌐 Guia de Submissão - Chrome Web Store

## 📋 Checklist Pré-Submissão

### ✅ Arquivos Obrigatórios
- [x] manifest.json válido
- [x] Ícones 16x16, 48x48, 128x128
- [x] Política de privacidade
- [x] Screenshots (pelo menos 1)
- [x] Descrição completa

### ✅ Informações da Store
- **Nome:** VendaBoost
- **Categoria:** Productivity  
- **Linguagem:** Portuguese (Brazil)
- **Preço:** Gratuito
- **Público:** +13 anos

### ✅ Materiais Visuais Necessários
- **Screenshots:** 1280x800 ou 640x400 (pelo menos 1)
- **Ícone da Store:** 128x128 PNG
- **Tile Pequeno:** 440x280 PNG (opcional)
- **Tile Marquee:** 1400x560 PNG (opcional)

## 🚀 Processo de Submissão

1. **Conta de Desenvolvedor**
   - Pague taxa única de $5 USD
   - Acesse: https://chrome.google.com/webstore/devconsole

2. **Upload da Extensão**
   - Use o arquivo: VendaBoost-WebStore.zip
   - Aguarde validação automática

3. **Configuração da Listagem**
   - Copie descrição de: store-description.json
   - Adicione screenshots da pasta screenshots/
   - Configure categoria como "Productivity"

4. **Revisão**
   - Processo leva 1-7 dias úteis
   - Possíveis solicitações de esclarecimento
   - Publicação após aprovação

## ⚠️ Pontos de Atenção

### Políticas do Chrome
- Extensão acessa Facebook - justificar permissões
- Não fazer scraping excessivo
- Respeitar rate limits da plataforma

### Possíveis Rejeições
- Ícones de baixa qualidade
- Descrição inadequada
- Falta de política de privacidade
- Permissões desnecessárias

## 📞 Suporte
- Documentação: https://developer.chrome.com/webstore
- Políticas: https://developer.chrome.com/webstore/program_policies
`;

        await fs.writeFile(
            path.join(this.assetsPath, 'webstore-submission-guide.md'), 
            webstoreGuide
        );

        // Criar README para o pacote
        const packageReadme = `# 📦 VendaBoost - Pacote Web Store

Este pacote contém todos os arquivos necessários para submissão à Chrome Web Store.

## 📁 Estrutura do Pacote

\`\`\`
webstore-package/
├── VendaBoost-WebStore.zip     # Arquivo para upload
├── manifest.json               # Manifest da extensão  
├── popup.html                  # Interface principal
├── popup.js                    # Lógica da extensão
├── background.js               # Service worker
├── content.js                  # Content script
├── icons/                      # Ícones da extensão
└── store-assets/               # Materiais para Web Store
    ├── privacy-policy.md       # Política de privacidade
    ├── store-description.json  # Descrições para store
    ├── instructions.md         # Manual do usuário
    └── webstore-submission-guide.md
\`\`\`

## 🚀 Próximos Passos

1. Acesse: https://chrome.google.com/webstore/devconsole
2. Faça upload do arquivo VendaBoost-WebStore.zip
3. Configure listagem usando store-description.json
4. Adicione política de privacidade
5. Aguarde aprovação (1-7 dias)

## 📊 Informações da Extensão

- **Nome:** VendaBoost
- **Versão:** ${(await fs.readJson(path.join(this.webstorePath, 'manifest.json'))).version}
- **Categoria:** Productivity
- **Público:** Empreendedores e vendedores online
`;

        await fs.writeFile(
            path.join(this.webstorePath, 'README.md'), 
            packageReadme
        );

        console.log('  ✓ Guia de submissão criado');
        console.log('  ✓ README do pacote gerado');
    }

    async createWebStoreZip() {
        console.log('📦 Criando ZIP limpo para Chrome Web Store...');
        
        const zipPath = path.join(this.webstorePath, 'VendaBoost-WebStore-Production.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                const sizeKB = Math.round(archive.pointer() / 1024);
                console.log(`  ✅ ZIP LIMPO criado: ${sizeKB} KB`);
                console.log(`  📁 Arquivo: VendaBoost-WebStore-Production.zip`);
                console.log(`  🚀 Pronto para upload na Chrome Web Store!`);
                resolve();
            });

            archive.on('error', reject);
            archive.pipe(output);

            // Adicionar apenas arquivos da extensão (não assets)
            const filesToZip = [
                'manifest.json',      // ✅ Já limpo sem localhost
                'popup.html', 
                'popup.js',
                'popup.css',
                'background.js',
                'content.js',
                'auth-styles.css'
            ];

            filesToZip.forEach(file => {
                const filePath = path.join(this.webstorePath, file);
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: file });
                    console.log(`    ✓ ${file} adicionado`);
                }
            });

            // Adicionar pastas
            const iconsPath = path.join(this.webstorePath, 'icons');
            if (fs.existsSync(iconsPath)) {
                archive.directory(iconsPath, 'icons');
                console.log(`    ✓ icons/ adicionado`);
            }
            
            const chunksPath = path.join(this.webstorePath, 'chunks');
            if (fs.existsSync(chunksPath)) {
                archive.directory(chunksPath, 'chunks');
                console.log(`    ✓ chunks/ adicionado`);
            }

            archive.finalize();
        });
    }
}

// Executar se chamado diretamente  
const preparator = new WebStorePreparator();
preparator.prepare();

export default WebStorePreparator;