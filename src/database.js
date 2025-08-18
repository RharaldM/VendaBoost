import Dexie from 'dexie';

export class VendaBoostDB extends Dexie {
    constructor() {
        super('VendaBoostDB');
        
        // Jump to version 6 to force upgrade with correct field names
        this.version(6).stores({
            grupos: '++id, nome, descricao, avatar, tipo, categoria, created_at, updated_at',
            settings: '++id, key, value, updated_at',
            scheduledPosts: '++id, groupId, title, description, images, scheduleDate, scheduleTime, scheduledTime, status, created_at, deviceId, uniqueKey, location, category, condition, price',
            users: '++id, uid, email, displayName, photoURL, created_at, lastLogin',
            devices: '++id, deviceId, deviceName, lastSync, isActive',
            openaiUsage: '++id, date, tokens, cost, requests'
        });

        // Initialize table references properly
        this.grupos = this.table('grupos');
        this.settings = this.table('settings');
        this.scheduledPosts = this.table('scheduledPosts');
        this.users = this.table('users');
        this.devices = this.table('devices');
        this.openaiUsage = this.table('openaiUsage');
    }

    async getScheduledPosts() {
        return await this.scheduledPosts.orderBy('scheduledTime').toArray();
    }

    async getScheduledPost(id) {
        return await this.scheduledPosts.where('id').equals(id).first();
    }

    async addScheduledPost(post) {
        return await this.scheduledPosts.add({
            ...post,
            created_at: new Date()
        });
    }
}

export const db = new VendaBoostDB();

export class StorageManager {
    constructor() {
        this.db = null; // Initialize as null
        this.isInitialized = false;
    }

    // Ensure database is initialized before any operation
    async ensureInitialized() {
        if (!this.isInitialized) {
            this.db = db;
            await this.db.open();
            this.isInitialized = true;
        }
        return this.db;
    }

    // Configurações - IndexedDB
    async saveSetting(key, value) {
        await this.ensureInitialized();
        const existingSetting = await this.db.settings.where('key').equals(key).first();
        if (existingSetting) {
            return await this.db.settings.update(existingSetting.id, { 
                value: JSON.stringify(value), 
                updated_at: new Date() 
            });
        } else {
            return await this.db.settings.add({ 
                key, 
                value: JSON.stringify(value), 
                updated_at: new Date()
            });
        }
    }

    async getSetting(key, defaultValue = null) {
        await this.ensureInitialized();
        const setting = await this.db.settings.where('key').equals(key).first();
        return setting ? JSON.parse(setting.value) : defaultValue;
    }

    async getSettings() {
        await this.ensureInitialized();
        const settings = await this.db.settings.toArray();
        const result = {};
        settings.forEach(setting => {
            result[setting.key] = JSON.parse(setting.value);
        });
        return result;
    }

    // Grupos - IndexedDB
    async saveGrupos(grupos) {
        await this.ensureInitialized();
        await this.db.grupos.clear();
        return await this.db.grupos.bulkAdd(grupos.map(grupo => ({
            ...grupo,
            created_at: grupo.created_at || new Date(),
            updated_at: new Date()
        })));
    }

    async getGrupos() {
        await this.ensureInitialized();
        return await this.db.grupos.orderBy('updated_at').reverse().toArray();
    }

    async addGrupo(grupo) {
        await this.ensureInitialized();
        return await this.db.grupos.add({
            ...grupo,
            created_at: new Date(),
            updated_at: new Date()
        });
    }

    async updateGrupo(id, updates) {
        await this.ensureInitialized();
        return await this.db.grupos.update(id, {
            ...updates,
            updated_at: new Date()
        });
    }

    async deleteGrupo(id) {
        await this.ensureInitialized();
        return await this.db.grupos.delete(id);
    }

    // Posts Agendados - IndexedDB
    async saveScheduledPosts(posts) {
        await this.ensureInitialized();
        await this.db.scheduledPosts.clear();
        return await this.db.scheduledPosts.bulkAdd(posts.map(post => ({
            ...post,
            created_at: post.created_at || new Date()
        })));
    }

    async getScheduledPosts() {
        await this.ensureInitialized();
        const posts = await this.db.scheduledPosts.orderBy('scheduledTime').toArray();
        console.log('[Database] Retrieved scheduled posts:', posts.length);
        if (posts.length > 0) {
            console.log('[Database] Sample post:', {
                id: posts[0].id,
                title: posts[0].title,
                status: posts[0].status,
                created_at: posts[0].created_at
            });
        }
        return posts;
    }

    async getScheduledPost(id) {
        await this.ensureInitialized();
        return await this.db.scheduledPosts.get(id);
    }

    async addScheduledPost(post) {
        await this.ensureInitialized();
        console.log('[Database] Adding scheduled post:', {
            id: post.id,
            title: post.title,
            status: post.status,
            scheduleDate: post.scheduleDate,
            scheduleTime: post.scheduleTime
        });
        
        const result = await this.db.scheduledPosts.add({
            ...post,
            created_at: new Date()
        });
        
        console.log('[Database] ✅ Post added with ID:', result);
        
        // Immediate verification
        const count = await this.db.scheduledPosts.count();
        console.log('[Database] Total posts in DB after add:', count);
        
        return result;
    }

    async updateScheduledPost(id, updates) {
        await this.ensureInitialized();
        return await this.db.scheduledPosts.update(id, updates);
    }

    async deleteScheduledPost(id) {
        await this.ensureInitialized();
        return await this.db.scheduledPosts.delete(id);
    }

    async getScheduledPostsByStatus(status) {
        await this.ensureInitialized();
        return await this.db.scheduledPosts.where('status').equals(status).toArray();
    }

    // Usuários - IndexedDB
    async saveCurrentUser(userData) {
        await this.ensureInitialized();
        await this.db.users.clear();
        return await this.db.users.add({
            ...userData,
            created_at: userData.created_at || new Date(),
            lastLogin: new Date()
        });
    }

    async getCurrentUser() {
        await this.ensureInitialized();
        return await this.db.users.orderBy('lastLogin').reverse().first();
    }

    async clearCurrentUser() {
        await this.ensureInitialized();
        return await this.db.users.clear();
    }

    // Device ID - IndexedDB
    async saveDeviceId(deviceId) {
        try {
            await this.ensureInitialized();
            const existing = await this.db.devices.where('deviceId').equals(deviceId).first();
            if (existing) {
                return await this.db.devices.update(existing.id, { 
                    lastSync: new Date(),
                    isActive: 1 // Usar 1 em vez de true para compatibilidade
                });
            } else {
                return await this.db.devices.add({
                    deviceId,
                    deviceName: navigator.userAgent,
                    lastSync: new Date(),
                    isActive: 1 // Usar 1 em vez de true para compatibilidade
                });
            }
        } catch (error) {
            console.error('[Database] Erro ao salvar Device ID:', error);
            throw error;
        }
    }

    async getDeviceId() {
        try {
            await this.ensureInitialized();
            // Buscar dispositivo ativo - usar 1 em vez de true para compatibilidade
            const device = await this.db.devices.where('isActive').equals(1).first();
            if (device) {
                return device.deviceId;
            }
            
            // Fallback: buscar qualquer dispositivo se não houver ativo
            const anyDevice = await this.db.devices.orderBy('lastSync').reverse().first();
            return anyDevice ? anyDevice.deviceId : null;
        } catch (error) {
            console.error('[Database] Erro ao buscar Device ID:', error);
            return null;
        }
    }

    // OpenAI Usage - IndexedDB
    async saveOpenAIUsage(stats) {
        await this.ensureInitialized();
        return await this.db.openaiUsage.add({
            ...stats,
            date: new Date()
        });
    }

    async getOpenAIUsage() {
        await this.ensureInitialized();
        return await this.db.openaiUsage.orderBy('date').reverse().toArray();
    }

    // Métodos para Chrome Storage (coisas leves)
    async setLightData(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }

    async getLightData(key, defaultValue = null) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    }

    async removeLightData(key) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(key, resolve);
        });
    }

    // Migração de dados existentes
    async migrateFromChromeStorage() {
        console.log('Iniciando migração do Chrome Storage para IndexedDB...');
        
        return new Promise((resolve) => {
            chrome.storage.local.get(null, async (data) => {
                try {
                    // Migrar grupos
                    if (data.grupos || data.groups) {
                        const grupos = data.grupos || data.groups || [];
                        await this.saveGrupos(grupos);
                        console.log(`Migrados ${grupos.length} grupos`);
                    }

                    // Migrar settings
                    if (data.settings) {
                        for (const [key, value] of Object.entries(data.settings)) {
                            await this.saveSetting(key, value);
                        }
                        console.log('Settings migradas');
                    }

                    // Migrar posts agendados
                    if (data.scheduledPosts) {
                        await this.saveScheduledPosts(data.scheduledPosts);
                        console.log(`Migrados ${data.scheduledPosts.length} posts agendados`);
                    }

                    // Migrar usuário atual
                    if (data.currentUser) {
                        await this.saveCurrentUser(data.currentUser);
                        console.log('Usuário atual migrado');
                    }

                    // Migrar device ID
                    if (data.deviceId) {
                        await this.saveDeviceId(data.deviceId);
                        console.log('Device ID migrado');
                    }

                    // Migrar estatísticas OpenAI
                    if (data.openaiUsageStats) {
                        await this.saveOpenAIUsage(data.openaiUsageStats);
                        console.log('Estatísticas OpenAI migradas');
                    }

                    // Limpar dados migrados do Chrome Storage (manter apenas dados leves)
                    const keysToRemove = ['grupos', 'groups', 'settings', 'scheduledPosts', 'currentUser', 'deviceId', 'openaiUsageStats'];
                    chrome.storage.local.remove(keysToRemove, () => {
                        console.log('Dados migrados removidos do Chrome Storage');
                    });

                    console.log('Migração concluída com sucesso!');
                    resolve(true);
                } catch (error) {
                    console.error('Erro na migração:', error);
                    resolve(false);
                }
            });
        });
    }

    // Método de depuração adicionado
    async debugTables() {
        try {
            await this.ensureInitialized();
            await this.db.open();
            const tableNames = this.db.tables.map(t => t.name);
            console.log('[Debug] Tabelas no DB:', tableNames);
            
            for (const tableName of tableNames) {
                const count = await this.db.table(tableName).count();
                console.log(`[Debug] Tabela ${tableName}: ${count} registros`);
            }
        } catch (error) {
            console.error('[Debug] Erro ao inspecionar tabelas:', error);
        }
    }
}

export const storageManager = new StorageManager();

// Inicializar migração se necessário
export async function initializeStorage() {
    try {
        console.log('[Database] Iniciando abertura do banco de dados...');
        
        try {
            await db.open();
            console.log('[Database] Banco de dados aberto com sucesso. Versão atual:', db.verno);
        } catch (openError) {
            if (openError.name === 'VersionError') {
                console.warn('[Database] Erro de versão detectado. Deletando DB para forçar recriação...');
                await db.delete();
                await db.open();
                console.log('[Database] DB recriado após VersionError. Nova versão:', db.verno);
            } else {
                console.error('[Database] Falha na abertura inicial:', openError);
                console.warn('[Database] Deletando DB e tentando reabrir como fallback...');
                await db.delete();
                await db.open();
                console.log('[Database] DB recriado e aberto com sucesso. Nova versão:', db.verno);
            }
        }

        // Verifique as tabelas disponíveis
        const tableNames = db.tables.map(table => table.name);
        console.log('[Database] Tabelas disponíveis:', tableNames);

        // Se tabelas críticas estiverem faltando, force deleção e recriação
        const requiredTables = ['settings', 'grupos', 'scheduledPosts', 'users', 'devices', 'openaiUsage'];
        const missingTables = requiredTables.filter(table => !tableNames.includes(table));
        
        if (missingTables.length > 0) {
            console.warn(`[Database] Tabelas faltando: ${missingTables.join(', ')}. Forçando deleção e recriação do DB...`);
            await db.delete();
            console.log('[Database] DB deletado com sucesso. Reabrindo...');
            await db.open();
            console.log('[Database] DB recriado com sucesso. Versão:', db.verno);
            
            // Re-verifique tabelas após recriação
            const newTableNames = db.tables.map(table => table.name);
            console.log('[Database] Novas tabelas disponíveis:', newTableNames);
            
            if (newTableNames.length === 0) {
                throw new Error('Falha na criação das tabelas mesmo após recriação do DB. Verifique permissões de IndexedDB ou versão do navegador.');
            }
        }

        // Verificar se já foi migrado
        const migrated = await storageManager.getLightData('migrated', false);
        
        if (!migrated) {
            console.log('[Database] Executando migração...');
            const migrationSuccess = await storageManager.migrateFromChromeStorage();
            if (migrationSuccess) {
                await storageManager.setLightData('migrated', true);
                await storageManager.setLightData('migrationDate', new Date().toISOString());
                console.log('[Database] Migração concluída.');
            } else {
                console.warn('[Database] Migração falhou, mas continuando...');
            }
        }
        
        // Debug final
        await storageManager.debugTables();
        
        console.log('Storage inicializado com sucesso');
        return true;
    } catch (error) {
        console.error('Erro crítico ao inicializar storage:', error);
        // Para depuração, tente acessar IndexedDB manualmente
        if (window.indexedDB) {
            console.log('[Debug] IndexedDB está disponível no navegador.');
        } else {
            console.error('[Debug] IndexedDB NÃO está disponível! Isso pode ser o problema raiz.');
        }
        return false;
    }
}