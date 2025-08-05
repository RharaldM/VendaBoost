// Script de Migração de Dados para Nova Estrutura de Usuários
// Migra dados de /agendamentos para /users/{uid}/agendamentos
// Executar com: node MigrarDadosParaUsuarios.cjs

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Interface para entrada do usuário
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Função para extrair configuração do Firebase
function extrairConfiguracaoFirebase() {
    try {
        const configPath = path.join(__dirname, 'src', 'firebase-config.js');
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        const apiKeyMatch = configContent.match(/apiKey:\s*["']([^"']+)["']/);
        const projectIdMatch = configContent.match(/projectId:\s*["']([^"']+)["']/);
        
        if (!apiKeyMatch || !projectIdMatch) {
            throw new Error('Configuração Firebase incompleta');
        }
        
        return {
            apiKey: apiKeyMatch[1],
            authDomain: `${projectIdMatch[1]}.firebaseapp.com`,
            projectId: projectIdMatch[1],
            storageBucket: `${projectIdMatch[1]}.appspot.com`
        };
    } catch (error) {
        console.error('❌ Erro ao extrair configuração Firebase:', error.message);
        process.exit(1);
    }
}

// Inicialização do Firebase
const firebaseConfig = extrairConfiguracaoFirebase();
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🔧 Firebase inicializado:', firebaseConfig.projectId);

// Função para perguntar algo ao usuário
function pergunta(texto) {
    return new Promise(resolve => {
        rl.question(texto, resolve);
    });
}

// Função para confirmar uma ação
async function confirmar(pergunta) {
    const resposta = await pergunta(pergunta + ' (s/N): ');
    return resposta.toLowerCase().startsWith('s');
}

// Função para buscar agendamentos da estrutura antiga
async function buscarAgendamentosAntigos() {
    try {
        console.log('🔍 Buscando agendamentos na estrutura antiga (/agendamentos)...');
        
        const agendamentosRef = collection(db, 'agendamentos');
        // Tentar ordenar por createdAt primeiro, depois criadoEm se não existir
        let q;
        try {
            q = query(agendamentosRef, orderBy('createdAt', 'desc'));
        } catch (error) {
            console.log('📝 Usando ordenação por criadoEm (estrutura antiga)');
            q = query(agendamentosRef, orderBy('criadoEm', 'desc'));
        }
        const querySnapshot = await getDocs(q);
        
        const agendamentos = [];
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            agendamentos.push({
                id: docSnapshot.id,
                data: data
            });
        });
        
        console.log(`📊 Encontrados ${agendamentos.length} agendamentos na estrutura antiga`);
        return agendamentos;
        
    } catch (error) {
        console.error('❌ Erro ao buscar agendamentos antigos:', error.message);
        return [];
    }
}

// Função para agrupar agendamentos por dispositivo/email
function agruparAgendamentosPorUsuario(agendamentos) {
    const grupos = new Map();
    
    agendamentos.forEach(ag => {
        const data = ag.data;
        
        // Tentar identificar usuário por diferentes campos
        let identificador = null;
        
        if (data.userEmail) {
            identificador = data.userEmail;
        } else if (data.userId) {
            identificador = data.userId;
        } else if (data.deviceId) {
            identificador = `device_${data.deviceId}`;
        } else {
            identificador = 'unknown_user';
        }
        
        if (!grupos.has(identificador)) {
            grupos.set(identificador, []);
        }
        
        grupos.get(identificador).push(ag);
    });
    
    return grupos;
}

// Função para migrar agendamentos para um usuário específico
async function migrarParaUsuario(userUid, agendamentos) {
    try {
        console.log(`🚀 Migrando ${agendamentos.length} agendamentos para usuário ${userUid}...`);
        
        let migrados = 0;
        let erros = 0;
        
        for (const [index, agendamento] of agendamentos.entries()) {
            try {
                const progresso = `[${index + 1}/${agendamentos.length}]`;
                console.log(`${progresso} Migrando: ${agendamento.id}...`);
                
                // Preparar dados para nova estrutura v2.0
                const dadosOriginais = agendamento.data;
                const novosDados = {
                    // Campos obrigatórios de identificação
                    userId: userUid,
                    userEmail: dadosOriginais.userEmail || `migrated_user_${userUid.substring(0, 8)}@migrated.local`,
                    
                    // Campos principais do produto
                    title: dadosOriginais.title || dadosOriginais.titulo || '',
                    price: dadosOriginais.price || dadosOriginais.preco || '',
                    description: dadosOriginais.description || dadosOriginais.descricao || '',
                    location: dadosOriginais.location || dadosOriginais.localizacao || '',
                    category: dadosOriginais.category || dadosOriginais.categoria || '',
                    subCategory: dadosOriginais.subCategory || '',
                    condition: dadosOriginais.condition || dadosOriginais.condicao || 'usado',
                    disponibilidade: dadosOriginais.disponibilidade || 'disponivel',
                    
                    // Array de imagens padronizado
                    images: (dadosOriginais.images || []).map(img => ({
                        url: img.url || img,
                        path: img.path || null,
                        id: img.id || null,
                        nome: img.nome || img.name || null,
                        tamanho: img.tamanho || img.size || null,
                        tipo: img.tipo || img.type || null
                    })),
                    
                    // Agendamento e status
                    scheduledTime: dadosOriginais.scheduledTime || null,
                    status: dadosOriginais.status || 'pendente',
                    
                    // Timestamps - converter para nova nomenclatura
                    createdAt: dadosOriginais.createdAt || dadosOriginais.criadoEm || new Date(),
                    updatedAt: dadosOriginais.updatedAt || dadosOriginais.atualizadoEm || new Date(),
                    
                    // Campos de controle
                    uniqueKey: dadosOriginais.uniqueKey || null,
                    deviceId: dadosOriginais.deviceId || null,
                    shareToGroups: dadosOriginais.shareToGroups || false,
                    
                    // Metadados da migração
                    version: '2.0',
                    source: 'vendaboost-extension',
                    migratedFrom: agendamento.id,
                    migratedAt: new Date().toISOString(),
                    
                    // Manter dados originais para debug (opcional)
                    _originalData: {
                        id: agendamento.id,
                        hasOldTimestamps: !!(dadosOriginais.criadoEm || dadosOriginais.atualizadoEm)
                    }
                };
                
                // Adicionar na nova estrutura: users/{uid}/agendamentos
                const userAgendamentosRef = collection(db, 'users', userUid, 'agendamentos');
                await addDoc(userAgendamentosRef, novosDados);
                
                console.log(`${progresso} ✅ Migrado com sucesso`);
                migrados++;
                
                // Pausa pequena para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Erro ao migrar ${agendamento.id}:`, error.message);
                erros++;
            }
        }
        
        console.log(`📊 Migração para ${userUid} concluída:`);
        console.log(`   ✅ Migrados: ${migrados}`);
        console.log(`   ❌ Erros: ${erros}`);
        
        return { migrados, erros };
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        return { migrados: 0, erros: agendamentos.length };
    }
}

// Função para backup dos dados antigos
async function criarBackup(agendamentos) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `backup_agendamentos_antes_migracao_${timestamp}.json`;
        
        const backup = {
            timestamp: new Date().toISOString(),
            total: agendamentos.length,
            estrutura: 'antiga_global',
            agendamentos: agendamentos.map(ag => ({
                id: ag.id,
                ...ag.data
            }))
        };
        
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
        console.log(`💾 Backup criado: ${backupPath}`);
        return backupPath;
        
    } catch (error) {
        console.error('❌ Erro ao criar backup:', error.message);
        throw error;
    }
}

// Função para remover dados antigos (opcional)
async function removerDadosAntigos(agendamentos) {
    try {
        console.log('🗑️ Removendo dados da estrutura antiga...');
        
        let removidos = 0;
        let erros = 0;
        
        for (const [index, agendamento] of agendamentos.entries()) {
            try {
                const progresso = `[${index + 1}/${agendamentos.length}]`;
                console.log(`${progresso} Removendo: ${agendamento.id}...`);
                
                const docRef = doc(db, 'agendamentos', agendamento.id);
                await deleteDoc(docRef);
                
                console.log(`${progresso} ✅ Removido`);
                removidos++;
                
                // Pausa pequena
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.error(`❌ Erro ao remover ${agendamento.id}:`, error.message);
                erros++;
            }
        }
        
        console.log(`📊 Remoção concluída:`);
        console.log(`   ✅ Removidos: ${removidos}`);
        console.log(`   ❌ Erros: ${erros}`);
        
        return { removidos, erros };
        
    } catch (error) {
        console.error('❌ Erro na remoção:', error.message);
        return { removidos: 0, erros: agendamentos.length };
    }
}

// Função principal de migração
async function executarMigracao() {
    try {
        console.log('🔄 SCRIPT DE MIGRAÇÃO PARA NOVA ESTRUTURA DE USUÁRIOS');
        console.log('====================================================');
        console.log('Este script migra dados de /agendamentos para /users/{uid}/agendamentos');
        console.log('');
        
        // 1. Buscar agendamentos antigos
        const agendamentosAntigos = await buscarAgendamentosAntigos();
        
        if (agendamentosAntigos.length === 0) {
            console.log('✅ Nenhum agendamento encontrado na estrutura antiga');
            console.log('A migração não é necessária.');
            return;
        }
        
        // 2. Agrupar por usuário
        const grupos = agruparAgendamentosPorUsuario(agendamentosAntigos);
        console.log(`\n👥 Agendamentos agrupados por ${grupos.size} identificadores:`);
        
        grupos.forEach((agendamentos, identificador) => {
            console.log(`   ${identificador}: ${agendamentos.length} agendamentos`);
        });
        
        // 3. Criar backup
        const fazerBackup = await confirmar('\n💾 Criar backup antes da migração?');
        if (fazerBackup) {
            await criarBackup(agendamentosAntigos);
        }
        
        // 4. Processo de migração
        console.log('\n📋 PROCESSO DE MIGRAÇÃO:');
        console.log('Para cada grupo, você precisará fornecer um UID de usuário do Firebase Auth');
        console.log('Os agendamentos serão migrados para /users/{uid}/agendamentos');
        console.log('');
        
        const confirmarMigracao = await confirmar('🚀 Iniciar processo de migração?');
        if (!confirmarMigracao) {
            console.log('❌ Migração cancelada pelo usuário');
            return;
        }
        
        let totalMigrados = 0;
        let totalErros = 0;
        
        // Migrar cada grupo
        for (const [identificador, agendamentos] of grupos.entries()) {
            console.log(`\n🔄 Processando grupo: ${identificador} (${agendamentos.length} agendamentos)`);
            
            // Mostrar exemplos dos agendamentos
            console.log('📋 Exemplos de agendamentos neste grupo:');
            agendamentos.slice(0, 3).forEach((ag, i) => {
                console.log(`   ${i + 1}. "${ag.data.title}" - ${ag.data.status || 'sem status'}`);
            });
            if (agendamentos.length > 3) {
                console.log(`   ... e mais ${agendamentos.length - 3} agendamentos`);
            }
            
            const pular = await confirmar(`\n⏭️  Pular este grupo?`);
            if (pular) {
                console.log('⏭️ Grupo pulado');
                continue;
            }
            
            const userUid = await pergunta('\n🆔 Digite o UID do usuário Firebase Auth para este grupo: ');
            if (!userUid || userUid.length < 10) {
                console.log('❌ UID inválido, pulando grupo...');
                continue;
            }
            
            // Migrar para o usuário
            const resultado = await migrarParaUsuario(userUid, agendamentos);
            totalMigrados += resultado.migrados;
            totalErros += resultado.erros;
        }
        
        // 5. Resumo final
        console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!');
        console.log(`📊 Resumo total:`);
        console.log(`   ✅ Migrados: ${totalMigrados}`);
        console.log(`   ❌ Erros: ${totalErros}`);
        console.log(`   📁 Total processado: ${agendamentosAntigos.length}`);
        
        // 6. Opção de remover dados antigos
        if (totalMigrados > 0) {
            const removerAntigos = await confirmar('\n🗑️ Remover dados da estrutura antiga?');
            if (removerAntigos) {
                await removerDadosAntigos(agendamentosAntigos);
            } else {
                console.log('⚠️ Dados antigos mantidos. Lembre-se de removê-los manualmente depois de verificar a migração.');
            }
        }
        
        console.log('\n✅ Processo de migração finalizado!');
        console.log('📝 Próximos passos:');
        console.log('   1. Testar a extensão com os usuários migrados');
        console.log('   2. Verificar se todos os dados foram migrados corretamente');
        console.log('   3. Se tudo estiver OK, remover dados antigos (se não removeu ainda)');
        
    } catch (error) {
        console.error('❌ Erro fatal na migração:', error.message);
    } finally {
        rl.close();
    }
}

// Função para apenas analisar os dados (sem migrar)
async function analisarDados() {
    try {
        console.log('🔍 ANÁLISE DE DADOS PARA MIGRAÇÃO');
        console.log('==================================');
        
        const agendamentos = await buscarAgendamentosAntigos();
        
        if (agendamentos.length === 0) {
            console.log('✅ Nenhum agendamento encontrado na estrutura antiga');
            return;
        }
        
        const grupos = agruparAgendamentosPorUsuario(agendamentos);
        
        console.log(`\n📊 ANÁLISE DETALHADA:`);
        console.log(`   Total de agendamentos: ${agendamentos.length}`);
        console.log(`   Grupos identificados: ${grupos.size}`);
        console.log('');
        
        grupos.forEach((agendamentos, identificador) => {
            console.log(`📋 Grupo: ${identificador}`);
            console.log(`   Quantidade: ${agendamentos.length} agendamentos`);
            
            // Análise de status
            const porStatus = {};
            agendamentos.forEach(ag => {
                const status = ag.data.status || 'sem_status';
                porStatus[status] = (porStatus[status] || 0) + 1;
            });
            
            console.log(`   Status:`, Object.entries(porStatus).map(([s, q]) => `${s}: ${q}`).join(', '));
            
            // Exemplos
            console.log('   Exemplos:');
            agendamentos.slice(0, 2).forEach((ag, i) => {
                console.log(`     ${i + 1}. "${ag.data.title}" (${ag.data.status || 'sem status'})`);
            });
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Erro na análise:', error.message);
    }
}

// Menu principal
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--analise') || args.includes('--analyze')) {
        await analisarDados();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log('\n📖 AJUDA - SCRIPT DE MIGRAÇÃO');
        console.log('==============================');
        console.log('');
        console.log('Uso: node MigrarDadosParaUsuarios.cjs [opção]');
        console.log('');
        console.log('Opções:');
        console.log('  --analise     Apenas analisar dados sem migrar');
        console.log('  --help        Mostrar esta ajuda');
        console.log('');
        console.log('Sem opções: Executar migração completa (interativa)');
        console.log('');
        console.log('⚠️ IMPORTANTE: Sempre faça backup antes de migrar!');
    } else {
        await executarMigracao();
    }
}

// Executar
if (require.main === module) {
    main().catch(console.error);
} 