# VendaBoost Desktop — MVP de Automação para Facebook (Playwright)

> **Objetivo**: entregar um projeto mínimo, porém robusto, para usuários comuns publicarem no Marketplace e distribuírem o anúncio em grupos **por nome**, evitando seletores frágeis e sem burlar proteções. Inclui **CLI** e **UI desktop (Electron) opcional**, arquitetura escalável e um **Prompt Mestre** para você usar com uma IA (Claude/Grok) e evoluir o produto do zero.

---

## 1) Arquitetura em alto nível

- **Core (Node + TypeScript + Playwright)**
  - Orquestra o navegador **visível** (persistent profile), cuida de locators resilientes, passos do fluxo (criar anúncio, abrir modal "Anunciar mais locais", selecionar grupos por nome, publicar e confirmar).
  - Suporta **duas fontes** de grupos:
    1) Lista manual (campo multi-linha ou arquivo `.txt`)
    2) Import de **Download Your Information (DYI)** — parser genérico que varre JSON/HTML do ZIP e extrai nomes de grupos do próprio usuário.
- **CLI** para power-users e integração com jobs.
- **UI Desktop (Electron)** opcional para leigos: formulário, botão **Iniciar**, painel de logs/trace.
- **Boas práticas**: perfis isolados (`userDataDir`), throttling humano, logs estruturados, code-splitting por passos, tolerância a i18n (pt/en/es), sem stealth/bypass.

> **Compliance**: O fluxo é centrado no **usuário** logado, sem contornar proteções, e com import de dados via **DYI** (consentido). Ainda assim, **use de forma responsável** e informe seus clientes sobre Termos de Uso da plataforma.

---

## 2) Estrutura de pastas (monorepo simples)

```
vendaboost-desktop/
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ src/
│  ├─ cli.ts                     # CLI minimal para rodar fluxos
│  ├─ index.ts                   # API pública do core
│  ├─ config.ts                  # Tipos e carga de configuração
│  ├─ logger.ts                  # Logger simples + file/console
│  ├─ utils/
│  │  ├─ i18n.ts                 # helpers de labels (pt/en)
│  │  ├─ files.ts                # leitura de .txt e DYI zip
│  │  └─ wait.ts                 # esperas utilitárias
│  ├─ session/
│  │  └─ browser.ts              # launchPersistentContext
│  ├─ facebook/
│  │  ├─ marketplace.ts          # passos do anúncio
│  │  ├─ groups.ts               # seleção precisa por nome
│  │  └─ assertions.ts           # confirmações pós-ação
│  └─ dyi/
│     └─ groups-parser.ts        # extrai nomes de grupos do DYI
├─ electron/ (opcional)
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ main.ts                    # processo principal
│  ├─ preload.ts
│  └─ renderer/
│     ├─ index.html
│     ├─ app.tsx                 # UI (React + Vite) — opcional
│     └─ ipc.ts                  # contratos IPC → core
└─ README.md
```

---

## 3) Arquivos essenciais — **Core (Node + Playwright)**

### package.json (raiz)
```json
{
  "name": "vendaboost-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc -p .",
    "start": "node dist/cli.js",
    "pw:install": "npx playwright install chromium"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "fast-glob": "^3.3.2",
    "minimist": "^1.2.8",
    "p-limit": "^6.2.0",
    "playwright": "^1.47.0",
    "yargs": "^17.7.2",
    "yargs-parser": "^21.1.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.1",
    "typescript": "^5.5.4"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

### .env.example
```
USER_DATA_DIR=.user-profiles/default
FB_START_URL=https://www.facebook.com/marketplace/create/item
THROTTLE_MS=350
```

### src/config.ts
```ts
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const FlowSchema = z.object({
  title: z.string().min(3),
  price: z.union([z.string(), z.number()]),
  description: z.string().min(10),
  images: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
});

export type FlowInput = z.infer<typeof FlowSchema>;

export const AppConfig = z.object({
  userDataDir: z.string().default(process.env.USER_DATA_DIR || '.user-profiles/default'),
  startUrl: z.string().url().default(process.env.FB_START_URL || 'https://www.facebook.com/marketplace/create/item'),
  throttleMs: z.coerce.number().default(Number(process.env.THROTTLE_MS || 350)),
});

export type AppCfg = z.infer<typeof AppConfig>;

export function loadFlow(file?: string): FlowInput {
  if (!file) throw new Error('Passe --flow caminho/arquivo.json');
  const raw = fs.readFileSync(path.resolve(file), 'utf-8');
  const json = JSON.parse(raw);
  return FlowSchema.parse(json);
}

export function loadAppConfig(): AppCfg {
  return AppConfig.parse({});
}
```

### src/logger.ts
```ts
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export const log = (level: LogLevel, msg: string, extra?: unknown) => {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  if (extra) console[level === 'error' ? 'error' : 'log'](line, extra);
  else console[level === 'error' ? 'error' : 'log'](line);
};

export const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
```

### src/utils/i18n.ts
```ts
export const t = {
  buttons: {
    createListing: /Criar anúncio|Create (listing|ad)|Crear anuncio/i,
    postToMorePlaces: /Anunciar mais locais|Post to more places|Publicar en más lugares/i,
    publish: /Publicar|Postar|Publish|Publicar ahora/i,
    save: /Salvar|Save|Guardar/i,
  },
  labels: {
    title: /Título|Title|Título del anuncio/i,
    price: /Preço|Price|Precio/i,
    description: /Descrição|Description|Descripción/i,
    groupSearch: /Pesquisar|Search|Buscar/i,
  },
  texts: {
    published: /Publicado|publicado|Published/i,
  },
};
```

### src/utils/files.ts
```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';

export function readLines(file: string): string[] {
  const raw = fs.readFileSync(path.resolve(file), 'utf-8');
  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

// Stub para parser DYI: aceite .json ou .html extraídos do ZIP.
export async function parseGroupsFromDYI(dirOrFile: string): Promise<string[]> {
  const stats = fs.statSync(dirOrFile);
  const files = stats.isDirectory() ? await fg(['**/*.json', '**/*.html'], { cwd: dirOrFile, absolute: true }) : [dirOrFile];
  const found = new Set<string>();

  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const raw = fs.readFileSync(f, 'utf-8');

    if (ext === '.json') {
      try {
        const data = JSON.parse(raw);
        // Varredura genérica por chaves relacionadas a grupos
        JSON.stringify(data, (k, v) => {
          if (typeof v === 'string') {
            if (/grupo|group/i.test(k) || /grupo|group/i.test(v)) {
              // Heurística: nomes com espaços e sem URL
              if (!/^https?:\/\//i.test(v) && v.length >= 3 && v.length <= 120) found.add(v);
            }
          }
          return v;
        });
      } catch {}
    }

    if (ext === '.html') {
      // Heurística simples: capturar títulos de links de grupos
      const matches = raw.match(/>([^<]{3,120})<\/a>/g) || [];
      for (const m of matches) {
        const name = m.replace(/[><]/g, '').replace(/\s+/g, ' ').trim();
        if (name && !/^https?:/i.test(name)) found.add(name);
      }
    }
  }

  return Array.from(found);
}
```

### src/session/browser.ts
```ts
import { chromium, type BrowserContext } from 'playwright';

export async function launch(userDataDir: string): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });
  return context;
}
```

### src/facebook/groups.ts
```ts
import type { Page } from 'playwright';
import { t } from '../utils/i18n.js';
import { wait } from '../logger.js';

/**
 * Abre o modal "Anunciar mais locais" e seleciona grupos pelo NOME, um a um,
 * usando o campo de busca do modal (evita scroll infinito e seleção incorreta).
 */
export async function selectGroupsByName(page: Page, groupNames: string[], throttleMs = 300) {
  // Abrir modal de grupos
  const moreBtn = page.getByRole('button', { name: t.buttons.postToMorePlaces });
  await moreBtn.waitFor({ state: 'visible' });
  await moreBtn.click();

  // Campo de busca dentro do modal
  const searchBox = page.getByRole('textbox', { name: t.labels.groupSearch }).or(page.getByPlaceholder(/Pesquisar|Search|Buscar/i)).first();
  // Nem sempre há label/placeholder — fallback: pegue primeiro textbox do modal
  const modal = page.locator('[role="dialog"], [data-visualcompletion="ignore-dynamic"]').last();
  const search = await searchBox.elementHandle().catch(() => modal.getByRole('textbox').first().elementHandle());

  for (const name of groupNames) {
    if (!name) continue;
    // Digitar nome e selecionar a opção correspondente
    if (search) {
      await (await page.$(':focus'))?.press('Control+A').catch(() => {});
      await (await page.$(':focus'))?.press('Meta+A').catch(() => {});
      await (await page.$(':focus'))?.press('Delete').catch(() => {});
      await page.keyboard.type(name, { delay: 50 });
    }

    // Opção do grupo (checkbox/option) — tolerância a roles diferentes
    const option = modal.getByRole('option', { name: new RegExp(name, 'i') })
      .or(modal.getByRole('menuitemcheckbox', { name: new RegExp(name, 'i') }))
      .or(modal.getByText(new RegExp(`^${escapeRegex(name)}$`, 'i')).locator('..'))
      .first();

    await option.scrollIntoViewIfNeeded();
    await option.click();
    await wait(throttleMs);
  }

  // Confirmar (Salvar/Fechar)
  const save = modal.getByRole('button', { name: t.buttons.save }).first();
  if (await save.isVisible().catch(() => false)) await save.click();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### src/facebook/assertions.ts
```ts
import type { Page } from 'playwright';
import { t } from '../utils/i18n.js';

export async function assertPublished(page: Page) {
  // Confirmação geral pós-publicação (toast, texto, etc.)
  const ok = await page.getByText(t.texts.published).first().isVisible().catch(() => false);
  if (!ok) throw new Error('Não foi possível confirmar a publicação.');
}
```

### src/facebook/marketplace.ts
```ts
import type { BrowserContext } from 'playwright';
import { t } from '../utils/i18n.js';
import { wait, log } from '../logger.js';

export async function createListing(ctx: BrowserContext, startUrl: string, data: {
  title: string;
  price: string | number;
  description: string;
  images: string[];
}) {
  const page = await ctx.newPage();
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

  // Entrar no fluxo de criação (varia por layout/região)
  const createBtn = page.getByRole('button', { name: t.buttons.createListing }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
  }

  // Preencher campos principais
  const title = page.getByLabel(t.labels.title).or(page.getByPlaceholder(t.labels.title));
  await title.first().fill(data.title);

  const price = page.getByLabel(t.labels.price).or(page.getByPlaceholder(t.labels.price));
  await price.first().fill(String(data.price));

  const desc = page.getByLabel(t.labels.description).or(page.getByPlaceholder(t.labels.description));
  await desc.first().fill(data.description);

  // Upload de imagens (se o fluxo atual permitir)
  if (data.images?.length) {
    const fileInputs = page.locator('input[type=file]').first();
    if (await fileInputs.count()) {
      await fileInputs.setInputFiles(data.images);
    } else {
      log('warn', 'Campo de upload não encontrado — seguindo sem imagens.');
    }
  }

  // Aguarde pequenas reativações de UI
  await wait(400);
  return page;
}

export async function publish(page: any) {
  const publishBtn = page.getByRole('button', { name: t.buttons.publish }).first();
  await publishBtn.waitFor({ state: 'visible', timeout: 15000 });
  await publishBtn.click();
}
```

### src/index.ts (API de alto nível)
```ts
import { loadAppConfig, type FlowInput } from './config.js';
import { launch } from './session/browser.js';
import { createListing, publish } from './facebook/marketplace.js';
import { selectGroupsByName } from './facebook/groups.js';
import { assertPublished } from './facebook/assertions.js';
import { log, wait } from './logger.js';

export async function runFlow(flow: FlowInput) {
  const cfg = loadAppConfig();
  const ctx = await launch(cfg.userDataDir);

  try {
    const page = await createListing(ctx, cfg.startUrl, flow);

    if (flow.groups?.length) {
      await selectGroupsByName(page, flow.groups, cfg.throttleMs);
    }

    await publish(page);
    await assertPublished(page);

    log('info', '✅ Fluxo concluído com sucesso.');
  } finally {
    // Não feche o contexto por padrão — mantém sessão para o usuário.
    // await ctx.close();
    await wait(300);
  }
}
```

### src/cli.ts (linha de comando)
```ts
#!/usr/bin/env -S node --no-warnings
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadFlow } from './config.js';
import { runFlow } from './index.js';
import { readLines, parseGroupsFromDYI } from './utils/files.js';

const argv = await yargs(hideBin(process.argv))
  .option('flow', { type: 'string', demandOption: true, desc: 'Caminho do JSON com {title, price, description, images?, groups?}' })
  .option('groupsTxt', { type: 'string', desc: 'Caminho de .txt (um grupo por linha)' })
  .option('dyi', { type: 'string', desc: 'Pasta/arquivo do Download Your Information para extrair nomes de grupos' })
  .strict()
  .help()
  .parse();

const flow = loadFlow(argv.flow);

if (argv.groupsTxt) {
  flow.groups = readLines(argv.groupsTxt);
}

if (argv.dyi) {
  const g = await parseGroupsFromDYI(argv.dyi);
  const set = new Set([...(flow.groups || []), ...g]);
  flow.groups = Array.from(set);
}

await runFlow(flow);
```

---

## 4) Exemplo de `flow.json`
```json
{
  "title": "Notebook Gamer RTX 3060 - 16GB RAM",
  "price": 4200,
  "description": "Notebook gamer em ótimo estado, RTX 3060, 512GB SSD, acompanha carregador original.",
  "images": ["./fotos/1.jpg", "./fotos/2.jpg"],
  "groups": [
    "Compra e Venda Cidade X",
    "Classificados da Região Y",
    "Ofertas Cidade Z"
  ]
}
```

---

## 5) Como rodar (MVP CLI)

1. **Instale dependências**
   ```bash
   pnpm i # ou npm i / yarn
   pnpm pw:install
   ```
2. **Crie o arquivo `.env`** (baseado em `.env.example`) e ajuste `USER_DATA_DIR` se quiser isolar perfis.
3. **Execute**
   ```bash
   pnpm dev -- --flow ./flow.json
   # ou com fontes de grupos
   pnpm dev -- --flow ./flow.json --groupsTxt ./meus-grupos.txt
   pnpm dev -- --flow ./flow.json --dyi ./DYI-extraido/
   ```
4. **Faça login** na primeira execução (janela Chromium abrirá). Depois, a sessão persiste em `USER_DATA_DIR`.

> **Dicas:**
> - Se o botão/label mudar, atualize as regex em `utils/i18n.ts` ao invés de quebrar o fluxo com seletores frágeis.
> - Use imagens leves e realistas.

---

## 6) (Opcional) UI Desktop com Electron

> A UI é opcional e pode ser adicionada depois. O _core_ acima já é reutilizável por Electron via IPC.

- `electron/main.ts` cria a janela, recebe um payload `{ flow, groupsTxt, dyi }` do renderer e chama `runFlow(payload.flow)` em **processo separado** (evita travar a UI).
- Use `child_process.fork` ou `worker_threads` para isolar Playwright.
- Exiba **logs de progresso** no renderer (IPC broadcast).

*(Arquivos de Electron podem ser gerados pelo Prompt Mestre abaixo.)*

---

## 7) Testes de regressão (sugestão)

- **Smoke**: abrir startUrl, detectar botões chaves (`createListing`, `publish`).
- **Seleção de grupos**: mockar modal em página de teste com roles semelhantes e validar `selectGroupsByName`.
- **Parser DYI**: snapshots de entradas reais (com dados anonimizados) → garantir extração estável.

---

## 8) Limites & boas práticas

- Evite `sleep`; prefira `getByRole(...).waitFor()` e `scrollIntoViewIfNeeded()`.
- Throttle humano (env var `THROTTLE_MS`).
- Nada de contornar CAPTCHA/2FA. Se aparecer, **pare e peça ação do usuário**.
- Logue ações principais (sem dados sensíveis).

---

# PROMPT MESTRE — "Construa a Ferramenta do Zero (Playwright)"

> **Use este prompt diretamente em uma IA (Claude/Grok)** para ela montar/estender o projeto. Personalize campos entre `[[...]]`.

```
Você é um Engenheiro de Software Sênior. Construa do zero um aplicativo de automação para Facebook focado em vendedores comuns, usando Node.js + TypeScript + Playwright, com CLI e opção futura de UI desktop (Electron). Siga **à risca** os requisitos abaixo e produza **código pronto para rodar**, com instruções claras.

OBJETIVO
- Fluxo principal: criar anúncio no Marketplace e postar em grupos **por nome**, abrindo o modal “Anunciar mais locais” e selecionando grupos via busca interna (sem scroll desnecessário). Depois, publicar e confirmar sucesso.
- O usuário verá o navegador (headless=false), logará na primeira execução e a sessão persistirá em `USER_DATA_DIR`.

CONTRAINTS & COMPLIANCE
- Não use modos stealth, não burle proteções, não automatize criação de contas.
- Somente use dados do **próprio usuário**. Para lista de grupos, aceite: (1) arquivo .txt (um por linha) e (2) pasta/arquivo do **Download Your Information (DYI)** para extrair nomes de grupos.
- Evite seletores frágeis. Prefira `getByRole/getByLabel/getByPlaceholder` com **regex** multilíngue (pt/en/es). Centralize labels em um módulo `utils/i18n.ts`.

ARQUITETURA MÍNIMA (obrigatória)
- `src/` com módulos:
  - `config.ts`: zod schemas; `.env` com `USER_DATA_DIR`, `FB_START_URL`, `THROTTLE_MS`.
  - `logger.ts`: logger simples + `wait()`.
  - `utils/i18n.ts`: regex de labels/botões (pt/en/es).
  - `utils/files.ts`: `readLines(file)` e `parseGroupsFromDYI(dirOrFile)` (robusto a JSON/HTML do zip DYI).
  - `session/browser.ts`: `launch(userDataDir)` → `chromium.launchPersistentContext`.
  - `facebook/marketplace.ts`: `createListing(ctx, startUrl, {title,price,description,images})` e `publish(page)`.
  - `facebook/groups.ts`: `selectGroupsByName(page, groupNames, throttleMs)` que usa a **busca do modal**; sem rolar lista inteira.
  - `facebook/assertions.ts`: `assertPublished(page)` que detecta confirmação (toast/texto) via regex.
  - `index.ts`: `runFlow(flow)` orquestra tudo.
  - `cli.ts`: aceita `--flow`, `--groupsTxt`, `--dyi`.
- `package.json` com scripts: `dev`, `build`, `start`, `pw:install`.
- `tsconfig.json` moderno; usar módulos ES.
- **Instruções de uso** (install, env, exemplos de execução) no README.

ACEITAÇÃO FUNCIONAL
- Dado um `flow.json` de exemplo e um `.txt` com 3 nomes de grupo, ao rodar `npm run dev -- --flow ... --groupsTxt ...`, o app:
  1) Abre Chromium com perfil persistente.
  2) Vai para `FB_START_URL`.
  3) Preenche título, preço e descrição.
  4) Abre “Anunciar mais locais”.
  5) Para **cada** nome, digita no campo de busca do modal, espera a opção correta e clica (sem scroll até o final da lista).
  6) Clica em “Publicar/Publish”.
  7) Valida confirmação (toast/texto).
  8) Loga “✅ Fluxo concluído”.

ROBUSTEZ
- Use `scrollIntoViewIfNeeded()` antes de clicar.
- Sempre **espere visibilidade** e estados; evite `sleep` bruto.
- Tolerância a variações de idioma com regex centralizadas.

EXTENSÕES (se houver tempo)
- `electron/` com janela simples: formulário (título, preço, descrição, upload de imagens, textarea para grupos) e botão **Iniciar**. Envie payload via IPC para um worker que chama o core. Exiba logs em tempo real.

ENTREGA
- Código final em blocos por arquivo, sem textos supérfluos.
- Inclua pequenos comentários explicando trechos críticos.

PERSONALIZAÇÕES
- Nome do produto: [[VendaBoost Desktop]]
- URL inicial: [[https://www.facebook.com/marketplace/create/item]]
- Idiomas alvo: português (BR) + inglês; se possível espanhol.
- Tamanho do throttle humano: [[300–500ms]] configurável.

Teste localmente com dados fictícios e gere um README com passo a passo.
```

---

## 9) Próximos passos sugeridos

- Gerar a **UI Electron** com o Prompt Mestre e conectar ao `runFlow` via IPC.
- Adicionar **Trace Viewer** do Playwright por execução (para suporte ao cliente).
- Implementar **limites de taxa** e agendamento básico.
- Empacotar (Windows/macOS) com auto-update e licenciamento simples.

> Quando quiser, eu gero os arquivos de **Electron** e um **installer** mínimo (NSIS/DMG) para distribuição. 

