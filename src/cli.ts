#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { loadFlow, createExampleFlow } from './config.js';
import { VendaBoostAutomation } from './index.js';
import { readLines, parseGroupsFromDYI, exists, createExampleGroupsList } from './utils/files.js';
import { info, warn, error, setLogLevel } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Interface para argumentos da CLI
 */
interface CliArgs {
  flow?: string;
  groups?: string;
  dyi?: string;
  headless?: boolean;
  throttle?: number;
  timeout?: number;
  verbose?: boolean;
  debug?: boolean;
  'create-examples'?: boolean;
  'groups-only'?: boolean;
  'listing-only'?: boolean;
  'extension-session'?: string;
  'auto-extension'?: boolean;
}

/**
 * Configuração principal da CLI
 */
const cli = yargs(hideBin(process.argv))
  .scriptName('vendaboost')
  .usage('$0 [opções]')
  .version('1.0.0')
  .help('help')
  .alias('h', 'help')
  .example('$0 --flow flow.json', 'Executa com dados do arquivo flow.json')
  .example('$0 --flow flow.json --groups grupos.txt', 'Executa com grupos do arquivo grupos.txt')
  .example('$0 --flow flow.json --dyi dyi-data/', 'Executa com grupos extraídos do DYI')
  .example('$0 --flow flow.json --auto-extension', 'Executa com sessão da extensão Chrome')
  .example('$0 --create-examples', 'Cria arquivos de exemplo')
  .option('flow', {
    alias: 'f',
    type: 'string',
    description: 'Arquivo JSON com dados do anúncio (flow.json)',
    default: 'flow.json'
  })
  .option('groups', {
    alias: 'g',
    type: 'string',
    description: 'Arquivo .txt com lista de grupos (um por linha)'
  })
  .option('dyi', {
    alias: 'd',
    type: 'string',
    description: 'Diretório com dados do "Download Your Information" do Facebook'
  })
  .option('headless', {
    type: 'boolean',
    description: 'Executar browser em modo headless (invisível)',
    default: false
  })
  .option('throttle', {
    alias: 't',
    type: 'number',
    description: 'Delay entre ações em milissegundos',
    default: 350
  })
  .option('timeout', {
    type: 'number',
    description: 'Timeout para verificação de publicação em milissegundos',
    default: 30000
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Modo verboso (mais logs)',
    default: false
  })
  .option('debug', {
    type: 'boolean',
    description: 'Modo debug (logs detalhados + browser mantido aberto)',
    default: false
  })
  .option('create-examples', {
    type: 'boolean',
    description: 'Criar arquivos de exemplo (flow.json, grupos.txt)',
    default: false
  })
  .option('groups-only', {
    type: 'boolean',
    description: 'Executar apenas seleção de grupos (assumindo anúncio já criado)',
    default: false
  })
  .option('listing-only', {
    type: 'boolean',
    description: 'Executar apenas criação do anúncio (sem grupos)',
    default: false
  })
  .option('extension-session', {
    alias: 'e',
    type: 'string',
    description: 'Arquivo JSON com dados de sessão da extensão Chrome'
  })
  .option('auto-extension', {
    type: 'boolean',
    description: 'Buscar automaticamente pelo arquivo de sessão mais recente da extensão',
    default: false
  })
  .check((argv) => {
    // Validações
    if (argv['groups-only'] && argv['listing-only']) {
      throw new Error('❌ --groups-only e --listing-only são mutuamente exclusivos');
    }
    
    if (argv['groups-only'] && !argv.groups && !argv.dyi) {
      throw new Error('❌ --groups-only requer --groups ou --dyi');
    }
    
    if ((argv.groups && argv.dyi)) {
      throw new Error('❌ --groups e --dyi são mutuamente exclusivos');
    }
    
    return true;
  });

/**
 * Função principal da CLI
 */
async function main(): Promise<void> {
  try {
    const args = await cli.argv as CliArgs;
    
    // Configurar nível de log
    if (args.debug) {
      setLogLevel('debug');
    } else if (args.verbose) {
      setLogLevel('info');
    }

    // Criar arquivos de exemplo se solicitado
    if (args['create-examples']) {
      await createExamples();
      return;
    }

    // Validar arquivo de flow
    if (!args['groups-only'] && !await exists(args.flow!)) {
      error(`❌ Arquivo de flow não encontrado: ${args.flow}`);
      info('💡 Use --create-examples para criar arquivos de exemplo');
      process.exit(1);
    }

    // Carregar dados do flow
    let flowData = null;
    if (!args['groups-only']) {
      try {
        flowData = await loadFlow(args.flow!);
        info(`✅ Flow carregado: ${flowData.title}`);
      } catch (err) {
        error(`❌ Erro ao carregar flow: ${err}`);
        process.exit(1);
      }
    }

    // Carregar grupos
    let groupNames: string[] = [];
    if (args.groups || args.dyi) {
      try {
        groupNames = await loadGroups(args.groups, args.dyi);
        info(`✅ ${groupNames.length} grupos carregados`);
      } catch (err) {
        error(`❌ Erro ao carregar grupos: ${err}`);
        process.exit(1);
      }
    }

    // Executar automação
    const automation = new VendaBoostAutomation();
    
    try {
      const config: any = {};
      
      info(`🔧 Argumentos CLI recebidos: auto-extension=${args['auto-extension']}, extension-session=${args['extension-session']}`);
      
      if (args.headless !== undefined) config.headless = args.headless;
      if (args.throttle !== undefined) config.throttleMs = args.throttle;
      if (args.timeout !== undefined) config.timeout = args.timeout;
      if (args.debug !== undefined) config.debug = args.debug;
      if (args['extension-session'] !== undefined) config.extensionSession = args['extension-session'];
      if (args['auto-extension'] !== undefined) config.autoExtension = args['auto-extension'];
      
      info(`🔧 Config final: autoExtension=${config.autoExtension}, extensionSession=${config.extensionSession}`);

      let result;
      
      if (args['groups-only']) {
        info('🎯 Executando apenas seleção de grupos...');
        result = await automation.selectGroupsOnly(
          groupNames, 
          config.extensionSession, 
          config.autoExtension
        );
      } else if (args['listing-only']) {
        info('📝 Executando apenas criação do anúncio...');
        result = await automation.createListingOnly(flowData!);
      } else {
        info('🚀 Executando fluxo completo...');
        const flowOptions: any = {
          flowData: flowData!,
          config
        };
        
        if (groupNames.length > 0) {
          flowOptions.groupNames = groupNames;
        }
        
        result = await automation.runFlow(flowOptions);
      }

      // Exibir resultado
      displayResult(result);
      
      // Exit code baseado no sucesso
      process.exit(result.success ? 0 : 1);
      
    } catch (err) {
      error('💥 Erro durante execução:', err);
      process.exit(1);
    }

  } catch (err) {
    error('❌ Erro na CLI:', err);
    process.exit(1);
  }
}

/**
 * Carrega grupos de arquivo .txt ou DYI
 */
async function loadGroups(groupsFile?: string, dyiDir?: string): Promise<string[]> {
  if (groupsFile) {
    info(`📂 Carregando grupos de: ${groupsFile}`);
    
    if (!await exists(groupsFile)) {
      throw new Error(`Arquivo de grupos não encontrado: ${groupsFile}`);
    }
    
    const lines = await readLines(groupsFile);
    const groups = lines
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
    
    if (groups.length === 0) {
      throw new Error('Nenhum grupo válido encontrado no arquivo');
    }
    
    return groups;
  }
  
  if (dyiDir) {
    info(`📂 Extraindo grupos do DYI: ${dyiDir}`);
    
    if (!await exists(dyiDir)) {
      throw new Error(`Diretório DYI não encontrado: ${dyiDir}`);
    }
    
    const groups = await parseGroupsFromDYI(dyiDir);
    
    if (groups.length === 0) {
      throw new Error('Nenhum grupo encontrado nos dados do DYI');
    }
    
    return groups;
  }
  
  return [];
}

/**
 * Cria arquivos de exemplo
 */
async function createExamples(): Promise<void> {
  info('📝 Criando arquivos de exemplo...');
  
  try {
    // Criar flow.json de exemplo
    await createExampleFlow('flow.json');
    info('✅ flow.json criado');
    
    // Criar grupos.txt de exemplo
    await createExampleGroupsList('grupos.txt');
    info('✅ grupos.txt criado');
    
    // Criar .env de exemplo se não existir
    const envPath = '.env';
    if (!await exists(envPath)) {
      const envExample = await readLines('.env.example');
      await fs.promises.writeFile(envPath, envExample.join('\n'));
      info('✅ .env criado (baseado em .env.example)');
    }
    
    info('🎉 Arquivos de exemplo criados com sucesso!');
    info('');
    info('📋 Próximos passos:');
    info('1. Edite flow.json com os dados do seu anúncio');
    info('2. Edite grupos.txt com os nomes dos seus grupos (opcional)');
    info('3. Configure .env com suas preferências');
    info('4. Execute: npm run start');
    
  } catch (err) {
    error('❌ Erro ao criar exemplos:', err);
    throw err;
  }
}

/**
 * Exibe o resultado da execução
 */
function displayResult(result: any): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESULTADO DA EXECUÇÃO');
  console.log('='.repeat(50));
  
  if (result.success) {
    console.log('✅ Status: SUCESSO');
    console.log(`📝 ${result.message}`);
    
    if (result.listingUrl) {
      console.log(`🔗 URL: ${result.listingUrl}`);
    }
    
    if (result.groupsCount) {
      console.log(`👥 Grupos: ${result.groupsCount}`);
    }
  } else {
    console.log('❌ Status: FALHA');
    console.log(`💬 ${result.message}`);
    
    if (result.error) {
      console.log(`🔍 Erro: ${result.error}`);
    }
  }
  
  console.log(`⏰ Horário: ${result.timestamp.toLocaleString('pt-BR')}`);
  console.log('='.repeat(50) + '\n');
}

/**
 * Tratamento de sinais para cleanup
 */
process.on('SIGINT', () => {
  warn('\n⚠️ Interrompido pelo usuário (Ctrl+C)');
  process.exit(130);
});

process.on('SIGTERM', () => {
  warn('\n⚠️ Processo terminado');
  process.exit(143);
});

process.on('unhandledRejection', (reason, promise) => {
  error(`💥 Unhandled Rejection at: ${promise} reason: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  error('💥 Uncaught Exception:', err);
  process.exit(1);
});

// Executar CLI se este arquivo for o ponto de entrada
const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1];
if (entryFile && (currentFile === entryFile || currentFile === path.resolve(entryFile))) {
  main().catch((err) => {
    error('💥 Erro fatal:', err);
    process.exit(1);
  });
}

export { main as runCli };