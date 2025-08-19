import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { info, warn, debug } from '../logger.js';

/**
 * Lê linhas de um arquivo de texto, removendo linhas vazias e espaços
 */
export function readLines(file: string): string[] {
  try {
    const resolvedPath = path.resolve(file);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Arquivo não encontrado: ${resolvedPath}`);
    }

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    info(`Carregadas ${lines.length} linhas do arquivo: ${file}`);
    return lines;
  } catch (error) {
    throw new Error(`Erro ao ler arquivo ${file}: ${error}`);
  }
}

/**
 * Escreve linhas em um arquivo de texto
 */
export function writeLines(file: string, lines: string[]): void {
  try {
    const resolvedPath = path.resolve(file);
    const dir = path.dirname(resolvedPath);
    
    // Cria diretório se não existir
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = lines.join('\n');
    fs.writeFileSync(resolvedPath, content, 'utf-8');
    
    info(`Arquivo salvo com ${lines.length} linhas: ${file}`);
  } catch (error) {
    throw new Error(`Erro ao escrever arquivo ${file}: ${error}`);
  }
}

/**
 * Verifica se um arquivo ou diretório existe
 */
export function exists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

/**
 * Obtém informações sobre um arquivo ou diretório
 */
export function getStats(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(path.resolve(filePath));
  } catch {
    return null;
  }
}

/**
 * Parser robusto para extrair nomes de grupos do Download Your Information (DYI) do Facebook
 */
export async function parseGroupsFromDYI(dirOrFile: string): Promise<string[]> {
  try {
    const resolvedPath = path.resolve(dirOrFile);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Caminho não encontrado: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    let files: string[] = [];

    if (stats.isDirectory()) {
      // Busca arquivos JSON e HTML recursivamente
      files = await fg(['**/*.json', '**/*.html'], { 
        cwd: resolvedPath, 
        absolute: true,
        caseSensitiveMatch: false
      });
      info(`Encontrados ${files.length} arquivos para análise em: ${dirOrFile}`);
    } else {
      files = [resolvedPath];
    }

    const foundGroups = new Set<string>();

    for (const file of files) {
      try {
        const groups = await parseGroupsFromFile(file);
        groups.forEach(group => foundGroups.add(group));
        debug(`Extraídos ${groups.length} grupos de: ${path.basename(file)}`);
      } catch (error) {
        warn(`Erro ao processar arquivo ${file}:`, error);
      }
    }

    const result = Array.from(foundGroups).sort();
    info(`Total de grupos únicos extraídos: ${result.length}`);
    
    return result;
  } catch (error) {
    throw new Error(`Erro ao processar DYI: ${error}`);
  }
}

/**
 * Extrai nomes de grupos de um arquivo específico (JSON ou HTML)
 */
async function parseGroupsFromFile(filePath: string): Promise<string[]> {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf-8');
  const found = new Set<string>();

  if (ext === '.json') {
    await parseGroupsFromJSON(raw, found);
  } else if (ext === '.html') {
    await parseGroupsFromHTML(raw, found);
  }

  return Array.from(found);
}

/**
 * Extrai nomes de grupos de conteúdo JSON
 */
async function parseGroupsFromJSON(content: string, found: Set<string>): Promise<void> {
  try {
    const data = JSON.parse(content);
    
    // Varredura recursiva por estruturas que podem conter nomes de grupos
    function traverse(obj: any, path: string[] = []): void {
      if (typeof obj === 'string') {
        // Verifica se é um nome de grupo válido
        if (isValidGroupName(obj)) {
          // Verifica contexto para confirmar que é um grupo
          const pathStr = path.join('.');
          if (isGroupContext(pathStr, obj)) {
            found.add(obj);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => traverse(item, [...path, index.toString()]));
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          traverse(value, [...path, key]);
        });
      }
    }

    traverse(data);
  } catch (error) {
    debug('Erro ao parsear JSON:', error);
  }
}

/**
 * Extrai nomes de grupos de conteúdo HTML
 */
async function parseGroupsFromHTML(content: string, found: Set<string>): Promise<void> {
  // Regex para capturar texto entre tags de link
  const linkRegex = /<a[^>]*>([^<]{3,120})<\/a>/gi;
  
  // Regex para capturar texto em elementos que podem conter nomes de grupos
  const textRegex = /<(?:h[1-6]|span|div|p)[^>]*>([^<]{3,120})<\/(?:h[1-6]|span|div|p)>/gi;
  
  const regexes = [linkRegex, textRegex];
  
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const text = match[1]?.trim();
      if (text && isValidGroupName(text)) {
        found.add(text);
      }
    }
  }
}

/**
 * Verifica se uma string é um nome de grupo válido
 */
function isValidGroupName(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const trimmed = text.trim();
  
  // Critérios básicos
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  
  // Não deve ser uma URL
  if (/^https?:\/\//i.test(trimmed)) return false;
  
  // Não deve ser apenas números
  if (/^\d+$/.test(trimmed)) return false;
  
  // Não deve conter caracteres especiais demais
  if (/[<>{}[\]\\|`~]/g.test(trimmed)) return false;
  
  // Deve ter pelo menos uma letra
  if (!/[a-zA-ZÀ-ÿ]/g.test(trimmed)) return false;
  
  // Não deve ser texto muito genérico
  const genericTerms = [
    'facebook', 'group', 'grupo', 'page', 'página', 'post', 'comment', 'comentário',
    'like', 'curtir', 'share', 'compartilhar', 'photo', 'foto', 'video', 'vídeo',
    'message', 'mensagem', 'notification', 'notificação', 'friend', 'amigo',
    'profile', 'perfil', 'timeline', 'linha do tempo', 'news feed', 'feed de notícias'
  ];
  
  const lowerText = trimmed.toLowerCase();
  if (genericTerms.some(term => lowerText === term)) return false;
  
  return true;
}

/**
 * Verifica se o contexto indica que o texto é realmente um nome de grupo
 */
function isGroupContext(path: string, text: string): boolean {
  const lowerPath = path.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Indicadores positivos no caminho
  const groupIndicators = [
    'group', 'grupo', 'groups', 'grupos', 'community', 'comunidade',
    'joined', 'participando', 'member', 'membro', 'admin', 'administrador'
  ];
  
  const hasGroupIndicator = groupIndicators.some(indicator => 
    lowerPath.includes(indicator)
  );
  
  // Indicadores positivos no texto
  const textGroupIndicators = [
    'compra e venda', 'buy and sell', 'marketplace', 'classificados',
    'ofertas', 'deals', 'vendas', 'sales', 'negócios', 'business',
    'comunidade', 'community', 'cidade', 'city', 'região', 'region'
  ];
  
  const hasTextIndicator = textGroupIndicators.some(indicator =>
    lowerText.includes(indicator)
  );
  
  return hasGroupIndicator || hasTextIndicator;
}

/**
 * Cria um arquivo de exemplo com lista de grupos
 */
export function createExampleGroupsList(outputPath: string): void {
  const exampleGroups = [
    "Compra e Venda - São Paulo",
    "Classificados da Região Sul",
    "Ofertas e Promoções - Rio de Janeiro",
    "Marketplace Local - Belo Horizonte",
    "Vendas Online - Brasília",
    "Negócios e Oportunidades - Salvador"
  ];

  writeLines(outputPath, exampleGroups);
  info(`Arquivo de exemplo criado: ${outputPath}`);
}

/**
 * Valida se um arquivo tem extensão suportada
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.txt', '.json', '.html'].includes(ext);
}

/**
 * Obtém o tamanho de um arquivo em bytes
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(path.resolve(filePath));
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Formata o tamanho de arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}