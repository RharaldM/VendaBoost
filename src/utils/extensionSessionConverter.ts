import fs from 'fs/promises';
import path from 'path';
import { info, warn, error } from '../logger.js';

/**
 * Converte dados de sessão capturados pela extensão Chrome
 * para o formato usado pelo Playwright
 */
export async function convertExtensionSessionToPlaywright(
  extensionSessionPath: string,
  outputPath?: string | undefined
): Promise<boolean> {
  try {
    // Ler dados da extensão
    const sessionData = JSON.parse(
      await fs.readFile(extensionSessionPath, 'utf-8')
    );

    info(`📦 Convertendo sessão da extensão para Playwright`);
    info(`👤 Usuário: ${sessionData.userInfo?.name || 'Desconhecido'} (ID: ${sessionData.userId})`);

    // Filtrar cookies importantes e do usuário correto
    const importantCookies = ['c_user', 'xs', 'datr', 'fr', 'sb', 'wd', 'presence'];
    const filteredCookies = sessionData.cookies.filter((cookie: any) => {
      // Remover cookies de outros usuários (como dbln com IDs diferentes)
      if (cookie.name === 'dbln') {
        try {
          const decodedValue = decodeURIComponent(cookie.value);
          if (!decodedValue.includes(sessionData.userId)) {
            warn(`⚠️ Removendo cookie dbln de outro usuário: ${decodedValue}`);
            return false;
          }
        } catch (e) {
          warn(`⚠️ Erro ao decodificar cookie dbln, removendo: ${cookie.value}`);
          return false;
        }
      }
      
      // Remover cookies de múltiplos logins que podem causar conflito
      const conflictCookies = ['act', 'presence', 'x-src'];
      if (conflictCookies.includes(cookie.name)) {
        warn(`⚠️ Removendo cookie de conflito: ${cookie.name}`);
        return false;
      }
      
      return true;
    });

    // Converter para formato Playwright
    const playwrightSession: any = {
      cookies: filteredCookies.map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        // Convert expires from milliseconds to seconds for Playwright
        expires: cookie.expires && cookie.expires !== -1 ? 
          (cookie.expires > 1000000000000 ? cookie.expires / 1000 : cookie.expires) : -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: convertSameSite(cookie.sameSite)
      })),
      origins: []
    };

    // Adicionar localStorage se disponível
    if (sessionData.localStorage) {
      const fbOrigin = {
        origin: 'https://www.facebook.com',
        localStorage: Object.entries(sessionData.localStorage).map(([name, value]) => ({
          name,
          value: String(value)
        }))
      };
      playwrightSession.origins.push(fbOrigin);
    }

    // Salvar sessão convertida
    const outputFile = outputPath || 'vendaboost-session.json';
    await fs.writeFile(
      outputFile,
      JSON.stringify(playwrightSession, null, 2)
    );

    info(`✅ Sessão convertida e salva em: ${outputFile}`);
    
    // Verificar cookies essenciais
    const cookieNames = playwrightSession.cookies.map((c: any) => c.name);
    const essentialCookies = ['c_user', 'xs', 'datr'];
    const hasEssential = essentialCookies.every(name => cookieNames.includes(name));
    
    if (!hasEssential) {
      warn(`⚠️ Alguns cookies essenciais estão faltando: ${essentialCookies.filter(n => !cookieNames.includes(n))}`);
    }

    return true;
  } catch (err) {
    error(`❌ Erro ao converter sessão da extensão: ${err}`);
    return false;
  }
}

function convertSameSite(sameSite: string | undefined): 'Strict' | 'Lax' | 'None' | undefined {
  if (!sameSite) return undefined;
  
  const mapping: Record<string, 'Strict' | 'Lax' | 'None'> = {
    'no_restriction': 'None',
    'lax': 'Lax',
    'strict': 'Strict',
    'unspecified': 'None'
  };
  
  return mapping[sameSite.toLowerCase()] || undefined;
}

/**
 * Busca e converte automaticamente a sessão mais recente
 */
export async function autoConvertLatestSession(): Promise<boolean> {
  try {
    const sessionsDir = path.join(process.cwd(), 'data', 'sessions');
    const currentSessionFile = path.join(sessionsDir, 'current-session.json');
    
    // Verificar se existe sessão atual
    try {
      await fs.access(currentSessionFile);
      info(`📂 Usando sessão atual: ${currentSessionFile}`);
      return await convertExtensionSessionToPlaywright(currentSessionFile);
    } catch {
      warn(`⚠️ Arquivo de sessão atual não encontrado`);
    }
    
    // Buscar sessão mais recente
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files
      .filter(f => f.startsWith('session-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (sessionFiles.length > 0 && sessionFiles[0]) {
      const latestSession = path.join(sessionsDir, sessionFiles[0]);
      info(`📂 Usando sessão mais recente: ${latestSession}`);
      return await convertExtensionSessionToPlaywright(latestSession);
    }
    
    error(`❌ Nenhuma sessão da extensão encontrada`);
    return false;
    
  } catch (err) {
    error(`❌ Erro ao buscar sessão: ${err}`);
    return false;
  }
}