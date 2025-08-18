// openai-integration.js - Integração com OpenAI GPT para melhorar descrições

import { storageManager } from './database.js';

class OpenAIIntegration {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
        this.model = 'gpt-3.5-turbo';
        this.maxTokens = 300;
        this.temperature = 0.7;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            // Carregar API key do storage
            const apiKey = await storageManager.getLightData('openaiApiKey');
            if (apiKey) {
                this.apiKey = apiKey;
                this.isInitialized = true;
                console.log('[OpenAI] API Key carregada do storage');
            } else {
                console.log('[OpenAI] API Key não encontrada - usuário precisa configurar');
            }
        } catch (error) {
            console.error('[OpenAI] Erro ao inicializar:', error);
        }
    }

    // Configurar API Key
    async setApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return { success: false, message: 'API Key inválida' };
        }
        
        // Validação básica do formato
        if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
            return { success: false, message: 'Formato de API Key inválido. Deve começar com "sk-"' };
        }

        try {
            // Salvar diretamente sem testar (o teste será feito separadamente)
            this.apiKey = apiKey;
            this.isInitialized = true;
            
            // Salvar no storage
            await storageManager.setLightData('openaiApiKey', apiKey);
            console.log('[OpenAI] API Key configurada e salva com sucesso');
            
            return { success: true, message: 'API Key configurada com sucesso!' };
        } catch (error) {
            console.error('[OpenAI] Erro ao configurar API Key:', error);
            return { success: false, message: `Erro ao salvar API Key: ${error.message}` };
        }
    }

    // Testar API Key via background script
    async testApiKey(apiKey) {
        if (!apiKey) {
            throw new Error('API Key não fornecida');
        }
        
        try {
            console.log('[OpenAI] Enviando teste para background script...');
            
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'testOpenAI',
                    apiKey: apiKey
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[OpenAI] Erro de comunicação:', chrome.runtime.lastError);
                        reject(new Error('Erro de comunicação com background script'));
                        return;
                    }
                    
                    if (response.success) {
                        console.log('[OpenAI] Teste bem-sucedido via background script');
                        resolve({ success: true, data: response.data });
                    } else {
                        console.error('[OpenAI] Erro no teste:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });
            
        } catch (error) {
            console.error('[OpenAI] Erro no teste da API Key:', error);
            throw error;
        }
    }

    // Verificar se está configurado
    isConfigured() {
        return this.isInitialized && this.apiKey !== null;
    }

    // Obter API Key atual (mascarada para segurança)
    getMaskedApiKey() {
        if (!this.apiKey) return null;
        
        const key = this.apiKey;
        if (key.length <= 8) return '***';
        
        return key.substring(0, 4) + '***' + key.substring(key.length - 4);
    }

    // Remover API Key
    async removeApiKey() {
        try {
            this.apiKey = null;
            this.isInitialized = false;
            await storageManager.removeLightData('openaiApiKey');
            console.log('[OpenAI] API Key removida');
            return { success: true, message: 'API Key removida com sucesso!' };
        } catch (error) {
            console.error('[OpenAI] Erro ao remover API Key:', error);
            throw new Error('Erro ao remover API Key');
        }
    }

    // Melhorar descrição usando GPT via background script
    async improveDescription(originalDescription) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI não está configurado. Configure sua API Key primeiro.');
        }

        if (!originalDescription || originalDescription.trim().length === 0) {
            throw new Error('Descrição original não pode estar vazia');
        }

        try {
            console.log('[OpenAI] Enviando requisição para background script...');
            
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'improveDescription',
                    apiKey: this.apiKey,
                    description: originalDescription
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[OpenAI] Erro de comunicação:', chrome.runtime.lastError);
                        reject(new Error('Erro de comunicação com background script'));
                        return;
                    }
                    
                    if (response.success) {
                        console.log('[OpenAI] Descrição melhorada com sucesso via background script');
                        resolve({
                            success: true,
                            originalDescription,
                            improvedDescription: response.improvedDescription,
                            tokensUsed: response.tokensUsed || 0
                        });
                    } else {
                        console.error('[OpenAI] Erro na melhoria:', response.error);
                        reject(new Error(response.error));
                    }
                });
            });

        } catch (error) {
            console.error('[OpenAI] Erro ao melhorar descrição:', error);
            throw error;
        }
    }

    // Construir prompt otimizado para melhorar descrições
    buildPrompt(originalDescription) {
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

    // Obter estatísticas de uso
    async getUsageStats() {
        try {
            const stats = await storageManager.getOpenAIUsage();
            if (stats.length === 0) {
                return {
                    totalRequests: 0,
                    totalTokens: 0,
                    lastUsed: null,
                    successfulRequests: 0,
                    failedRequests: 0
                };
            }
            
            // Agregar estatísticas de todos os registros
            return stats.reduce((acc, stat) => {
                acc.totalRequests += stat.requests || 1;
                acc.totalTokens += stat.tokens || 0;
                acc.lastUsed = stat.date > acc.lastUsed ? stat.date : acc.lastUsed;
                return acc;
            }, {
                totalRequests: 0,
                totalTokens: 0,
                lastUsed: null,
                successfulRequests: 0,
                failedRequests: 0
            });
        } catch (error) {
            console.error('[OpenAI] Erro ao obter estatísticas:', error);
            return null;
        }
    }

    // Atualizar estatísticas de uso
    async updateUsageStats(tokensUsed, success = true) {
        try {
            await storageManager.saveOpenAIUsage({
                tokens: tokensUsed || 0,
                cost: (tokensUsed || 0) * 0.002, // Estimativa de custo
                requests: 1
            });
        } catch (error) {
            console.error('[OpenAI] Erro ao atualizar estatísticas:', error);
        }
    }
}

// Exportar instância global
const openAIIntegration = new OpenAIIntegration();
export default openAIIntegration;

// Disponibilizar globalmente para uso no popup
if (typeof window !== 'undefined') {
    window.openAIIntegration = openAIIntegration;
}
