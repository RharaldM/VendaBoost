// Background script - Versão usando apenas Dexie (IndexedDB)
// Firebase foi removido - sistema funciona 100% offline com IndexedDB

// Importar novo sistema de storage
import { initializeStorage, storageManager } from './database.js';

// Variável para controlar se o storage foi inicializado
let storageInitialized = false;

// Inicializar storage na inicialização da extensão
const initStorage = initializeStorage().then(() => {
    console.log('[Background] Sistema de storage inicializado com sucesso');
    storageInitialized = true;
    return true;
}).catch(error => {
    console.error('[Background] Erro ao inicializar storage:', error);
    storageInitialized = false;
    throw error;
});

// Função para garantir que o storage está inicializado
async function ensureStorageInitialized() {
    if (!storageInitialized) {
        console.log('[Background] Aguardando inicialização do storage...');
        await initStorage;
    }
    return true;
}

// === UTILITÁRIOS PARA CHAVE ÚNICA E DEVICE ID ===

// Gerar device ID único para este PC
async function getOrCreateDeviceId() {
    try {
        // Garantir que o storage está inicializado
        await ensureStorageInitialized();
        
        let deviceId = await storageManager.getDeviceId();
        
        if (deviceId) {
            return deviceId;
        }
        
        // Criar novo device ID único
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await storageManager.saveDeviceId(deviceId);
        console.log('[Background] Novo Device ID criado:', deviceId);
        
        return deviceId;
    } catch (error) {
        console.error('[Background] Erro ao obter Device ID:', error.message || error);
        return 'device_unknown_' + Date.now();
    }
}

// Gerar chave única baseada em título + data + hora
function generateUniqueKey(title, scheduleDate, scheduleTime) {
    if (!title || !scheduleDate || !scheduleTime) {
        console.warn('[Background] Dados insuficientes para gerar chave única');
        return null;
    }
    
    // Geração de chave única MENOS RESTRITIVA (preserva mais caracteres)
    const normalizedTitle = title.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Preserva letras, números, espaços e hífens
        .replace(/\s+/g, '_')     // Apenas substituir espaços por underscore
        .trim();
    
    // Garantir formato de data consistente (YYYY-MM-DD)
    const normalizedDate = scheduleDate;
    
    // Garantir formato de hora consistente (HH:MM)
    const normalizedTime = scheduleTime;
    
    const uniqueKey = `${normalizedTitle}_${normalizedDate}_${normalizedTime}`;
    console.log(`[Background] Chave única gerada: "${uniqueKey}" para "${title}"`);
    
    return uniqueKey;
}

// Verificar se já existe agendamento com a mesma chave única
async function checkForDuplicateByUniqueKey(uniqueKey) {
    if (!uniqueKey) return false;
    
    try {
        // Verificar localmente
        const localPosts = await storageManager.getScheduledPosts();
        
        const localDuplicate = localPosts.find(post => post.uniqueKey === uniqueKey);
        if (localDuplicate) {
            console.log(`[Background] Duplicata encontrada localmente para chave: ${uniqueKey}`);
            return localDuplicate;
        }
        
        return false;
    } catch (error) {
        console.error('[Background] Erro ao verificar duplicatas por chave única:', error);
        return false;
    }
}

// === FIM DOS UTILITÁRIOS ===

chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
    console.log("[Extensão] Detecção de mudança de URL (SPA), verificando contexto antes de reinjetar...");

    // Verificar se o contexto ainda é válido antes de reinjetar
    try {
        chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            files: ["content.js"]
        }, () => {
            if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    console.log("[Background] Contexto invalidado, não é possível reinjetar content script");
                } else {
                    console.error("Erro ao reinjetar content script:", chrome.runtime.lastError.message);
                }
            } else {
                console.log("Content script reinjetado com sucesso.");
            }
        });
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log("[Background] Contexto invalidado, não é possível reinjetar content script");
        } else {
            console.error("Erro ao tentar reinjetar content script:", error);
        }
    }
}, { url: [{ hostContains: 'facebook.com' }] });

// Gerenciamento de posts agendados
let scheduledPosts = [];
let postQueue = [];

// Função para normalizar status vindos do storage local
function normalizePostStatus(status) {
    if (!status) return 'scheduled';
    
    // Mapear diferentes variações de status para valores padronizados
    const statusMap = {
        // Status -> Status normalizado
        'posting': 'posting',
        'scheduled': 'scheduled', 
        'agendado': 'scheduled',
        'executando': 'posting',
        'executado': 'completed',
        'publicado': 'completed',
        'completed': 'completed',
        'concluido': 'completed',
        'concluído': 'completed',
        'falhou': 'failed',
        'failed': 'failed',
        'erro': 'failed',
        'error': 'failed',
        'draft': 'draft',
        'rascunho': 'draft'
    };
    
    // Converter para minúsculas para comparação
    const normalizedInput = status.toString().toLowerCase().trim();
    
    // Retornar status mapeado ou o original se não encontrado
    const mappedStatus = statusMap[normalizedInput] || normalizedInput;
    
    console.log(`[Background Status Normalize] "${status}" -> "${mappedStatus}"`);
    return mappedStatus;
}

// Função para sincronizar scheduledPosts com IndexedDB
async function syncScheduledPosts() {
    try {
        const posts = await storageManager.getScheduledPosts();
        scheduledPosts = posts;
        console.log('[Background] Posts sincronizados do IndexedDB:', scheduledPosts.length);
    } catch (error) {
        console.error('[Background] Erro ao sincronizar posts do IndexedDB:', error);
    }
}

// Inicializar sincronização na inicialização
syncScheduledPosts();

// Armazenar tabs que estão prontas para receber mensagens
const readyTabs = new Set();

// Função para aguardar que o content script fique pronto
function waitForContentScript(tabId, timeout = 15000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        console.log(`[Background] Aguardando content script para aba ${tabId}...`);
        
        const checkReady = () => {
            if (readyTabs.has(tabId)) {
                console.log(`[Background] Content script pronto para aba ${tabId}`);
                resolve(true);
            } else if (Date.now() - startTime >= timeout) {
                console.log(`[Background] Timeout aguardando content script para aba ${tabId}`);
                resolve(false);
            } else {
                setTimeout(checkReady, 500);
            }
        };
        
        checkReady();
    });
}

// Listener para mensagens do popup - VERSÃO SEM FIREBASE
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Mensagem recebida:", request.action || request.type);

    // Handle authentication messages
    if (request.type === 'LOGIN_SUCCESS') {
        console.log('[Background] Login success received:', request.user?.username);
        
        // Store authentication data
        chrome.storage.local.set({
            vendaboost_auth_token: request.token,
            vendaboost_user_data: request.user,
            vendaboost_last_auth_check: Date.now()
        }, () => {
            console.log('[Background] Auth data stored successfully');
            
            // Notify all extension pages about successful login
            chrome.runtime.sendMessage({
                type: 'AUTH_STATUS_CHANGED',
                authenticated: true,
                user: request.user
            }).catch(err => console.log('[Background] No listeners for auth update'));
            
            sendResponse({ success: true });
        });
        
        return true; // Will respond asynchronously
    }

    // Estrutura unificada para lidar com todas as ações
    (async () => {
        try {
            // Garantir que o storage está inicializado para todas as operações
            await ensureStorageInitialized();
            
            switch (request.action) {
                // Ações da OpenAI
                case 'testOpenAI':
                    try {
                        const result = await testOpenAIConnection(request.apiKey);
                        sendResponse(result);
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'improveDescription':
                    try {
                        // Use StorageManager method to get API key
                        const apiKey = await storageManager.getSetting('openaiApiKey');
                        if (!apiKey) {
                            sendResponse({ success: false, error: 'API Key não configurada no storage.' });
                            return;
                        }
                        const prompt = buildOpenAIPrompt(request.description);
                        const result = await callOpenAIAPI(apiKey, prompt);
                        
                        if (result.success) {
                            sendResponse({
                                success: true,
                            improvedDescription: result.improvedText,
                            tokensUsed: result.tokensUsed
                        });
                    } else {
                        sendResponse({ success: false, error: result.error });
                    }
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            // Ações do content script
            case "contentScriptReady":
                console.log("[Background] Content script pronto na tab:", sender.tab.id);
                readyTabs.add(sender.tab.id);
                sendResponse({ status: "Prontidão confirmada" });
                break;
            
            case "heartbeat":
                console.log("[Background] Heartbeat recebido da tab:", sender.tab.id);
                readyTabs.add(sender.tab.id);
                sendResponse({ status: "Heartbeat confirmado" });
                break;

            case 'schedulePost':
                await handleSchedulePost(request.postData, sendResponse);
                break;

            case 'scheduleMultiplePosts':
                await handleScheduleMultiplePosts(request.posts, sendResponse);
                break;

            case 'getQueueStatus':
                await syncScheduledPosts();
                
                // Usar apenas dados locais
                const normalizedLocalPosts = scheduledPosts.map(post => ({
                    ...post,
                    status: normalizePostStatus(post.status)
                }));
                sendResponse({ success: true, queue: normalizedLocalPosts });
                break;

            case 'clearCompleted':
                await handleClearCompleted(sendResponse);
                break;

            case 'deletePost':
                await handleDeletePost(request.postId, sendResponse);
                break;

            case 'executeImmediatePost':
                await handleExecuteImmediatePost(request.postData, sendResponse);
                break;

            default:
                sendResponse({ success: false, error: `Ação não reconhecida: ${request.action}` });
        }
        } catch (error) {
            console.error('[Background] Erro ao processar mensagem:', error);
            sendResponse({ success: false, error: `Erro interno: ${error.message}` });
        }
    })();
    
    return true; // Manter o canal de resposta aberto
});

// Limpar tabs prontas quando fechadas
chrome.tabs.onRemoved.addListener((tabId) => {
    readyTabs.delete(tabId);
});

// Agendar post (ATUALIZADO sem Firebase)
async function handleSchedulePost(postData, sendResponse) {
    try {
        // Garantir que o storage está inicializado antes de qualquer operação
        await ensureStorageInitialized();
        
        // Validar dados
        if (!postData.title || !postData.description || !postData.location) {
            sendResponse({ success: false, error: 'Dados obrigatórios faltando' });
            return;
        }

        console.log('[Background] Iniciando agendamento de post:', postData.title);

        // Gerar chave única para evitar duplicatas
        const uniqueKey = generateUniqueKey(postData.title, postData.scheduleDate, postData.scheduleTime);
        if (!uniqueKey) {
            sendResponse({ success: false, error: 'Não foi possível gerar chave única do post' });
            return;
        }

        // Verificar duplicata por chave única
        const duplicatePost = await checkForDuplicateByUniqueKey(uniqueKey);
        if (duplicatePost) {
            console.warn(`[Background] Post duplicado detectado: "${uniqueKey}"`);
            sendResponse({ 
                success: false, 
                error: `Post duplicado: "${postData.title}" já foi agendado para ${postData.scheduleDate} às ${postData.scheduleTime}`,
                isDuplicate: true,
                duplicatePost: duplicatePost
            });
            return;
        }

        // Obter device ID
        const deviceId = await getOrCreateDeviceId();

        // Criar ID único local
        const id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Criar timestamp para ordenação
        const scheduleDateTime = new Date(`${postData.scheduleDate}T${postData.scheduleTime}`);

        // Adicionar metadados ao post
        const fullPostData = {
            ...postData,
            id: id,
            uniqueKey: uniqueKey,
            deviceId: deviceId,
            status: 'scheduled',
            scheduledTime: scheduleDateTime.getTime(), // Add timestamp for sorting
            created_at: new Date(),
            updated_at: new Date()
        };

        console.log('[Background] Dados do post preparados:', {
            id: fullPostData.id,
            title: fullPostData.title,
            uniqueKey: fullPostData.uniqueKey,
            deviceId: fullPostData.deviceId,
            status: fullPostData.status
        });

        // Salvar no IndexedDB
        try {
            console.log('[Background] Tentando salvar post no IndexedDB...', {
                id: fullPostData.id,
                uniqueKey: fullPostData.uniqueKey
            });
            
            await storageManager.addScheduledPost(fullPostData);
            console.log('[Background] ✅ Post salvo no IndexedDB com sucesso:', fullPostData.id);
            
            // Verificar se foi realmente salvo
            const savedPost = await storageManager.getScheduledPost(fullPostData.id);
            if (savedPost) {
                console.log('[Background] ✅ Verificação: Post encontrado na base de dados:', savedPost.id);
            } else {
                console.error('[Background] ❌ ERRO CRÍTICO: Post não foi encontrado após salvamento!');
                sendResponse({ success: false, error: 'Post não foi salvo corretamente no banco de dados' });
                return;
            }
        } catch (error) {
            console.error('[Background] ❌ Erro ao salvar no IndexedDB:', error);
            sendResponse({ success: false, error: `Erro ao salvar no banco local: ${error.message}` });
            return;
        }

        // Atualizar array local
        scheduledPosts.push(fullPostData);

        // Agendar alarme usando o timestamp já calculado
        chrome.alarms.create(`post_${fullPostData.id}`, { when: scheduleDateTime.getTime() });

        console.log(`[Background] ✅ Post agendado com sucesso: ID ${fullPostData.id}`);
        console.log(`[Background] ⏰ Alarme criado para: ${scheduleDateTime.toLocaleString()}`);

        sendResponse({ 
            success: true, 
            message: `Post "${postData.title}" agendado para ${scheduleDateTime.toLocaleString()}`,
            postId: fullPostData.id,
            uniqueKey: fullPostData.uniqueKey
        });

    } catch (error) {
        console.error('[Background] Erro ao agendar post:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Agendar múltiplos posts
async function handleScheduleMultiplePosts(posts, sendResponse) {
    try {
        console.log(`[Background] Agendando ${posts.length} posts...`);
        
        const results = [];
        const deviceId = await getOrCreateDeviceId();
        
        for (let i = 0; i < posts.length; i++) {
            const postData = posts[i];
            
            try {
                // Gerar chave única
                const uniqueKey = generateUniqueKey(postData.title, postData.scheduleDate, postData.scheduleTime);
                if (!uniqueKey) {
                    results.push({
                        index: i,
                        success: false,
                        error: 'Não foi possível gerar chave única',
                        title: postData.title
                    });
                    continue;
                }

                // Verificar duplicata
                const duplicatePost = await checkForDuplicateByUniqueKey(uniqueKey);
                if (duplicatePost) {
                    results.push({
                        index: i,
                        success: false,
                        error: 'Post duplicado',
                        title: postData.title,
                        isDuplicate: true
                    });
                    continue;
                }

                // Criar ID único local
                const id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + i;

                // Preparar dados do post
                const fullPostData = {
                    ...postData,
                    id: id,
                    uniqueKey: uniqueKey,
                    deviceId: deviceId,
                    status: 'scheduled',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                // Salvar no IndexedDB
                await storageManager.addScheduledPost(fullPostData);
                
                // Atualizar array local
                scheduledPosts.push(fullPostData);

                // Agendar alarme
                const scheduleDateTime = new Date(`${postData.scheduleDate}T${postData.scheduleTime}`);
                chrome.alarms.create(`post_${fullPostData.id}`, { when: scheduleDateTime.getTime() });

                results.push({
                    index: i,
                    success: true,
                    postId: fullPostData.id,
                    title: postData.title
                });

                console.log(`[Background] Post ${i + 1}/${posts.length} agendado: ${postData.title}`);

            } catch (error) {
                console.error(`[Background] Erro no post ${i + 1}:`, error);
                results.push({
                    index: i,
                    success: false,
                    error: error.message,
                    title: postData.title
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        console.log(`[Background] ✅ ${successCount} posts agendados, ❌ ${failCount} falharam`);
        
        sendResponse({
            success: true,
            results: results,
            summary: {
                total: posts.length,
                success: successCount,
                failed: failCount
            }
        });

    } catch (error) {
        console.error('[Background] Erro ao processar fila de posts:', error);
        sendResponse({
            success: false,
            error: `Erro ao processar fila de posts: ${error.message}`
        });
    }
}

// Limpar posts completados
async function handleClearCompleted(sendResponse) {
    try {
        await syncScheduledPosts();
        
        // Encontrar posts completados
        const completedPosts = scheduledPosts.filter(post => 
            post.status === 'completed' || post.status === 'concluído' || post.status === 'publicado'
        );
        
        if (completedPosts.length === 0) {
            sendResponse({ success: true, message: 'Nenhum post completado encontrado' });
            return;
        }
        
        // Remover do IndexedDB
        for (const post of completedPosts) {
            await storageManager.deleteScheduledPost(post.id);
        }
        
        // Atualizar array local
        scheduledPosts = scheduledPosts.filter(post => 
            post.status !== 'completed' && post.status !== 'concluído' && post.status !== 'publicado'
        );
        
        console.log(`[Background] ${completedPosts.length} posts completados removidos`);
        
        sendResponse({ 
            success: true, 
            message: `${completedPosts.length} posts completados removidos`,
            removedCount: completedPosts.length
        });
        
    } catch (error) {
        console.error('[Background] Erro ao limpar posts completados:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Deletar post específico
async function handleDeletePost(postId, sendResponse) {
    try {
        await syncScheduledPosts();
        
        // Encontrar o post
        const postIndex = scheduledPosts.findIndex(post => post.id === postId);
        if (postIndex === -1) {
            sendResponse({ success: false, error: 'Post não encontrado' });
            return;
        }
        
        const post = scheduledPosts[postIndex];
        
        // Remover do IndexedDB
        await storageManager.deleteScheduledPost(postId);
        
        // Remover do array local
        scheduledPosts.splice(postIndex, 1);
        
        // Remover alarme se existir
        chrome.alarms.clear(`post_${postId}`);
        
        console.log(`[Background] Post deletado: ${post.title} (ID: ${postId})`);
        
        sendResponse({ 
            success: true, 
            message: `Post "${post.title}" deletado com sucesso`
        });
        
    } catch (error) {
        console.error('[Background] Erro ao deletar post:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Executar postagem imediata
async function handleExecuteImmediatePost(postData, sendResponse) {
    try {
        console.log('[Background] Iniciando execução de postagem imediata:', postData.title);
        
        // Validar dados
        if (!postData.title || !postData.description) {
            sendResponse({ success: false, error: 'Dados obrigatórios faltando' });
            return;
        }
        
        // Gerar ID único para a postagem imediata
        const uniqueKey = generateUniqueKey(postData.title, postData.scheduleDate, postData.scheduleTime);
        const deviceId = await getOrCreateDeviceId();
        const id = 'immediate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Adicionar metadados ao post
        postData.id = id;
        postData.uniqueKey = uniqueKey;
        postData.deviceId = deviceId;
        postData.status = 'posting';
        postData.created_at = new Date();
        postData.updated_at = new Date();
        
        console.log('[Background] Dados da postagem imediata preparados:', {
            id: postData.id,
            title: postData.title,
            status: postData.status
        });
        
        // Salvar no IndexedDB
        await storageManager.addScheduledPost(postData);
        scheduledPosts.push(postData);
        
        // Executar postagem imediata
        await executePost(postData);
        
        // Responder imediatamente que a postagem foi iniciada
        sendResponse({ success: true, message: 'Postagem imediata iniciada com sucesso' });
        
    } catch (error) {
        console.error('[Background] Erro na postagem imediata:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Listener para alarmes (posts agendados)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('post_')) {
        const postId = alarm.name.replace('post_', '');
        executeScheduledPost(postId);
    }
});

// Executar post agendado automaticamente
async function executeScheduledPost(postId) {
    console.log('[Background] Alarme disparado para post:', postId);
    await syncScheduledPosts();
    const post = scheduledPosts.find(p => p.id === postId);

    if (!post) {
        console.error(`Post com ID ${postId} não encontrado para execução.`);
        return;
    }

    console.log(`Executando post agendado: "${post.title}"`);
    if (post.groupName) {
        console.log(`--> Alvo: Grupo "${post.groupName}"`);
    }

    // Atualizar status para 'posting'
    post.status = 'posting';
    post.updated_at = new Date();
    
    await storageManager.updateScheduledPost(post.id, { 
        status: 'posting', 
        updated_at: post.updated_at 
    });

    // Executar o post
    await executePost(post);
}

// Função para executar um post (comum para agendados e imediatos)
async function executePost(post) {
    try {
        // Construir URL baseada no tipo de destino
        let targetUrl;
        
        console.log('[Background] Post data:', {
            targetType: post.targetType,
            groupId: post.groupId,
            title: post.title
        });
        
        if (post.targetType === 'groups' && post.groupId) {
            // Publicar em grupo específico
            targetUrl = `https://www.facebook.com/groups/${post.groupId}`;
            console.log(`[Background] Posting to GROUP: ${post.groupName || post.groupId}`);
        } else {
            // Publicar no Marketplace (default)
            targetUrl = 'https://www.facebook.com/marketplace/create/item';
            console.log('[Background] Posting to MARKETPLACE');
        }

        console.log(`[Background] Abrindo ${targetUrl} para execução do post`);

        // Abrir nova aba
        chrome.tabs.create({ url: targetUrl }, async (tab) => {
            if (chrome.runtime.lastError) {
                console.error('[Background] Erro ao criar aba:', chrome.runtime.lastError);
                await updatePostStatus(post.id, 'failed', 'Erro ao abrir aba do Facebook');
                return;
            }

            console.log('[Background] Nova aba criada, aguardando carregamento...');
            aguardarCarregamentoEExecutar(tab.id, post);
        });

    } catch (error) {
        console.error('[Background] Erro na execução do post:', error);
        await updatePostStatus(post.id, 'failed', error.message);
    }
}

// Aguardar carregamento da aba e executar postagem
async function aguardarCarregamentoEExecutar(tabId, postData) {
    try {
        console.log(`[Background] Aguardando content script para aba ${tabId}...`);
        
        const isReady = await waitForContentScript(tabId);
        
        if (!isReady) {
            console.error('[Background] Content script não ficou pronto a tempo');
            await updatePostStatus(postData.id, 'failed', 'Content script não respondeu');
            return;
        }

        console.log('[Background] Content script pronto, enviando dados do post...');

        // Enviar dados para o content script
        chrome.tabs.sendMessage(tabId, {
            action: 'preencherEPublicar',
            postData: postData
        }, async (response) => {
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                console.error('[Background] Erro ao enviar mensagem:', errorMsg);
                await updatePostStatus(postData.id, 'failed', `Erro de comunicação: ${errorMsg}`);
                return;
            }

            if (response && response.success) {
                console.log('[Background] ✅ Post executado com sucesso');
                await updatePostStatus(postData.id, 'completed', 'Post publicado com sucesso');
            } else {
                console.error('[Background] ❌ Falha na execução do post:', response?.error);
                await updatePostStatus(postData.id, 'failed', response?.error || 'Erro desconhecido');
            }
        });

    } catch (error) {
        console.error('[Background] Erro durante execução:', error);
        await updatePostStatus(postData.id, 'failed', error.message);
    }
}

// Atualizar status do post
async function updatePostStatus(postId, status, message = null) {
    try {
        // Atualizar no array local
        const post = scheduledPosts.find(p => p.id === postId);
        if (post) {
            post.status = status;
            post.updated_at = new Date();
            if (message) {
                post.lastMessage = message;
            }
        }

        // Atualizar no IndexedDB
        const updateData = { 
            status: status, 
            updated_at: new Date()
        };
        if (message) {
            updateData.lastMessage = message;
        }
        
        await storageManager.updateScheduledPost(postId, updateData);
        
        console.log(`[Background] Status do post ${postId} atualizado para: ${status}`);
        if (message) {
            console.log(`[Background] Mensagem: ${message}`);
        }

    } catch (error) {
        console.error('[Background] Erro ao atualizar status do post:', error);
    }
}

// === INTEGRAÇÃO OPENAI ===

async function testOpenAIConnection(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
        return { success: false, error: 'API Key não fornecida' };
    }

    try {
        console.log('[Background] Testando conexão OpenAI...');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'VendaBoost-Extension/1.0'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'user',
                    content: 'Hello'
                }],
                max_tokens: 5,
                temperature: 0
            })
        });

        console.log('[Background] Teste OpenAI, status:', response.status);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (parseError) {
                console.warn('[Background] Erro ao parsear resposta de erro:', parseError);
            }
            return { success: false, error: errorMessage };
        }

        const data = await response.json();
        console.log('[Background] Teste OpenAI bem-sucedido');
        
        return { success: true, data };
        
    } catch (error) {
        console.error('[Background] Erro no teste OpenAI:', error);
        
        let errorMessage = error.message;
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        }
        
        return { success: false, error: errorMessage };
    }
}

async function callOpenAIAPI(apiKey, prompt) {
    try {
        console.log('[Background] Chamando OpenAI API...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'VendaBoost-Extension/1.0'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 500,
                temperature: 0.7,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            })
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (parseError) {
                console.warn('[Background] Erro ao parsear resposta de erro OpenAI:', parseError);
            }
            return { success: false, error: errorMessage };
        }

        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            return { success: false, error: 'Resposta inválida da OpenAI' };
        }

        const improvedText = data.choices[0].message.content.trim();
        const tokensUsed = data.usage?.total_tokens || 0;

        console.log('[Background] ✅ Descrição melhorada com sucesso');
        console.log(`[Background] Tokens utilizados: ${tokensUsed}`);

        // Salvar estatísticas de uso
        try {
            await storageManager.saveOpenAIUsage({
                tokens: tokensUsed,
                cost: (tokensUsed * 0.002) / 1000, // Estimativa de custo
                requests: 1
            });
        } catch (saveError) {
            console.warn('[Background] Erro ao salvar estatísticas OpenAI:', saveError);
        }

        return {
            success: true,
            improvedText: improvedText,
            tokensUsed: tokensUsed
        };

    } catch (error) {
        console.error('[Background] Erro na chamada OpenAI:', error);
        
        let errorMessage = error.message;
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        }
        
        return { success: false, error: errorMessage };
    }
}

function buildOpenAIPrompt(originalDescription) {
    return `Melhore esta descrição de produto para o Facebook Marketplace. Torne-a mais atrativa, persuasiva e otimizada para vendas, mantendo todas as informações importantes:

DESCRIÇÃO ORIGINAL:
"${originalDescription}"

INSTRUÇÕES:
- Mantenha todas as informações técnicas e características importantes
- Use linguagem persuasiva e atrativa
- Destaque benefícios e diferenciais
- Adicione call-to-action sutil
- Mantenha o tom profissional mas acessível
- Limite a 400 caracteres
- Use emojis estrategicamente (máximo 3)
- Foque em despertar interesse e urgência

DESCRIÇÃO MELHORADA:`;
}

console.log('[Background] ✅ Background script carregado - Sistema 100% offline com Dexie/IndexedDB');