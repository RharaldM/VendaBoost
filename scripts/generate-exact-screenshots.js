/**
 * 📸 Gerador de Screenshots EXATOS (otimizado)
 * Gera templates idênticos à UI da extensão VendaBoost Pro para capturas de tela profissionais
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ExactScreenshotGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.srcPath = path.join(this.projectRoot, "src"); // Corrigido: arquivos estão na raiz, não em /src
        this.screenshotsPath = path.join(this.projectRoot, 'webstore-package', 'store-assets', 'screenshots');
        this.templatesPath = path.join(this.projectRoot, 'screenshot-templates-exact');

        console.log('📸 Iniciando geração de templates EXATOS...');
    }

    async generate() {
        try {
            await this.setupDirectories();

            const originalCSS = await fs.readFile(path.join(this.srcPath, 'popup.css'), 'utf8');
            const authCSS = await fs.readFile(path.join(this.srcPath, 'auth-styles.css'), 'utf8');

            await this.generateCreatePostTemplate(originalCSS, authCSS);
            await this.generateScheduledPostsTemplate(originalCSS, authCSS);
            await this.generateGroupsTemplate(originalCSS, authCSS);
            await this.createExactCaptureGuide();

            console.log('\n✅ Templates gerados com sucesso!');
            console.log('📁 Local:', this.templatesPath);

        } catch (error) {
            console.error('❌ Erro durante a geração:', error);
            process.exit(1);
        }
    }

    async setupDirectories() {
        console.log('📁 Preparando diretórios...');
        await fs.ensureDir(this.screenshotsPath);
        await fs.ensureDir(this.templatesPath);
    }

    injectBaseStyle(originalCSS, authCSS) {
        return `
        ${originalCSS}
        ${authCSS}
        body {
            width: 500px;
            min-height: 600px;
            overflow: visible;
            background: var(--bg-primary, #0f172a);
            font-family: 'Inter', sans-serif;
            padding: 16px;
        }
        html, body {
            margin: 0;
            box-sizing: border-box;
        }
        * {
            box-sizing: inherit;
        }
        .tab-navigation {
            position: sticky;
            top: 0;
            background: var(--bg-primary, #0f172a);
            padding: 8px 0;
            z-index: 10;
        }
        `;
    }

    async generateCreatePostTemplate(originalCSS, authCSS) {
        console.log('🎨 Gerando template: Criar Post...');
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VendaBoost Pro - Criar Post</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>${this.injectBaseStyle(originalCSS, authCSS)}</style>
</head>
<body>
    <div class="header">
        <h1 class="brand-title">VendaBoost Pro</h1>
    </div>
    <div class="tab-navigation">
        <button class="tab-button active">Criar</button>
        <button class="tab-button">Agendados</button>
        <button class="tab-button">Grupos</button>
    </div>
    <div class="tab-content active">
        <form class="post-form">
            <div class="form-group">
                <label class="form-label">Título</label>
                <input type="text" class="form-control filled" value="iPhone 14 Pro Max 256GB - Seminovo">
            </div>
            <div class="form-group">
                <label class="form-label">Descrição</label>
                <textarea class="form-control filled">Produto impecável. Apenas 3 meses de uso. Vai com caixa e acessórios.</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Imagens</label>
                <div class="image-preview-grid">
                    <div class="image-preview-item">IMG1.jpg</div>
                    <div class="image-preview-item">IMG2.jpg</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Data</label>
                <input type="date" class="form-control filled" value="2025-08-10">
                <label class="form-label">Hora</label>
                <input type="time" class="form-control filled" value="10:30">
            </div>
            <button class="btn btn-primary btn-large">Agendar</button>
        </form>
    </div>
</body>
</html>`;
        await fs.writeFile(path.join(this.templatesPath, '1-criar-post-exato.html'), html);
        console.log('  ✅ Criar Post pronto');
    }

    async generateScheduledPostsTemplate(originalCSS, authCSS) {
        console.log('🎨 Gerando template: Agendados...');
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VendaBoost Pro - Agendados</title>
    <style>${this.injectBaseStyle(originalCSS, authCSS)}</style>
</head>
<body>
    <div class="header">
        <h1 class="brand-title">VendaBoost Pro</h1>
    </div>
    <div class="tab-navigation">
        <button class="tab-button">Criar</button>
        <button class="tab-button active">Agendados</button>
        <button class="tab-button">Grupos</button>
    </div>
    <div class="tab-content active">
        <div class="scheduled-post-item">
            <h3>iPhone 14 Pro Max</h3>
            <p>Status: Agendado para 10/08/2025 10:30</p>
            <p>Grupos: 5</p>
        </div>
    </div>
</body>
</html>`;
        await fs.writeFile(path.join(this.templatesPath, '2-agendados-exato.html'), html);
        console.log('  ✅ Agendados pronto');
    }

    async generateGroupsTemplate(originalCSS, authCSS) {
        console.log('🎨 Gerando template: Grupos...');
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VendaBoost Pro - Grupos</title>
    <style>${this.injectBaseStyle(originalCSS, authCSS)}</style>
</head>
<body>
    <div class="header">
        <h1 class="brand-title">VendaBoost Pro</h1>
    </div>
    <div class="tab-navigation">
        <button class="tab-button">Criar</button>
        <button class="tab-button">Agendados</button>
        <button class="tab-button active">Grupos</button>
    </div>
    <div class="tab-content active">
        <h2>Meus Grupos</h2>
        <ul class="groups-list">
            <li class="group-toggle-button selected">Grupo 1 - iPhones SP</li>
            <li class="group-toggle-button selected">Grupo 2 - Marketplace Brasil</li>
            <li class="group-toggle-button">Grupo 3 - Celulares Rio</li>
        </ul>
    </div>
</body>
</html>`;
        await fs.writeFile(path.join(this.templatesPath, '3-grupos-exato.html'), html);
        console.log('  ✅ Grupos pronto');
    }

    async createExactCaptureGuide() {
        const content = `# 📸 Guia Rápido de Captura

1. Execute \`node generate-exact-screenshots-OTIMIZADO.js\`
2. Abra os arquivos HTML da pasta \`screenshot-templates-exact\`
3. Capture com zoom 100% e tela cheia (F11)
4. Redimensione para 1280x800 se necessário (em PNG)
`;
        await fs.writeFile(path.join(this.templatesPath, 'README.md'), content);
    }
}

const generator = new ExactScreenshotGenerator();
generator.generate();
