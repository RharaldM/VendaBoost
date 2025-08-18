// Configurações globais
const CONFIG = {
    MAX_IMAGES: 10,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
};

// Importar o Database
import { initializeStorage, storageManager } from './database.js';

// Importar integração OpenAI
import openAIIntegration from './openai-integration.js';

// Importar cliente de autenticação
import AuthClient from './auth-client.js';

// Estrutura de dados para categorias
// Os 'id's aqui devem corresponder exatamente às chaves no CATEGORY_MAP do content.js
const CATEGORY_DATA = [
    {
        nome: "Diversos",
        id: "diversos"
    },
    {
        nome: "Móveis",
        id: "moveis"
    }
];

// Opções para a condição do produto (para facilitar a referência no popup.html)
const CONDITION_OPTIONS = [
    { nome: "Novo", value: "novo" },
    { nome: "Usado", value: "usado" },
    { nome: "Usado - Estado de Novo", value: "usado-estado-de-novo" }, // NOVA OPÇÃO
];


// Classe principal para gerenciar o popup
class PopupManager {
    constructor() {
        this.currentTab = 'create';
        this.scheduledPosts = [];
        this.groups = [];
        this.selectedImages = [];
        this.editingPostId = null; // Para controlar edição de posts
        this.draggedIndex = null; // Para controlar drag and drop de imagens
        this.settings = {
            postInterval: 15,
            retryAttempts: 3,
            enableNotifications: true,
            autoRetry: true
        };
        
        // Inicializar cliente de autenticação
        this.authClient = new AuthClient();
        this.isAuthenticated = false;
        
        this.init();
    }

    async init() {
        console.log('[Popup] Inicializando...');
        
        // Inicializar o Dexie (IndexedDB)
        await initializeStorage();
        
        // Verificar status de autenticação
        await this.checkAuthentication();
        
        // Configurar UI básica
        this.setupTabNavigation();
        this.setupEventListeners();
        this.setupSettingsListeners();
        this.setupCategoryListeners();
        this.setupGroupControlsListeners();
        this.setupAuthListeners(); // Novo: listeners de autenticação
        await this.loadSettings();
        
        // Carregar dados do formulário da sessão
        await this.loadFormData();
        
        // Configurar listeners para persistência do formulário
        this.setupFormPersistenceListeners();
        
        this.updateUI();
        this.setupBackgroundPostListeners();
        this.updateConnectionIndicator(true);
        
        // Mostrar modal de autenticação se necessário
        this.showAuthModalIfNeeded();
    }

    // ============================================
    // 🔐 Authentication Methods
    // ============================================
    
    async checkAuthentication() {
        console.log('[Popup] Verificando autenticação...');
        this.isAuthenticated = await this.authClient.checkAuthStatus();
        
        if (this.isAuthenticated) {
            console.log('[Popup] Usuário autenticado:', this.authClient.getCurrentUser());
            this.updateUserUI();
        } else {
            console.log('[Popup] Usuário não autenticado');
        }
        
        return this.isAuthenticated;
    }

    showAuthModalIfNeeded() {
        if (!this.isAuthenticated) {
            this.showAuthModal();
        }
    }

    showAuthModal() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'flex';
            this.showLoginForm();
        }
    }

    hideAuthModal() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'none';
        }
    }

    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        this.clearAuthMessage();
    }

    setupAuthListeners() {
        // Password toggle button
        document.getElementById('toggleLoginPassword')?.addEventListener('click', () => {
            this.togglePasswordVisibility('loginPassword');
        });

        // Form submissions
        document.getElementById('authLoginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutButton')?.addEventListener('click', () => {
            this.handleLogout();
        });

        // Database buttons that might need auth
        document.getElementById('testDatabaseConnection')?.addEventListener('click', () => {
            this.testDatabase();
        });
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        // Update icon (could add this logic if needed)
    }

    async handleLogin() {
        const form = document.getElementById('authLoginForm');
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');

        if (!username || !password) {
            this.showAuthMessage('Por favor, preencha todos os campos.', 'error');
            return;
        }

        const submitBtn = document.getElementById('loginSubmitBtn');
        const originalText = submitBtn.innerHTML;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="btn-icon animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/></svg> Entrando...';

        try {
            const result = await this.authClient.login(username, password);
            
            if (result.success) {
                this.isAuthenticated = true;
                this.showAuthMessage(result.message, 'success');
                
                setTimeout(() => {
                    this.hideAuthModal();
                    this.updateUserUI();
                    this.showToast('Login realizado com sucesso!', 'success');
                }, 1500);
                
            } else {
                this.showAuthMessage(result.message, 'error');
            }
            
        } catch (error) {
            console.error('[Popup] Login error:', error);
            this.showAuthMessage('Erro interno. Tente novamente.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async handleLogout() {
        try {
            await this.authClient.logout();
            this.isAuthenticated = false;
            this.updateUserUI();
            this.showAuthModal();
            this.showToast('Logout realizado com sucesso!', 'info');
        } catch (error) {
            console.error('[Popup] Logout error:', error);
            this.showToast('Erro ao fazer logout', 'error');
        }
    }

    showAuthMessage(message, type = 'info') {
        const messageEl = document.getElementById('authMessage');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.className = `auth-message ${type}`;
            messageEl.style.display = 'block';
        }
    }

    clearAuthMessage() {
        const messageEl = document.getElementById('authMessage');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    updateUserUI() {
        const userInfo = document.getElementById('userInfo');
        const logoutButton = document.getElementById('logoutButton');

        if (this.isAuthenticated && this.authClient.getCurrentUser()) {
            const user = this.authClient.getCurrentUser();
            
            // Update user info
            document.getElementById('userEmail').textContent = user.email || user.username;
            document.getElementById('userId').textContent = `ID: ${user.id}`;
            
            // Show user info and logout button
            if (userInfo) userInfo.style.display = 'flex';
            if (logoutButton) logoutButton.style.display = 'block';
            
        } else {
            // Hide user info and logout button
            if (userInfo) userInfo.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'none';
        }
    }

    async testDatabase() {
        if (!this.isAuthenticated) {
            this.showToast('Faça login para testar o banco de dados', 'warning');
            this.showAuthModal();
            return;
        }

        // Test local database
        try {
            const posts = await storageManager.getAllScheduledPosts();
            this.showToast(`Banco local OK - ${posts.length} posts encontrados`, 'success');
        } catch (error) {
            this.showToast('Erro no banco local: ' + error.message, 'error');
        }
    }

    // Configurar navegação entre abas - VERSÃO ROBUSTA
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        console.log(`[TabNavigation] Configurando ${tabButtons.length} botões de aba`);
        
        tabButtons.forEach((button, index) => {
            // Remover listeners anteriores para evitar duplicação
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Adicionar listener ao botão novo (sem duplicação)
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Validar elemento clicado
                const clickedElement = e.currentTarget;
                const tabName = clickedElement.getAttribute('data-tab');
                
                // Validações robustas
                if (!tabName) {
                    console.error('[TabNavigation] Botão sem atributo data-tab:', clickedElement);
                    return;
                }
                
                if (!this.isValidTabName(tabName)) {
                    console.error('[TabNavigation] Nome de aba inválido:', tabName);
                    return;
                }
                
                // Prevenir cliques duplos/múltiplos
                if (clickedElement.disabled) {
                    console.log('[TabNavigation] Clique ignorado - botão desabilitado temporariamente');
                    return;
                }
                
                // Desabilitar temporariamente para prevenir cliques múltiplos
                clickedElement.disabled = true;
                setTimeout(() => {
                    clickedElement.disabled = false;
                }, 200);
                
                console.log(`[TabNavigation] Mudando para aba: ${tabName}`);
                this.switchTab(tabName);
            });
        });
    }

    // Validar nomes de aba permitidos
    isValidTabName(tabName) {
        const validTabs = ['create', 'scheduled', 'groups', 'settings', 'database'];
        return validTabs.includes(tabName);
    }

    // Trocar aba ativa - VERSÃO ROBUSTA E SEGURA
    switchTab(tabName) {
        try {
            // Validação de entrada
            if (!tabName || typeof tabName !== 'string') {
                console.error('[SwitchTab] Nome de aba inválido:', tabName);
                return false;
            }
            
            if (!this.isValidTabName(tabName)) {
                console.error('[SwitchTab] Aba não permitida:', tabName);
                return false;
            }
            
            // Verificar se já está na aba solicitada (evitar re-renderização desnecessária)
            if (this.currentTab === tabName) {
                console.log(`[SwitchTab] Já na aba ${tabName}, recarregando conteúdo...`);
                // Ainda assim, recarrega o conteúdo para garantir atualização
                this.updateTabContent(tabName);
                return true;
            }
            
            console.log(`[SwitchTab] Mudando de ${this.currentTab || 'nenhuma'} para ${tabName}`);
            
            // 1. REMOVER classe active de todos os botões (com verificação de segurança)
            const allTabButtons = document.querySelectorAll('.tab-button');
            allTabButtons.forEach(btn => {
                if (btn && btn.classList) {
                    btn.classList.remove('active');
                }
            });
            
            // 2. ADICIONAR classe active ao botão da aba selecionada
            const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
            if (!activeButton) {
                console.error(`[SwitchTab] Botão da aba não encontrado: ${tabName}`);
                return false;
            }
            activeButton.classList.add('active');
            
            // 3. ESCONDER todos os conteúdos das abas
            const allTabContents = document.querySelectorAll('.tab-content');
            allTabContents.forEach(content => {
                if (content && content.classList) {
                    content.classList.remove('active');
                }
            });
            
            // 4. MOSTRAR conteúdo da aba selecionada
            const tabContent = document.getElementById(tabName);
            if (!tabContent) {
                console.error(`[SwitchTab] Conteúdo da aba não encontrado: ${tabName}`);
                return false;
            }
            tabContent.classList.add('active');
            
            // 5. ATUALIZAR estado interno
            const previousTab = this.currentTab;
            this.currentTab = tabName;
            
            // 6. CARREGAR conteúdo específico da aba
            this.updateTabContent(tabName);
            
            console.log(`[SwitchTab] ✅ Mudança concluída: ${previousTab} → ${tabName}`);
            return true;
            
        } catch (error) {
            console.error('[SwitchTab] Erro ao trocar aba:', error);
            return false;
        }
    }

    // Atualizar conteúdo específico da aba - VERSÃO MELHORADA
    async updateTabContent(tabName) {
        console.log(`[UpdateTabContent] Carregando conteúdo para aba: ${tabName}`);
        
        try {
            switch(tabName) {
                case 'create':
                    await this.loadGroupsIntoChecklist();
                    break;
                case 'scheduled':
                    console.log('[UpdateTabContent] 🔄 Carregando posts agendados...');
                    await this.loadScheduledPosts();
                    break;
                case 'groups':
                    await this.loadGroups();
                    // Força atualização do GruposManager quando a aba é selecionada
                    if (window.gruposManager) {
                        window.gruposManager.carregarGrupos().then(() => {
                            window.gruposManager.renderizar();
                        }).catch(error => {
                            console.error('[UpdateTabContent] Erro ao carregar grupos:', error);
                        });
                    }
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
                case 'database':
                    await this.loadDatabaseStatus();
                    await this.loadSchedulingStats();
                    break;
                default:
                    console.warn(`[UpdateTabContent] Aba desconhecida: ${tabName}`);
            }
            console.log(`[UpdateTabContent] ✅ Conteúdo carregado para: ${tabName}`);
        } catch (error) {
            console.error(`[UpdateTabContent] Erro ao carregar conteúdo da aba ${tabName}:`, error);
        }
    }

    deleteAllGroups() {
        if (window.gruposManager) {
            window.gruposManager.excluirTodosGrupos();
        }
    }

    // CÓDIGO PARA ADICIONAR (DENTRO DA CLASSE POPUPMANAGER)
    async loadGroupsIntoChecklist() {
        const container = document.getElementById('groupsChecklistContainer');
        if (!container) return;

        try {
            const grupos = await storageManager.getGrupos();

            if (grupos.length === 0) {
                container.innerHTML = `<div class="empty-state-small">Nenhum grupo salvo. Vá para a aba "Grupos" para escanear.</div>`;
                return;
            }

            container.innerHTML = ''; // Limpa o container antes de adicionar
            grupos.forEach(group => {
                // Apenas adiciona grupos que estão marcados como "ativos"
                if (group.ativo !== false) {
                    const item = document.createElement('div');
                    item.className = 'group-checkbox-item';
                    
                    // Create toggle button instead of checkbox
                    const toggleButton = document.createElement('div');
                    toggleButton.className = 'group-toggle-button';
                    toggleButton.setAttribute('data-group-id', group.id);
                    toggleButton.setAttribute('data-group-name', group.nome);
                    toggleButton.innerHTML = `
                        <span class="group-name">${group.nome}</span>
                    `;
                    
                    // Add click event listener for toggle functionality
                    toggleButton.addEventListener('click', () => {
                        toggleButton.classList.toggle('selected');
                        // Trigger change event for compatibility with existing code
                        const changeEvent = new CustomEvent('change', {
                            detail: {
                                checked: toggleButton.classList.contains('selected'),
                                groupId: group.id,
                                groupName: group.nome
                            }
                        });
                        toggleButton.dispatchEvent(changeEvent);
                    });
                    
                    item.appendChild(toggleButton);
                    container.appendChild(item);
                }
            });
        } catch (error) {
            console.error("Erro ao carregar grupos para checklist:", error);
            container.innerHTML = `<div class="empty-state-small" style="color: red;">Erro ao carregar grupos: ${error.message}</div>`;
        }
    }

    // Filtrar grupos na checklist baseado no termo de busca
    filterGroupsInChecklist(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const groupItems = document.querySelectorAll('#groupsChecklistContainer .group-checkbox-item');

        groupItems.forEach(item => {
            const toggleButton = item.querySelector('.group-toggle-button');
            const groupNameElement = toggleButton?.querySelector('.group-name');
            const groupName = groupNameElement ? groupNameElement.textContent.toLowerCase() : '';

            if (groupName.includes(lowerCaseSearchTerm)) {
                item.style.display = 'flex'; // Mostra o item
            } else {
                item.style.display = 'none'; // Esconde o item
            }
        });
    }

    // Selecionar/desselecionar todos os grupos visíveis
    toggleAllGroups(select) {
        // Seleciona apenas os toggle buttons que estão VISÍVEIS (não foram escondidos pelo filtro)
        const visibleGroupItems = document.querySelectorAll('#groupsChecklistContainer .group-checkbox-item');
        
        visibleGroupItems.forEach(item => {
            if (item.style.display !== 'none') {
                const toggleButton = item.querySelector('.group-toggle-button');
                if (toggleButton) {
                    if (select) {
                        toggleButton.classList.add('selected');
                    } else {
                        toggleButton.classList.remove('selected');
                    }
                    
                    // Trigger change event for compatibility
                    const changeEvent = new CustomEvent('change', {
                        detail: {
                            checked: toggleButton.classList.contains('selected'),
                            groupId: toggleButton.getAttribute('data-group-id'),
                            groupName: toggleButton.getAttribute('data-group-name')
                        }
                    });
                    toggleButton.dispatchEvent(changeEvent);
                }
            }
        });
    }    // Selecionar grupos aleatórios visíveis
    selectRandomGroups() {
        // 1. Pega a quantidade do campo de input
        const countInput = document.getElementById('randomGroupCount');
        const count = parseInt(countInput.value, 10);

        if (isNaN(count) || count <= 0) {
            this.showNotification('Por favor, insira um número válido de grupos para selecionar.', 'warning');
            return;
        }

        // 2. Pega todos os toggle buttons de grupos que estão visíveis
        const visibleToggleButtons = Array.from(
            document.querySelectorAll('#groupsChecklistContainer .group-checkbox-item:not([style*="display: none"]) .group-toggle-button')
        );

        if (visibleToggleButtons.length < count) {
            this.showNotification(`Não há grupos suficientes para selecionar ${count}. Apenas ${visibleToggleButtons.length} estão disponíveis.`, 'warning');
            return;
        }

        // 3. Limpa qualquer seleção anterior
        this.toggleAllGroups(false);

        // 4. Lógica para embaralhar o array de toggle buttons (Algoritmo Fisher-Yates)
        let shuffled = [...visibleToggleButtons]; // Cria uma cópia para não alterar o original
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Troca os elementos
        }

        // 5. Seleciona os primeiros 'count' toggle buttons do array embaralhado
        const selectedToMark = shuffled.slice(0, count);

        // 6. Marca os toggle buttons selecionados
        selectedToMark.forEach(toggleButton => {
            toggleButton.classList.add('selected');
            
            // Trigger change event for compatibility
            const changeEvent = new CustomEvent('change', {
                detail: {
                    checked: true,
                    groupId: toggleButton.getAttribute('data-group-id'),
                    groupName: toggleButton.getAttribute('data-group-name')
                }
            });
            toggleButton.dispatchEvent(changeEvent);
        });

        this.showNotification(`${count} grupos foram selecionados aleatoriamente!`, 'success');
    }

    // Configurar listeners dos controles de grupos
    setupGroupControlsListeners() {
        // Listener para o campo de busca de grupos (Create tab)
        const groupSearchInput = document.getElementById('createGroupSearchInput');
        if (groupSearchInput) {
            groupSearchInput.addEventListener('input', (e) => {
                this.filterGroupsInChecklist(e.target.value);
            });
        }

        // Listener para o botão "Selecionar Todos"
        const selectAllBtn = document.getElementById('selectAllGroupsBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.toggleAllGroups(true); // true para selecionar
            });
        }

        // Listener para o botão "Limpar Seleção"
        const deselectAllBtn = document.getElementById('deselectAllGroupsBtn');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.toggleAllGroups(false); // false para desmarcar
            });
        }

        // Listener para o botão "Selecionar Aleatórios"
        const selectRandomBtn = document.getElementById('selectRandomGroupsBtn');
        if (selectRandomBtn) {
            selectRandomBtn.addEventListener('click', () => {
                this.selectRandomGroups();
            });
        }
    }

    // NOVO: Carregar e exibir o status do banco de dados local
    async loadDatabaseStatus() {
        console.log('[Popup] Carregando status do banco de dados local...');
        
        // Elementos da interface
        const statusDot = document.getElementById('databaseStatusDot');
        const statusText = document.getElementById('databaseStatusText');

        if (!statusDot || !statusText) {
            console.error('[Popup] Elementos de status não encontrados no DOM');
            return;
        }

        try {
            // Update UI to show we're checking
            statusText.textContent = 'Verificando banco local...';
            statusDot.style.backgroundColor = '#ffa500'; // Orange
            
            console.log('[Popup] Verificando inicialização do banco...');
            
            // Test database access
            await storageManager.ensureInitialized();
            
            // Try to perform a simple operation to verify the database is working
            const testResult = await storageManager.getSettings();
            
            statusText.textContent = 'Banco Local Ativo';
            statusDot.style.backgroundColor = '#4CAF50'; // Verde
            console.log('[Popup] Status do banco de dados: Ativo');
            
        } catch (error) {
            console.error('[Popup] Erro ao verificar banco de dados:', error);
            statusText.textContent = 'Erro no Banco Local';
            statusDot.style.backgroundColor = '#f44336'; // Vermelho
        }
    }

    // NOVO: Carregar e exibir estatísticas de agendamento usando dados locais
    async loadSchedulingStats() {
        try {
            console.log('[Popup] Carregando estatísticas do banco de dados local...');
            
            // Buscar dados diretamente do IndexedDB
            const scheduledPosts = await storageManager.getScheduledPosts();
            console.log(`[Popup] ${scheduledPosts.length} posts encontrados no banco local`);
            
            if (scheduledPosts && Array.isArray(scheduledPosts)) {
                const normalizedPosts = scheduledPosts.map(post => {
                    const normalizedStatus = this.normalizeStatus(post.status);
                    console.log(`[Popup] Post "${post.titulo || post.title}" - Status: "${post.status}" -> "${normalizedStatus}"`);
                    return {
                        ...post,
                        status: normalizedStatus
                    };
                });
                
                const publishedPosts = normalizedPosts.filter(p => p.status === 'completed');
                const failedPosts = normalizedPosts.filter(p => p.status === 'failed');
                const postingPosts = normalizedPosts.filter(p => p.status === 'posting');
                const scheduledOnlyPosts = normalizedPosts.filter(p => p.status === 'scheduled');

                console.log('[Popup] Estatísticas calculadas:', {
                    total: normalizedPosts.length,
                    completed: publishedPosts.length,
                    failed: failedPosts.length,
                    posting: postingPosts.length,
                    scheduled: scheduledOnlyPosts.length
                });

                // Atualizar elementos da UI
                const totalEl = document.getElementById('stats-total-scheduled');
                const publishedEl = document.getElementById('stats-total-published');
                const failedEl = document.getElementById('stats-total-failed');

                if (totalEl) totalEl.textContent = normalizedPosts.length;
                if (publishedEl) publishedEl.textContent = publishedPosts.length;
                if (failedEl) failedEl.textContent = failedPosts.length;
                
                console.log('[Popup] Estatísticas do banco local carregadas com sucesso');
            } else {
                console.log('[Popup] Nenhum post agendado encontrado');
                // Set zeros
                const totalEl = document.getElementById('stats-total-scheduled');
                const publishedEl = document.getElementById('stats-total-published');
                const failedEl = document.getElementById('stats-total-failed');

                if (totalEl) totalEl.textContent = '0';
                if (publishedEl) publishedEl.textContent = '0';
                if (failedEl) failedEl.textContent = '0';
            }
        } catch (error) {
            console.error('[Popup] Erro ao carregar estatísticas:', error);
            
            // Mostrar zeros em caso de erro
            const totalEl = document.getElementById('stats-total-scheduled');
            const publishedEl = document.getElementById('stats-total-published');
            const failedEl = document.getElementById('stats-total-failed');

            if (totalEl) totalEl.textContent = '0';
            if (publishedEl) publishedEl.textContent = '0';
            if (failedEl) failedEl.textContent = '0';
            
            console.log('[Popup] Estatísticas zeradas - erro ao conectar banco local');
        }
    }

    // Sistema offline - não necessita autenticação externa
    
    // NOVO: Carregar dados do formulário salvos na sessão
    async loadFormData() {
        try {
            const savedData = await chrome.storage.session.get('formData');
            if (savedData.formData) {
                const data = savedData.formData;
                
                // Restaurar campos de texto
                if (data.title) {
                    const titleField = document.getElementById('title');
                    if (titleField) titleField.value = data.title;
                }
                
                if (data.description) {
                    const descField = document.getElementById('description');
                    if (descField) descField.value = data.description;
                }
                
                if (data.price) {
                    const priceField = document.getElementById('price');
                    if (priceField) priceField.value = data.price;
                }
                
                if (data.location) {
                    const locationField = document.getElementById('location');
                    if (locationField) locationField.value = data.location;
                }
                
                // Restaurar selects
                if (data.category) {
                    const categoryField = document.getElementById('categoria-principal');
                    if (categoryField) categoryField.value = data.category;
                }
                
                if (data.condition) {
                    const conditionField = document.getElementById('condition');
                    if (conditionField) conditionField.value = data.condition;
                }
                
                // Restaurar checkboxes
                if (data.delivery !== undefined) {
                    const deliveryField = document.getElementById('delivery');
                    if (deliveryField) deliveryField.checked = data.delivery;
                }
                
                console.log('[Popup] Dados do formulário carregados da sessão');
            }
        } catch (error) {
            console.error('[Popup] Erro ao carregar dados do formulário:', error);
        }
    }

    // NOVO: Configurar listeners para persistência automática do formulário
    setupFormPersistenceListeners() {
        const formFields = [
            'title', 'description', 'price', 'location', 
            'categoria-principal', 'condition', 'delivery'
        ];

        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Salvar dados quando o campo perder o foco ou quando houver mudança
                const saveData = () => this.saveFormData();
                
                field.addEventListener('blur', saveData);
                field.addEventListener('change', saveData);
                
                // Para campos de texto, também salvar durante a digitação (com debounce)
                if (field.type === 'text' || field.type === 'textarea' || field.tagName === 'TEXTAREA') {
                    let timeout;
                    field.addEventListener('input', () => {
                        clearTimeout(timeout);
                        timeout = setTimeout(saveData, 1000); // Salvar após 1 segundo de inatividade
                    });
                }
            }
        });

        console.log('[Popup] Listeners de persistência do formulário configurados');
    }

    // NOVO: Salvar dados do formulário na sessão
    async saveFormData() {
        try {
            const formData = {
                title: document.getElementById('title')?.value || '',
                description: document.getElementById('description')?.value || '',
                price: document.getElementById('price')?.value || '',
                location: document.getElementById('location')?.value || '',
                category: document.getElementById('categoria-principal')?.value || '',
                condition: document.getElementById('condition')?.value || '',
                delivery: document.getElementById('delivery')?.checked || false
            };

            await chrome.storage.session.set({ formData });
            console.log('[Popup] Dados do formulário salvos na sessão');
        } catch (error) {
            console.error('[Popup] Erro ao salvar dados do formulário:', error);
        }
    }
    
    // Atualizar a UI - VERSÃO CORRIGIDA
    updateUI() {
        console.log('[UpdateUI] Atualizando interface...');
        
        // Mostrar interface completa, pois não há autenticação
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            if (button) button.style.display = 'flex';
        });
        
        // Verificar se há uma aba já ativa, senão definir 'create' como padrão
        const activeTab = document.querySelector('.tab-button.active');
        if (!activeTab) {
            console.log('[UpdateUI] Nenhuma aba ativa encontrada, definindo "create" como padrão');
            this.switchTab('create');
        } else {
            const currentTabName = activeTab.getAttribute('data-tab');
            console.log(`[UpdateUI] Aba ativa encontrada: ${currentTabName}`);
            this.currentTab = currentTabName;
            this.updateTabContent(currentTabName);
        }
    }
    
    // Configurar event listeners
    setupEventListeners() {
        // ============================================
        //  Form Events
        // ============================================
        
        // Formulário de agendamento
        const scheduleForm = document.getElementById('postForm');
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', (e) => this.handleScheduleSubmit(e));
        }

        // Listeners para os radio buttons de agendamento
        const scheduleTypeRadios = document.querySelectorAll('input[name="scheduleType"]');
        scheduleTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleScheduleTypeChange());
        });

        // Configurar estado inicial dos campos de agendamento
        this.handleScheduleTypeChange();

        // Listeners para os radio buttons de tipo de destino (marketplace vs groups)
        const targetTypeRadios = document.querySelectorAll('input[name="targetType"]');
        targetTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleTargetTypeChange());
        });

        // Configurar estado inicial do tipo de destino
        this.handleTargetTypeChange();



        // Botão postar agora
        const postNowBtn = document.getElementById('postNow');
        if (postNowBtn) {
            postNowBtn.addEventListener('click', () => this.handlePostNow());
        }

        // Botão melhorar descrição
        const improveDescriptionBtn = document.getElementById('improveDescription');
        if (improveDescriptionBtn) {
            improveDescriptionBtn.addEventListener('click', () => this.handleImproveDescription());
        }

        // Botão para limpar formulário/novo post
        const clearFormBtn = document.getElementById('clearForm');
        if (clearFormBtn) {
            clearFormBtn.addEventListener('click', () => {
                this.clearForm();
                this.showNotification('Formulário limpo. Pronto para novo post!', 'info');
            });
        }

        // Botões da aba agendados
        const refreshBtn = document.getElementById('refreshScheduled');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('[Popup] 🔄 Botão "Atualizar" clicado - forçando atualização');
                this.showNotification('🔄 Atualizando lista de agendamentos...', 'info');
                this.loadScheduledPosts();
            });
        }

        const clearCompletedBtn = document.getElementById('clearCompleted');
        if (clearCompletedBtn) {
            clearCompletedBtn.addEventListener('click', () => this.clearCompletedPosts());
        }

        // NOVO: Botão para verificar duplicatas manualmente (apenas quando solicitado)
        const checkDuplicatesBtn = document.getElementById('checkDuplicates');
        if (checkDuplicatesBtn) {
            checkDuplicatesBtn.addEventListener('click', () => this.checkAndShowDuplicates());
        }

        // Filtro de status
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterScheduledPosts());
        }

        // Botões da aba grupos
        const addGroupBtn = document.getElementById('addGroup');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => this.addGroup());
        }

        const saveGroupsBtn = document.getElementById('saveGroups');
        if (saveGroupsBtn) {
            saveGroupsBtn.addEventListener('click', () => this.saveGroups());
        }

        const deleteAllGroupsBtn = document.getElementById('deleteAllGroups');
        if (deleteAllGroupsBtn) {
            deleteAllGroupsBtn.addEventListener('click', () => this.deleteAllGroups());
        }

        // Upload de imagens (com proteção contra listeners duplicados)
        const imageInput = document.getElementById('images');
        if (imageInput) {
            // Remover listener anterior se existir
            imageInput.removeEventListener('change', this.boundHandleImageUpload);
            
            // Criar função bound para poder remover depois
            this.boundHandleImageUpload = (e) => this.handleImageUpload(e);
            imageInput.addEventListener('change', this.boundHandleImageUpload);
        }

        // Contador de caracteres para descrição
        const descriptionField = document.getElementById('description');
        const charCounter = document.querySelector('.char-counter');
        if (descriptionField && charCounter) {
            descriptionField.addEventListener('input', (e) => {
                const count = e.target.value.length;
                charCounter.textContent = `${count}/500`;
            });
        }
        
        // Contador de caracteres para título
        const titleField = document.getElementById('title');
        if (titleField) {
            const titleCounter = titleField.parentElement.querySelector('.char-counter');
            if (titleCounter) {
                titleField.addEventListener('input', (e) => {
                    const count = e.target.value.length;
                    titleCounter.textContent = `${count}/100`;
                });
            }
        }

        // Formatação de preço
        const priceInput = document.getElementById('price');
        if (priceInput) {
            priceInput.addEventListener('input', (e) => this.formatPriceInput(e));
            priceInput.addEventListener('blur', (e) => this.formatPriceInput(e));
            priceInput.addEventListener('keydown', (e) => this.handlePriceKeydown(e));
        }

        // Listeners para campos de agendamento
        const scheduleDateInput = document.getElementById('scheduleDate');
        if (scheduleDateInput) {
            scheduleDateInput.addEventListener('change', () => this.setMinimumDateTime());
        }

        // Event listener global para botões de edição e delete
        document.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('btn-edit')) {
                const postId = e.target.getAttribute('data-id');
                this.editScheduledPost(postId);
            }
            if (e.target && e.target.classList.contains('btn-delete')) {
                // Prevent multiple clicks
                if (e.target.disabled) return;
                
                const postId = e.target.getAttribute('data-id');
                this.deleteScheduledPost(postId);
            }
        });
    }

    // Configura os listeners para Categoria
    setupCategoryListeners() {
        const categoriaPrincipalSelect = document.getElementById('categoria-principal');

        if (!categoriaPrincipalSelect) {
            console.warn("[Popup] Elemento de categoria não encontrado no DOM.");
            return;
        }

        // Preencher categorias no dropdown
        categoriaPrincipalSelect.innerHTML = '<option value="" disabled selected>Escolha uma categoria</option>';
        CATEGORY_DATA.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.nome;
            categoriaPrincipalSelect.appendChild(option);
        });
    }

    // Configurar listeners das configurações
    setupSettingsListeners() {
        const postInterval = document.getElementById('postInterval');
        const postIntervalValue = document.getElementById('postIntervalValue');
        if (postInterval && postIntervalValue) {
            postInterval.addEventListener('input', (e) => {
                postIntervalValue.textContent = e.target.value;
                this.settings.postInterval = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        const retryAttempts = document.getElementById('retryAttempts');
        const retryAttemptsValue = document.getElementById('retryAttemptsValue');
        if (retryAttempts && retryAttemptsValue) {
            retryAttempts.addEventListener('input', (e) => {
                retryAttemptsValue.textContent = e.target.value;
                this.settings.retryAttempts = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) {
            enableNotifications.addEventListener('change', (e) => {
                this.settings.enableNotifications = e.target.checked;
                this.updateToggleStatusText('enableNotifications', e.target.checked);
                this.saveSettings();
            });
        }

        const autoRetry = document.getElementById('autoRetry');
        if (autoRetry) {
            autoRetry.addEventListener('change', (e) => {
                this.settings.autoRetry = e.target.checked;
                this.updateToggleStatusText('autoRetry', e.target.checked);
                this.saveSettings();
            });
        }

        const autoPostToGroups = document.getElementById('autoPostToGroups');
        if (autoPostToGroups) {
            autoPostToGroups.addEventListener('change', (e) => {
                this.settings.autoPostToGroups = e.target.checked;
                this.updateToggleStatusText('autoPostToGroups', e.target.checked);
                this.saveSettings();
            });
        }

        const exportDataBtn = document.getElementById('exportData');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => this.exportData());
        }

        // Botões de configuração OpenAI
        const saveApiKeyBtn = document.getElementById('saveApiKey');
        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
        }

        const testApiKeyBtn = document.getElementById('testApiKey');
        if (testApiKeyBtn) {
            testApiKeyBtn.addEventListener('click', () => this.handleTestApiKey());
        }

        const removeApiKeyBtn = document.getElementById('removeApiKey');
        if (removeApiKeyBtn) {
            removeApiKeyBtn.addEventListener('click', () => this.handleRemoveApiKey());
        }

        const toggleApiKeyBtn = document.getElementById('toggleApiKey');
        if (toggleApiKeyBtn) {
            toggleApiKeyBtn.addEventListener('click', () => this.handleToggleApiKey());
        }
    }

    // Salvar configurações no storage
    async saveSettings() {
        // Alteração: Usa StorageManager methods
        await storageManager.saveSetting('appSettings', this.settings);
        console.log('[Popup] Configurações salvas:', this.settings);
    }

    // Carregar configurações do storage
    async loadSettings() {
        try {
            const settings = await storageManager.getSetting('appSettings', {});
            if (settings && Object.keys(settings).length > 0) {
                this.settings = { ...this.settings, ...settings };
                console.log('[Popup] Configurações carregadas:', this.settings);
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('[Popup] Erro ao carregar settings:', error);
            this.showNotification('Erro ao carregar configurações. Tente recarregar a extensão.', 'error');
        }
    }

    // Atualizar texto de status dos toggles
    updateToggleStatusText(toggleId, isActive) {
        const statusElement = document.getElementById(`status-${toggleId}`);
        if (statusElement) {
            statusElement.textContent = isActive ? 'Ativo' : 'Inativo';
            statusElement.className = `toggle-status-text ${isActive ? 'active' : 'inactive'}`;
        }
    }

    // Método interno para iniciar processo de postagem (usado pelo sistema de agendamento)
    // NOTA: Este método NÃO tem botão na interface - é apenas para compatibilidade interna
    startPost() {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const tab = tabs[0];

            chrome.scripting.executeScript({
                target: {tabId: tab.id},
                function: () => true
            }, (results) => {
                if (chrome.runtime.lastError) {
                    console.error('[Popup] Erro: Content script não carregado:', chrome.runtime.lastError.message);
                    return;
                }

                chrome.tabs.sendMessage(tab.id, {action: "startPost"}, (response) => {
                    console.log('[Popup] Resposta do content script:', response);
                    if (response && response.success) {
                        console.log('[Popup] Post iniciado com sucesso (modo agendamento)');
                    } else {
                        const errorMessage = response ? response.error : 'Resposta inesperada do content script.';
                        console.error(`[Popup] Falha ao iniciar post: ${errorMessage}`);
                    }
                });
            });
        });
    }

    // Lidar com mudança no tipo de agendamento (Agora vs Depois)
    handleScheduleTypeChange() {
        const scheduleInputs = document.querySelector('.schedule-inputs');
        const submitBtn = document.getElementById('submitBtn');
        const selectedScheduleType = document.querySelector('input[name="scheduleType"]:checked');

        if (!scheduleInputs || !submitBtn || !selectedScheduleType) {
            console.warn('[Popup] Elementos de agendamento não encontrados');
            return;
        }

        const scheduleType = selectedScheduleType.value;

        if (scheduleType === 'later') {
            // Mostrar campos de data e hora
            scheduleInputs.style.display = 'block';
            
            // Atualizar texto e ícone do botão
            submitBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Agendar Post
            `;
            
            // Definir data/hora mínima (agora + 5 minutos)
            this.setMinimumDateTime();
            
        } else {
            // Esconder campos de data e hora
            scheduleInputs.style.display = 'none';
            
            // Atualizar texto e ícone do botão
            submitBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Publicar Agora
            `;
        }
        
        console.log(`[Popup] Tipo de agendamento alterado para: ${scheduleType}`);
    }

    // Lidar com mudança no tipo de destino (Marketplace vs Groups vs Ambos)
    handleTargetTypeChange() {
        const selectedTargetType = document.querySelector('input[name="targetType"]:checked');
        
        if (!selectedTargetType) {
            console.warn('[Popup] Nenhum tipo de destino selecionado');
            return;
        }

        const targetType = selectedTargetType.value;
        const groupsSection = document.querySelector('.groups-section');
        
        console.log(`[Popup] Tipo de destino alterado para: ${targetType}`);
        
        if (groupsSection) {
            if (targetType === 'marketplace') {
                // Esconder seção de grupos para marketplace
                groupsSection.style.display = 'none';
                console.log('[Popup] Escondendo seção de grupos - modo Marketplace');
            } else {
                // Mostrar seção de grupos para grupos ou ambos
                groupsSection.style.display = 'block';
                console.log('[Popup] Mostrando seção de grupos');
            }
        } else {
            console.warn('[Popup] Seção de grupos não encontrada no DOM');
        }
    }

    // Definir data e hora mínimas para agendamento (agora + 1 minuto)
    setMinimumDateTime() {
        const now = new Date();
        const minDateTime = new Date(now.getTime() + 1 * 60000); // +1 minuto
        
        const dateInput = document.getElementById('scheduleDate');
        const timeInput = document.getElementById('scheduleTime');
        
        if (dateInput) {
            const today = minDateTime.toISOString().split('T')[0];
            dateInput.min = today;
            
            // Se não há data selecionada ou é hoje, definir como hoje
            if (!dateInput.value || dateInput.value === today) {
                dateInput.value = today;
            }
        }
        
        if (timeInput) {
            const minTime = minDateTime.toTimeString().slice(0, 5);
            
            // Se a data selecionada é hoje, definir hora mínima
            if (dateInput && dateInput.value === minDateTime.toISOString().split('T')[0]) {
                timeInput.min = minTime;
                
                // Se não há hora selecionada ou é menor que o mínimo
                if (!timeInput.value || timeInput.value < minTime) {
                    timeInput.value = minTime;
                }
            } else {
                // Se é uma data futura, remover restrição de hora
                timeInput.removeAttribute('min');
                
                // Se não há hora selecionada, definir uma hora padrão
                if (!timeInput.value) {
                    timeInput.value = '09:00';
                }
            }
        }
    }

    // Lidar com envio do formulário de agendamento
    async handleScheduleSubmit(e) {
        e.preventDefault();

        // 1. Verificar tipo de agendamento selecionado
        const selectedScheduleType = document.querySelector('input[name="scheduleType"]:checked');
        if (!selectedScheduleType) {
            this.showError('Selecione uma opção de agendamento.');
            return;
        }

        const scheduleType = selectedScheduleType.value;

        // 2. Coletar dados do formulário e dos grupos selecionados
        const formData = await this.getFormData();
        
        // Get selected groups if target type is "groups" or "both"
        let selectedGroups = [];
        if (formData.targetType === 'groups' || formData.targetType === 'both') {
            selectedGroups = Array.from(document.querySelectorAll('#groupsChecklistContainer .group-toggle-button.selected'))
                .map(toggleButton => ({ 
                    id: toggleButton.getAttribute('data-group-id'), 
                    name: toggleButton.getAttribute('data-group-name') 
                }));
        }

        // 3. Validação básica
        const validation = this.validatePostData(formData);
        if (!validation.isValid) {
            this.showError(validation.message);
            return;
        }

        // 4. Verificar se há grupos selecionados (para posts em grupos ou ambos)
        if ((formData.targetType === 'groups' || formData.targetType === 'both') && selectedGroups.length === 0) {
            this.showError('Selecione pelo menos um grupo para publicar.');
            return;
        }

        // 5. Lógica baseada no tipo de agendamento
        if (scheduleType === 'now') {
            // PUBLICAR AGORA
            await this.handleImmediatePost(formData, selectedGroups);
        } else {
            // AGENDAR PARA DEPOIS
            await this.handleScheduledPost(formData, selectedGroups);
        }
    }

    // Lidar com postagem imediata
    async handleImmediatePost(formData, selectedGroups) {
        console.log('[Popup] Iniciando postagem imediata...');
        
        // Preparar dados para postagem imediata
        formData.scheduleDate = new Date().toISOString().split('T')[0]; // Data atual
        formData.scheduleTime = new Date().toTimeString().split(' ')[0].substring(0, 5); // Hora atual
        formData.status = 'pending';
        formData.id = Date.now().toString();
        formData.createdAt = new Date().toISOString();
        
        // Add groups for group posts or both
        if (formData.targetType === 'groups' || formData.targetType === 'both') {
            formData.selectedGroups = selectedGroups;
            console.log(`[Popup] Grupos selecionados para postagem imediata: ${selectedGroups.length}`);
        } else {
            console.log('[Popup] Postagem imediata para MARKETPLACE');
        }
        
        try {
            // Enviar para o background script para execução imediata
            chrome.runtime.sendMessage({ 
                action: 'executeImmediatePost', 
                postData: formData 
            }, (response) => {
                if (response?.success) {
                    let target;
                    if (formData.targetType === 'groups') {
                        target = `${selectedGroups.length} grupos`;
                    } else if (formData.targetType === 'both') {
                        target = `Marketplace + ${selectedGroups.length} grupos`;
                    } else {
                        target = 'Marketplace';
                    }
                    this.showSuccess(`Postagem iniciada com sucesso para ${target}!`);
                    this.clearForm();
                } else {
                    this.showError(`Erro ao iniciar postagem: ${response?.error || 'Erro desconhecido'}`);
                    console.error('[Popup] Falha na postagem imediata:', response?.error);
                }
            });
        } catch (error) {
            console.error('[Popup] Erro na postagem imediata:', error);
            this.showError('Erro ao processar postagem imediata.');
        }
    }

    // Lidar com postagem agendada
    async handleScheduledPost(formData, selectedGroups) {
        console.log('[Popup] Iniciando agendamento...');

        // Validar data e hora para agendamento
        if (!formData.scheduleDate || !formData.scheduleTime) {
            this.showError('Data e hora de agendamento são obrigatórias.');
            return;
        }

        const startDateTime = new Date(`${formData.scheduleDate}T${formData.scheduleTime}`);
        if (startDateTime <= new Date()) {
            this.showError('Data e hora de agendamento devem ser no futuro.');
            return;
        }

        try {
            if (selectedGroups.length > 1) {
                // MÚLTIPLOS GRUPOS - Agendar com intervalos
                const appSettings = await storageManager.getSetting('appSettings', {});
                const intervalMinutes = appSettings?.postInterval || 30;

                const postsArray = selectedGroups.map((group, index) => {
                    const postDateTime = new Date(startDateTime.getTime() + index * intervalMinutes * 60000);

                    return {
                        ...formData,
                        id: `multi_${Date.now()}_${index}`,
                        status: 'scheduled',
                        groupId: group.id,
                        groupName: group.name,
                        scheduleDate: postDateTime.toISOString().split('T')[0],
                        scheduleTime: postDateTime.toTimeString().split(' ')[0].substring(0, 5),
                    };
                });

                chrome.runtime.sendMessage({ action: 'scheduleMultiplePosts', posts: postsArray }, (response) => {
                    if (response && response.success) {
                        this.showSuccess(`${postsArray.length} posts foram agendados com sucesso!`);
                        this.clearForm();
                        this.loadScheduledPosts();
                    } else {
                        this.showError(response?.error || 'Falha ao agendar múltiplos posts.');
                    }
                });

            } else {
                // POST ÚNICO
                const postData = {
                    ...formData,
                    status: 'scheduled',
                    id: this.editingPostId || `single_${Date.now()}`
                };
                
                // Only add group info if posting to groups or both
                if ((formData.targetType === 'groups' || formData.targetType === 'both') && selectedGroups.length > 0) {
                    postData.groupId = selectedGroups[0].id;
                    postData.groupName = selectedGroups[0].name;
                }
                
                this.schedulePost(postData);
            }
        } catch (error) {
            console.error('[Popup] Erro no agendamento:', error);
            this.showError(`Erro ao agendar posts: ${error.message}`);
        }
    }

    // Agendar post - OTIMIZADO para IDs locais
    async schedulePost(postData) {
        const isEditing = this.editingPostId !== null;
        const action = isEditing ? 'editando' : 'agendando';
        
        // Se está editando, usar ID local diretamente
        if (isEditing) {
            postData.id = this.editingPostId; // ID local
            console.log(`[Popup] Editando agendamento com ID local: ${this.editingPostId}`);
        }
        
        try {
            // Enviar para background
            // Log das imagens que estão sendo enviadas
            console.log('[Popup] === DADOS FINAIS SENDO ENVIADOS PARA AGENDAMENTO ===');
            console.log('[Popup] Total de imagens no postData:', postData.images ? postData.images.length : 0);
            if (postData.images && postData.images.length > 0) {
                postData.images.forEach((img, index) => {
                    console.log(`[Popup] Imagem ${index + 1} enviada:`, {
                        name: img?.name,
                        hasDataUrl: !!img?.dataUrl,
                        dataUrlLength: img?.dataUrl ? img.dataUrl.length : 0,
                        dataUrlStart: img?.dataUrl ? img.dataUrl.substring(0, 50) + '...' : 'N/A',
                        size: img?.size,
                        order: img?.order
                    });
                });
            }

            chrome.runtime.sendMessage({
                action: 'schedulePost',
                postData: postData
            }, async (response) => {
                if (response && response.success) {
                    const localId = response.postId || response.id || postData.id;
                    console.log(`[Popup] ✅ Agendamento processado com ID local: ${localId}`);
                    
                    // NOVO: Verificar imediatamente se o post foi salvo
                    console.log('[Popup] 🔍 Verificando se o post foi realmente salvo...');
                    try {
                        await new Promise(resolve => setTimeout(resolve, 100)); // Aguardar 100ms
                        const allPosts = await storageManager.getScheduledPosts();
                        const savedPost = allPosts.find(p => p.id === localId);
                        
                        if (savedPost) {
                            console.log(`[Popup] ✅ CONFIRMADO: Post encontrado no banco com ID: ${localId}`);
                            console.log('[Popup] 📄 Dados do post salvo:', {
                                id: savedPost.id,
                                title: savedPost.title,
                                status: savedPost.status,
                                uniqueKey: savedPost.uniqueKey,
                                scheduleDate: savedPost.scheduleDate,
                                scheduleTime: savedPost.scheduleTime
                            });
                        } else {
                            console.error(`[Popup] ❌ ERRO CRÍTICO: Post com ID ${localId} NÃO foi encontrado no banco!`);
                            console.error(`[Popup] Total de posts no banco: ${allPosts.length}`);
                            console.error(`[Popup] IDs dos posts existentes:`, allPosts.map(p => p.id));
                        }
                    } catch (verifyError) {
                        console.error('[Popup] ❌ Erro ao verificar post salvo:', verifyError);
                    }
                    
                    // Mostrar notificação de sucesso
                    this.showSuccess(isEditing ? 'Post editado com sucesso!' : 'Post agendado com sucesso!');
                    
                    // Limpar formulário apenas se não estiver editando
                    if (!isEditing) {
                        this.clearForm();
                    } else {
                        // Reset editing flag
                        this.editingPostId = null;
                    }
                    
                    // CRÍTICO: Forçar atualização da lista
                    console.log('[Popup] 🔄 Forçando atualização da lista de posts...');
                    await this.loadScheduledPosts();
                    
                    // Se estiver na aba scheduled, garantir que está visível
                    if (this.currentTab === 'scheduled') {
                        await this.updateTabContent('scheduled');
                    }
                } else {
                    console.error(`[Popup] ❌ Falha ao ${action} post:`, response?.error);
                    this.showError(`Erro ao ${action} post: ` + (response?.error || 'Erro desconhecido'));
                }
            });
        } catch (error) {
            console.error('[Popup] Erro no agendamento:', error);
            this.showError(`Erro ao ${action} post: ${error.message}`);
        }
    }

    // Função para postar imediatamente
    async handlePostNow() {
        console.log('[Popup] Iniciando postagem imediata...');
        
        const postData = await this.getFormData();
        
        // Coletar grupos selecionados
        const selectedGroups = Array.from(document.querySelectorAll('#groupsChecklistContainer .group-toggle-button.selected'))
            .map(toggleButton => ({ 
                id: toggleButton.getAttribute('data-group-id'), 
                name: toggleButton.getAttribute('data-group-name') 
            }));
        
        // Validação básica
        if (!postData.title || !postData.description) {
            this.showNotification('Título e descrição são obrigatórios.', 'error');
            return;
        }
        
        if (selectedGroups.length === 0) {
            this.showNotification('Por favor, selecione pelo menos um grupo.', 'warning');
            return;
        }
        
        // Preparar dados para postagem imediata
        postData.scheduleDate = new Date().toISOString().split('T')[0]; // Data atual
        postData.scheduleTime = new Date().toTimeString().split(' ')[0].substring(0, 5); // Hora atual
        postData.status = 'pending';
        postData.id = Date.now().toString();
        postData.createdAt = new Date().toISOString();
        postData.selectedGroups = selectedGroups; // Add selected groups to post data
        
        console.log('[Popup] Dados da postagem imediata:', postData);
        console.log(`[Popup] Grupos selecionados: ${selectedGroups.length}`);
        
        try {
            // Enviar para o background script para execução imediata
            chrome.runtime.sendMessage({ 
                action: 'executeImmediatePost', 
                postData: postData 
            }, (response) => {
                if (response?.success) {
                    this.showNotification(`Postagem iniciada com sucesso para ${selectedGroups.length} grupos!`, 'success');
                    this.clearForm();
                } else {
                    this.showNotification(`Erro ao iniciar postagem: ${response?.error || 'Erro desconhecido'}`, 'error');
                    console.error('[Popup] Falha na postagem imediata:', response?.error);
                }
            });
        } catch (error) {
            console.error('[Popup] Erro na postagem imediata:', error);
            this.showNotification('Erro ao processar postagem imediata.', 'error');
        }
    }

    // Melhorar descrição usando OpenAI GPT
    async handleImproveDescription() {
        console.log('[Popup] Iniciando melhoria de descrição com OpenAI...');
        
        // Obter o campo de descrição
        const descriptionField = document.getElementById('description');
        if (!descriptionField) {
            this.showNotification('❌ Campo de descrição não encontrado', 'error');
            return;
        }
        
        const originalDescription = descriptionField.value.trim();
        if (!originalDescription) {
            this.showNotification('⚠️ Por favor, escreva uma descrição antes de tentar melhorá-la', 'warning');
            descriptionField.focus();
            return;
        }
        
        // Verificar se a integração OpenAI está disponível
        if (!window.openAIIntegration) {
            this.showNotification('❌ Integração OpenAI não disponível', 'error');
            return;
        }
        
        const improveBtn = document.getElementById('improveDescription');
        const originalBtnContent = improveBtn.innerHTML;
        
        try {
            // Mostrar estado de loading
            improveBtn.disabled = true;
            improveBtn.classList.add('loading');
            improveBtn.innerHTML = '<span class="improve-icon">⏳</span><span class="improve-text">Melhorando...</span>';
            
            this.showNotification('🤖 IA está melhorando sua descrição...', 'info');
            
            // Chamar a API OpenAI
            const result = await window.openAIIntegration.improveDescription(originalDescription);
            
            if (result.success) {
                // Atualizar o campo de descrição com o texto melhorado
                descriptionField.value = result.improvedDescription;
                
                // Atualizar contador de caracteres se existir
                const charCounter = document.querySelector('.char-counter');
                if (charCounter) {
                    charCounter.textContent = `${result.improvedDescription.length}/500`;
                }
                
                // Trigger evento de input para outros listeners
                descriptionField.dispatchEvent(new Event('input', { bubbles: true }));
                
                this.showNotification('✨ Descrição melhorada com sucesso!', 'success');
                console.log('[Popup] Descrição melhorada:', {
                    original: originalDescription,
                    improved: result.improvedDescription,
                    tokensUsed: result.tokensUsed
                });
                
            } else {
                throw new Error(result.error || 'Erro desconhecido na melhoria da descrição');
            }
            
        } catch (error) {
            console.error('[Popup] Erro ao melhorar descrição:', error);
            
            let errorMessage = 'Erro ao melhorar descrição';
            
            if (error.message.includes('API Key')) {
                errorMessage = '🔑 Configure sua API Key OpenAI nas configurações';
            } else if (error.message.includes('quota')) {
                errorMessage = '💳 Limite de quota da API excedido';
            } else if (error.message.includes('conexão') || error.message.includes('fetch')) {
                errorMessage = '🌐 Erro de conexão. Verifique sua internet';
            } else if (error.message) {
                errorMessage = `❌ ${error.message}`;
            }
            
            this.showNotification(errorMessage, 'error');
            
        } finally {
            // Restaurar estado original do botão
            improveBtn.disabled = false;
            improveBtn.classList.remove('loading');
            improveBtn.innerHTML = originalBtnContent;
        }
    }

    // Métodos para gerenciar configuração da API Key OpenAI
    async handleSaveApiKey() {
        console.log('[Popup] Salvando API Key OpenAI...');
        
        const apiKeyInput = document.getElementById('openaiApiKey');
        if (!apiKeyInput) {
            this.showNotification('❌ Campo de API Key não encontrado', 'error');
            return;
        }
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            this.showNotification('⚠️ Por favor, insira uma API Key válida', 'warning');
            apiKeyInput.focus();
            return;
        }
        
        // Validar formato básico da API Key
        if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
            this.showNotification('❌ Formato de API Key inválido. Deve começar com "sk-"', 'error');
            return;
        }
        
        try {
            const result = await window.openAIIntegration.setApiKey(apiKey);
            
            if (result.success) {
                this.showNotification('✅ API Key salva com sucesso!', 'success');
                this.updateApiKeyStatus(true, 'API Key configurada');
                
                // Limpar campo por segurança
                apiKeyInput.value = '';
                
            } else {
                throw new Error(result.message || 'Erro ao salvar API Key');
            }
            
        } catch (error) {
            console.error('[Popup] Erro ao salvar API Key:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }
    
    async handleTestApiKey() {
        console.log('[Popup] Testando conexão OpenAI...');
        
        if (!window.openAIIntegration || !window.openAIIntegration.isConfigured()) {
            this.showNotification('❌ Configure uma API Key primeiro', 'error');
            return;
        }
        
        const testBtn = document.getElementById('testApiKey');
        const originalText = testBtn.innerHTML;
        
        try {
            testBtn.disabled = true;
            testBtn.innerHTML = '🔄 Testando...';
            
            this.showNotification('🧪 Testando conexão com OpenAI...', 'info');
            
            // Testar com uma descrição simples
            const testResult = await window.openAIIntegration.improveDescription('Produto para venda');
            
            if (testResult.success) {
                this.showNotification('✅ Conexão OpenAI funcionando perfeitamente!', 'success');
                this.updateApiKeyStatus(true, 'API Key funcionando');
            } else {
                throw new Error(testResult.error || 'Falha no teste');
            }
            
        } catch (error) {
            console.error('[Popup] Erro no teste da API Key:', error);
            
            let errorMessage = 'Erro no teste da API Key';
            if (error.message.includes('API Key')) {
                errorMessage = '🔑 API Key inválida ou expirada';
            } else if (error.message.includes('quota')) {
                errorMessage = '💳 Limite de quota excedido';
            } else if (error.message.includes('conexão')) {
                errorMessage = '🌐 Erro de conexão com OpenAI';
            }
            
            this.showNotification(`❌ ${errorMessage}`, 'error');
            this.updateApiKeyStatus(false, 'Erro na API Key');
            
        } finally {
            testBtn.disabled = false;
            testBtn.innerHTML = originalText;
        }
    }
    
    async handleRemoveApiKey() {
        console.log('[Popup] Removendo API Key OpenAI...');
        
        if (!window.openAIIntegration || !window.openAIIntegration.isConfigured()) {
            this.showNotification('⚠️ Nenhuma API Key configurada para remover', 'warning');
            return;
        }
        
        const confirmRemove = confirm('⚠️ Tem certeza que deseja remover a API Key OpenAI?\n\nVocê não poderá usar a funcionalidade "Melhorar descrição" até configurar uma nova chave.');
        
        if (!confirmRemove) {
            return;
        }
        
        try {
            const result = await window.openAIIntegration.removeApiKey();
            
            if (result.success) {
                this.showNotification('✅ API Key removida com sucesso', 'success');
                this.updateApiKeyStatus(false, 'API Key não configurada');
                
                // Limpar campo
                const apiKeyInput = document.getElementById('openaiApiKey');
                if (apiKeyInput) {
                    apiKeyInput.value = '';
                }
                
            } else {
                throw new Error(result.message || 'Erro ao remover API Key');
            }
            
        } catch (error) {
            console.error('[Popup] Erro ao remover API Key:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }
    
    handleToggleApiKey() {
        const apiKeyInput = document.getElementById('openaiApiKey');
        if (!apiKeyInput) return;
        
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
        } else {
            apiKeyInput.type = 'password';
        }
    }

    updateApiKeyStatus(hasKey, statusText) {
        const statusElement = document.getElementById('apiKeyStatus');
        if (statusElement) {
            statusElement.textContent = statusText || (hasKey ? 'Configurada' : 'Não configurada');
            statusElement.style.color = hasKey ? '#10b981' : '#ef4444';
        }
    }

    async loadApiKeyStatus() {
        if (window.openAIIntegration) {
            const hasKey = await window.openAIIntegration.isConfigured();
            this.updateApiKeyStatus(hasKey);
        }
    }

    updateSettingsUI() {
        const postInterval = document.getElementById('postInterval');
        const postIntervalValue = document.getElementById('postIntervalValue');
        if (postInterval && postIntervalValue) {
            postInterval.value = this.settings.postInterval;
            postIntervalValue.textContent = this.settings.postInterval;
        }

        const retryAttempts = document.getElementById('retryAttempts');
        const retryAttemptsValue = document.getElementById('retryAttemptsValue');
        if (retryAttempts && retryAttemptsValue) {
            retryAttempts.value = this.settings.retryAttempts;
            retryAttemptsValue.textContent = this.settings.retryAttempts;
        }

        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) {
            enableNotifications.checked = this.settings.enableNotifications;
            this.updateToggleStatusText('enableNotifications', this.settings.enableNotifications);
        }

        const autoRetry = document.getElementById('autoRetry');
        if (autoRetry) {
            autoRetry.checked = this.settings.autoRetry;
            this.updateToggleStatusText('autoRetry', this.settings.autoRetry);
        }

        const autoPostToGroups = document.getElementById('autoPostToGroups');
        if (autoPostToGroups) {
            autoPostToGroups.checked = this.settings.autoPostToGroups;
            this.updateToggleStatusText('autoPostToGroups', this.settings.autoPostToGroups);
        }
    }

    // Helper method to convert File objects to dataUrl format
    async convertImageToDataUrl(imageObj) {
        return new Promise((resolve, reject) => {
            if (!imageObj.file) {
                reject(new Error('No file object found'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: imageObj.file.name,
                    dataUrl: e.target.result,
                    size: imageObj.file.size,
                    type: imageObj.file.type
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageObj.file);
        });
    }

    async getFormData() {
        // Get the selected target type (marketplace vs groups)
        const targetTypeRadio = document.querySelector('input[name="targetType"]:checked');
        const targetType = targetTypeRadio?.value || 'marketplace'; // Default to marketplace
        
        // Convert images to the format expected by content script
        let convertedImages = [];
        if (this.selectedImages && this.selectedImages.length > 0) {
            try {
                console.log('[Popup] Converting', this.selectedImages.length, 'images to dataUrl format...');
                const conversionPromises = this.selectedImages.map(img => this.convertImageToDataUrl(img));
                convertedImages = await Promise.all(conversionPromises);
                console.log('[Popup] Images converted successfully:', convertedImages.length);
            } catch (error) {
                console.error('[Popup] Error converting images:', error);
                this.showNotification('Erro ao processar imagens', 'error');
            }
        }
        
        return {
            title: document.getElementById('title')?.value || '',
            description: document.getElementById('description')?.value || '',
            price: this.parsePriceValue(document.getElementById('price')?.value || '0'),
            location: document.getElementById('location')?.value || '',
            category: document.getElementById('categoria-principal')?.value || '',
            condition: document.getElementById('condition')?.value || '',
            delivery: document.getElementById('delivery')?.checked || false,
            images: convertedImages,
            scheduleDate: document.getElementById('scheduleDate')?.value || '',
            scheduleTime: document.getElementById('scheduleTime')?.value || '',
            targetType: targetType // Add the target type
        };
    }

    validatePostData(data) {
        if (!data.title) return { isValid: false, message: 'Título é obrigatório' };
        if (!data.description) return { isValid: false, message: 'Descrição é obrigatória' };
        if (!this.validatePrice(data.price)) return { isValid: false, message: 'Preço deve ser maior que zero' };
        if (!data.category) return { isValid: false, message: 'Categoria é obrigatória' };
        if (!data.condition) return { isValid: false, message: 'Condição é obrigatória' };
        if (data.images.length === 0) return { isValid: false, message: 'Pelo menos uma imagem é obrigatória' };
        return { isValid: true };
    }

    async loadScheduledPosts() {
        console.log('[Popup] 🔄 Carregando posts agendados...');
        
        try {
            // Verificar se o storage está inicializado
            if (!window.storageManager) {
                console.log('[Popup] StorageManager não encontrado, inicializando...');
                await initializeStorage();
                console.log('[Popup] Storage inicializado com sucesso');
            }
            
            // Garantir que o storageManager está acessível
            if (!storageManager) {
                throw new Error('StorageManager não está disponível após inicialização');
            }
            
            console.log('[Popup] Buscando posts do IndexedDB...');
            
            // Usar StorageManager para buscar diretamente do IndexedDB
            const posts = await storageManager.getScheduledPosts();
            console.log(`[Popup] ✅ ${posts.length} posts encontrados no banco local`);
            
            // Debug: mostrar detalhes dos posts
            if (posts.length > 0) {
                console.log('[Popup] 📋 Posts encontrados:', posts.map(p => ({
                    id: p.id,
                    title: p.title,
                    status: p.status,
                    scheduleDate: p.scheduleDate,
                    scheduleTime: p.scheduleTime,
                    uniqueKey: p.uniqueKey
                })));
            } else {
                console.log('[Popup] ⚠️ Nenhum post encontrado no banco de dados');
            }
            
            if (posts && Array.isArray(posts)) {
                // Normalizar status e remover duplicatas
                this.scheduledPosts = this.removeDuplicates(posts.map(post => ({
                    ...post,
                    status: this.normalizeStatus(post.status)
                })));
                
                console.log(`[Popup] ✅ ${this.scheduledPosts.length} posts únicos após processamento`);
                this.renderScheduledPosts();
                
                // Update stats counters in the scheduled tab
                this.updateScheduledTabStats();
            } else {
                console.log('[Popup] ⚠️ Posts não são um array válido, inicializando lista vazia');
                this.scheduledPosts = [];
                this.renderScheduledPosts();
                
                // Update stats counters to show zeros
                this.updateScheduledTabStats();
            }
        } catch (error) {
            console.error('[Popup] ❌ Erro crítico ao carregar posts agendados:', error);
            console.error('[Popup] Stack trace:', error.stack);
            this.scheduledPosts = [];
            this.renderScheduledPosts();
            this.updateScheduledTabStats(); // Update stats to show zeros in error case
            this.showNotification(`Erro ao carregar posts: ${error.message}`, 'error');
        }
    }

    updateScheduledTabStats() {
        if (!this.scheduledPosts || !Array.isArray(this.scheduledPosts)) {
            console.log('[Popup] No scheduled posts data available for stats update');
            // Set all counters to zero
            const totalEl = document.getElementById('stats-total-scheduled');
            const publishedEl = document.getElementById('stats-total-published');
            const failedEl = document.getElementById('stats-total-failed');

            if (totalEl) totalEl.textContent = '0';
            if (publishedEl) publishedEl.textContent = '0';
            if (failedEl) failedEl.textContent = '0';
            return;
        }

        // Calculate stats from scheduled posts
        const totalPosts = this.scheduledPosts.length;
        const publishedPosts = this.scheduledPosts.filter(p => p.status === 'completed');
        const failedPosts = this.scheduledPosts.filter(p => p.status === 'failed');
        const scheduledOnlyPosts = this.scheduledPosts.filter(p => p.status === 'scheduled');

        console.log('[Popup] Updating scheduled tab stats:', {
            total: totalPosts,
            published: publishedPosts.length,
            failed: failedPosts.length,
            scheduled: scheduledOnlyPosts.length
        });

        // Update UI elements
        const totalEl = document.getElementById('stats-total-scheduled');
        const publishedEl = document.getElementById('stats-total-published');
        const failedEl = document.getElementById('stats-total-failed');

        if (totalEl) totalEl.textContent = scheduledOnlyPosts.length; // Show only truly scheduled posts
        if (publishedEl) publishedEl.textContent = publishedPosts.length;
        if (failedEl) failedEl.textContent = failedPosts.length;

        console.log('[Popup] ✅ Scheduled tab stats updated successfully');
    }

    renderScheduledPosts() {
        console.log(`[Popup] 🎨 Renderizando ${this.scheduledPosts.length} posts agendados`);
        
        const container = document.getElementById('scheduledList');
        if (!container) {
            console.error('[Popup] Container scheduledList não encontrado!');
            return;
        }

        if (this.scheduledPosts.length === 0) {
            console.log('[Popup] Lista vazia, mostrando estado vazio');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3>Nenhum post agendado</h3>
                    <p>Crie um novo post na aba "Criar Post" para começar</p>
                </div>
            `;
            return;
        }

        console.log('[Popup] Gerando HTML para posts agendados...');
        const html = this.scheduledPosts.map(post => {
            const formattedDate = this.formatScheduleDate(post);
            const statusText = this.getStatusText(post.status);
            
            return `
                <div class="scheduled-post-card" data-post-id="${post.id}">
                    <div class="post-header">
                        <h3 class="post-title" title="${post.title}">${post.title}</h3>
                        <span class="status status-${post.status}" title="Status: ${statusText}">${statusText}</span>
                    </div>
                    <div class="post-details">
                        <div class="post-schedule">
                            📅 ${formattedDate}
                        </div>
                        <div class="post-group">
                            👥 ${post.groupName || 'Grupo não especificado'}
                        </div>
                    </div>
                    <div class="post-content">
                        <p class="post-description">${post.description ? post.description.substring(0, 100) + '...' : ''}</p>
                    </div>
                    <div class="post-actions">
                        <button class="btn-edit post-action-btn post-action-edit" data-id="${post.id}" title="Editar post">
                            <div class="action-icon-wrapper">
                                <svg class="action-icon" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </div>
                            <span class="action-label">Editar</span>
                        </button>
                        <button class="btn-delete post-action-btn post-action-delete" data-id="${post.id}" title="Excluir post">
                            <div class="action-icon-wrapper">
                                <svg class="action-icon" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </div>
                            <span class="action-label">Excluir</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        console.log('[Popup] ✅ Posts renderizados com sucesso');
    }

    filterScheduledPosts() {
        const filter = document.getElementById('statusFilter').value;
        const filtered = filter === 'all' ? this.scheduledPosts : this.scheduledPosts.filter(p => p.status === filter);
        this.renderFilteredPosts(filtered);
    }

    renderFilteredPosts(posts) {
        const container = document.getElementById('scheduledList');
        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = `<div class="empty-state">Nenhum post encontrado.</div>`;
            return;
        }

        const html = posts.map(post => `
            <div class="scheduled-post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <h3 class="post-title">${post.title}</h3>
                    <span class="status status-${post.status}">${this.getStatusText(post.status)}</span>
                </div>
                <div class="post-details">
                    <div class="post-schedule">
                        📅 ${this.formatScheduleDate(post)}
                    </div>
                    <div class="post-group">
                        👥 ${post.groupName || 'Grupo não especificado'}
                    </div>
                </div>
                <div class="post-content">
                    <p class="post-description">${post.description ? post.description.substring(0, 100) + '...' : ''}</p>
                </div>
                <div class="post-actions">
                    <button class="btn-edit post-action-btn post-action-edit" data-id="${post.id}" title="Editar post">
                        <div class="action-icon-wrapper">
                            <svg class="action-icon" viewBox="0 0 24 24" fill="none">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </div>
                        <span class="action-label">Editar</span>
                    </button>
                    <button class="btn-delete post-action-btn post-action-delete" data-id="${post.id}" title="Excluir post">
                        <div class="action-icon-wrapper">
                            <svg class="action-icon" viewBox="0 0 24 24" fill="none">
                                <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </div>
                        <span class="action-label">Excluir</span>
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    async editScheduledPost(id) {
        chrome.runtime.sendMessage({ action: 'getPostById', id }, (response) => {
            if (response?.success && response.post) {
                const post = response.post;
                this.editingPostId = id;

                document.getElementById('title').value = post.title;
                document.getElementById('description').value = post.description;
                document.getElementById('price').value = post.price;
                document.getElementById('location').value = post.location;
                document.getElementById('categoria-principal').value = post.category;
                document.getElementById('condition').value = post.condition;
                document.getElementById('delivery').checked = post.delivery;
                document.getElementById('scheduleDate').value = post.scheduleDate;
                document.getElementById('scheduleTime').value = post.scheduleTime;

                this.selectedImages = post.images || [];
                this.updateImagePreview();

                this.switchTab('create');
            }
        });
    }

    async deleteScheduledPost(id) {
        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
            // Find and disable the delete button
            const deleteButton = document.querySelector(`.btn-delete[data-id="${id}"]`);
            const originalText = deleteButton?.textContent;
            
            try {
                // Disable button and show loading state
                if (deleteButton) {
                    deleteButton.disabled = true;
                    deleteButton.textContent = 'Excluindo...';
                    deleteButton.style.opacity = '0.6';
                }
                
                // Show loading notification
                this.showNotification('Excluindo agendamento...', 'info');
                
                const response = await this.sendMessageWithRetry({ action: 'deletePost', postId: id });
                
                if (response?.success) {
                    this.showNotification('Agendamento excluído com sucesso!', 'success');
                    this.loadScheduledPosts();
                } else {
                    console.error('[Popup] Delete failed:', response?.error);
                    this.showNotification(`Erro ao excluir agendamento: ${response?.error || 'Erro desconhecido'}`, 'error');
                }
            } catch (error) {
                console.error('[Popup] Delete error:', error);
                this.showNotification('Erro de comunicação ao excluir agendamento. Tente novamente.', 'error');
            } finally {
                // Re-enable button and restore original text
                if (deleteButton) {
                    deleteButton.disabled = false;
                    deleteButton.textContent = originalText || '🗑️';
                    deleteButton.style.opacity = '1';
                }
            }
        }
    }

    // Helper method for reliable messaging with retry logic
    async sendMessageWithRetry(message, maxRetries = 3, timeout = 5000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Popup] Attempt ${attempt}/${maxRetries} - Sending message:`, message.action);
                
                const response = await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        reject(new Error('Message timeout'));
                    }, timeout);
                    
                    chrome.runtime.sendMessage(message, (response) => {
                        clearTimeout(timeoutId);
                        
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                console.log(`[Popup] Attempt ${attempt} successful:`, response);
                return response;
                
            } catch (error) {
                console.warn(`[Popup] Attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
                }
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    async clearCompletedPosts() {
        if (confirm('Tem certeza que deseja limpar todos os posts concluídos?')) {
            // Find and disable the clear button
            const clearButton = document.getElementById('clearCompleted');
            const originalText = clearButton?.textContent;
            
            try {
                // Disable button and show loading state
                if (clearButton) {
                    clearButton.disabled = true;
                    clearButton.textContent = 'Limpando...';
                    clearButton.style.opacity = '0.6';
                }
                
                // Show loading notification
                this.showNotification('Limpando posts concluídos...', 'info');
                
                const response = await this.sendMessageWithRetry({ action: 'clearCompleted' });
                
                if (response?.success) {
                    this.showNotification('Posts concluídos limpos com sucesso!', 'success');
                    this.loadScheduledPosts();
                } else {
                    console.error('[Popup] Clear completed failed:', response?.error);
                    this.showNotification(`Erro ao limpar posts concluídos: ${response?.error || 'Erro desconhecido'}`, 'error');
                }
            } catch (error) {
                console.error('[Popup] Clear completed error:', error);
                this.showNotification('Erro de comunicação ao limpar posts. Tente novamente.', 'error');
            } finally {
                // Re-enable button and restore original text
                if (clearButton) {
                    clearButton.disabled = false;
                    clearButton.textContent = originalText || 'Limpar Concluídos';
                    clearButton.style.opacity = '1';
                }
            }
        }
    }

    async loadGroups() {
        // Use StorageManager method instead of direct table access
        this.groups = await storageManager.getGrupos();
    }

    addGroup() {
        const urlInput = document.getElementById('groupUrl');
        const nameInput = document.getElementById('groupName');
        
        if (!urlInput || !nameInput) return;

        const url = urlInput.value.trim();
        const name = nameInput.value.trim();

        if (!url || !name) {
            this.showNotification('URL e nome são obrigatórios', 'warning');
            return;
        }

        const id = this.extractGroupId(url);
        if (!id) {
            this.showNotification('URL inválida do grupo', 'error');
            return;
        }

        this.groups.push({ id, name });
        this.saveGroups();
        urlInput.value = '';
        nameInput.value = '';
    }

    extractGroupId(url) {
        const match = url.match(/groups\/(\d+)/);
        return match ? match[1] : null;
    }

    async saveGroups() {
        // Use StorageManager method instead of direct transaction
        await storageManager.saveGrupos(this.groups);
        this.showNotification('Grupos salvos com sucesso!', 'success');
    }

    handleImageUpload(e) {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(file => 
            CONFIG.ALLOWED_TYPES.includes(file.type) && file.size <= CONFIG.MAX_IMAGE_SIZE
        );

        if (validFiles.length !== files.length) {
            this.showNotification('Algumas imagens foram ignoradas (tipo ou tamanho inválido)', 'warning');
        }

        this.selectedImages = [...this.selectedImages, ...validFiles.map((file, index) => ({
            file,
            preview: URL.createObjectURL(file),
            order: this.selectedImages.length + index + 1
        }))].slice(0, CONFIG.MAX_IMAGES);

        this.updateImagePreview();
    }

    updateImagePreview() {
        const previewContainer = document.getElementById('imagePreview');
        const instructionsElement = document.querySelector('.reorder-instructions');
        
        if (!previewContainer) return;

        if (this.selectedImages.length === 0) {
            previewContainer.innerHTML = '';
            if (instructionsElement) {
                instructionsElement.style.display = 'none';
            }
            return;
        }

        // Show reorder instructions when there are multiple images
        if (instructionsElement) {
            instructionsElement.style.display = this.selectedImages.length > 1 ? 'flex' : 'none';
        }

        previewContainer.innerHTML = this.selectedImages.map((img, index) => `
            <div class="image-preview-item" 
                 draggable="true" 
                 data-index="${index}">
                <div class="image-order-indicator">${index + 1}</div>
                <img src="${img.preview}" alt="Preview">
                <button class="image-remove-btn" data-remove-index="${index}" title="Remover imagem">
                    <svg viewBox="0 0 24 24" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Add drag and drop event listeners
        this.setupImageDragAndDrop();
        
        // Add remove button event listeners
        this.setupRemoveButtons();

        const counter = document.querySelector('.image-counter');
        if (counter) {
            counter.textContent = `${this.selectedImages.length}/${CONFIG.MAX_IMAGES}`;
        }
    }

    setupImageDragAndDrop() {
        const imageItems = document.querySelectorAll('.image-preview-item');
        
        imageItems.forEach(item => {
            item.addEventListener('dragstart', this.handleDragStart.bind(this));
            item.addEventListener('dragover', this.handleDragOver.bind(this));
            item.addEventListener('drop', this.handleDrop.bind(this));
            item.addEventListener('dragend', this.handleDragEnd.bind(this));
            item.addEventListener('dragenter', this.handleDragEnter.bind(this));
            item.addEventListener('dragleave', this.handleDragLeave.bind(this));
        });
    }

    handleDragStart(e) {
        const item = e.target.closest('.image-preview-item');
        if (!item) return;
        
        this.draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.draggedIndex.toString());
        
        console.log('Drag started:', this.draggedIndex);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        const item = e.target.closest('.image-preview-item');
        if (item && !item.classList.contains('dragging')) {
            item.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        const item = e.target.closest('.image-preview-item');
        if (item && !item.contains(e.relatedTarget)) {
            item.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const dropItem = e.target.closest('.image-preview-item');
        if (!dropItem) return;
        
        const dropIndex = parseInt(dropItem.dataset.index);
        
        console.log('Drop:', this.draggedIndex, 'to', dropIndex);
        
        if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
            // Reorder the images array
            const draggedImage = this.selectedImages[this.draggedIndex];
            this.selectedImages.splice(this.draggedIndex, 1);
            this.selectedImages.splice(dropIndex, 0, draggedImage);
            
            // Update the preview
            this.updateImagePreview();
            
            // Show success message
            this.showNotification('Imagens reordenadas com sucesso!', 'success');
        }
        
        // Clean up drag classes
        document.querySelectorAll('.image-preview-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    handleDragEnd(e) {
        const item = e.target.closest('.image-preview-item');
        if (item) {
            item.classList.remove('dragging');
        }
        
        document.querySelectorAll('.image-preview-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        
        this.draggedIndex = null;
        console.log('Drag ended');
    }

    setupRemoveButtons() {
        const removeButtons = document.querySelectorAll('.image-remove-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(button.dataset.removeIndex);
                this.removeImage(index);
            });
        });
    }

    removeImage(index) {
        if (index >= 0 && index < this.selectedImages.length) {
            this.selectedImages.splice(index, 1);
            this.updateImagePreview();
            this.showNotification('Imagem removida', 'success');
        }
    }

    // Mostrar loading
    showLoading(message = 'Carregando...') {
        let loadingElement = document.getElementById('loadingOverlay');
        
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'loadingOverlay';
            loadingElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(4px);
            `;
            
            const loadingContent = document.createElement('div');
            loadingContent.style.cssText = `
                background: white;
                padding: 20px 30px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                max-width: 300px;
            `;
            
            loadingContent.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
                <div id="loadingMessage" style="font-weight: 500; color: #374151;">${message}</div>
            `;
            
            loadingElement.appendChild(loadingContent);
            document.body.appendChild(loadingElement);
        } else {
            const messageElement = document.getElementById('loadingMessage');
            if (messageElement) {
                messageElement.textContent = message;
            }
            loadingElement.style.display = 'flex';
        }
    }

    // Esconder loading
    hideLoading() {
        const loadingElement = document.getElementById('loadingOverlay');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    // Utilitários - VERSÃO MELHORADA que lida com scheduledTime Date e strings separadas
    formatScheduleDate(postOrDate, time) {
        try {
            let date, timeStr;
            
            if (typeof postOrDate === 'object' && postOrDate !== null) {
                const post = postOrDate;
                
                // DEBUG: Log completo do objeto recebido
                console.log('[Popup] formatScheduleDate: DEBUG objeto recebido', {
                    id: post.id,
                    title: post.title,
                    scheduledTime: post.scheduledTime,
                    scheduledTimeType: typeof post.scheduledTime,
                    scheduledTimeIsDate: post.scheduledTime instanceof Date,
                    scheduleDate: post.scheduleDate,
                    scheduleTime: post.scheduleTime,
                    allKeys: Object.keys(post)
                });
                
                // Caso novo: scheduledTime é Date - extrair localmente
                if (post.scheduledTime instanceof Date) {
                    const localDate = post.scheduledTime;
                    date = localDate.toLocaleDateString('pt-BR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    }).split('/').reverse().join('-');
                    timeStr = localDate.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    console.log('[Popup] formatScheduleDate: extraído de scheduledTime Date', { date, time: timeStr });
                } 
                // Caso alternativo: scheduledTime é string ISO
                else if (post.scheduledTime && typeof post.scheduledTime === 'string') {
                    try {
                        const isoDate = new Date(post.scheduledTime);
                        if (!isNaN(isoDate.getTime())) {
                            date = isoDate.toLocaleDateString('pt-BR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            }).split('/').reverse().join('-');
                            timeStr = isoDate.toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            
                            console.log('[Popup] formatScheduleDate: extraído de scheduledTime string ISO', { date, time: timeStr });
                        } else {
                            throw new Error('Data ISO inválida');
                        }
                    } catch (isoError) {
                        console.warn('[Popup] formatScheduleDate: falha ao converter scheduledTime string', { scheduledTime: post.scheduledTime, error: isoError.message });
                        // Fallback para scheduleDate/scheduleTime
                        date = post.scheduleDate;
                        timeStr = post.scheduleTime;
                        console.log('[Popup] formatScheduleDate: fallback para scheduleDate/time strings', { date, time: timeStr });
                    }
                }
                else {
                    // Caso antigo: scheduleDate e scheduleTime strings
                    date = post.scheduleDate;
                    timeStr = post.scheduleTime;
                    
                    console.log('[Popup] formatScheduleDate: usado scheduleDate/time strings', { date, time: timeStr });
                }
            } else {
                // Modo separado
                date = postOrDate;
                timeStr = time;
                console.log('[Popup] formatScheduleDate: recebido date/time separados', { date, time: timeStr });
            }
            
            if (!date || !timeStr) {
                console.warn('[Popup] formatScheduleDate: data ou hora ausentes', { 
                    date, 
                    timeStr, 
                    originalObject: typeof postOrDate === 'object' ? {
                        keys: Object.keys(postOrDate || {}),
                        scheduledTime: postOrDate?.scheduledTime,
                        scheduleDate: postOrDate?.scheduleDate,
                        scheduleTime: postOrDate?.scheduleTime
                    } : postOrDate 
                });
                return 'Data não definida';
            }
            
            if (typeof date !== 'string' || typeof timeStr !== 'string') {
                console.warn('[Popup] formatScheduleDate: formato inválido', { 
                    dateType: typeof date, 
                    timeType: typeof timeStr,
                    date,
                    timeStr
                });
                return 'Data inválida';
            }
            
            const dateObj = new Date(`${date}T${timeStr}`);
            
            if (isNaN(dateObj.getTime())) {
                console.warn('[Popup] formatScheduleDate: data inválida criada', { date, time: timeStr });
                return 'Data inválida';
            }
            
            return dateObj.toLocaleString('pt-BR');
        } catch (error) {
            console.error('[Popup] formatScheduleDate: erro ao formatar', { 
                postOrDate: typeof postOrDate === 'object' ? {
                    keys: Object.keys(postOrDate || {}),
                    sample: JSON.stringify(postOrDate).substring(0, 200)
                } : postOrDate, 
                time, 
                error 
            });
            return 'Erro na data';
        }
    }

    getStatusText(status) {
        const statusMap = {
            'scheduled': 'Agendado',
            'posting': 'Postando',
            'completed': 'Concluído',
            'failed': 'Falhou',
            'draft': 'Rascunho'
        };
        return statusMap[status] || status;
    }

    clearForm() {
        // 1. Limpa todos os campos padrão do formulário automaticamente (input, textarea, select)
        const form = document.getElementById('postForm');
        if (form) form.reset();

        // 2. Reinicia selects personalizados (por segurança)
        const categoriaPrincipalSelect = document.getElementById('categoria-principal');
        
        if (categoriaPrincipalSelect) {
            categoriaPrincipalSelect.value = '';
        }

        // 3. Limpa área de imagens e contadores
        this.selectedImages = [];
        this.updateImagePreview();
        
        const imageInput = document.getElementById('images');
        if (imageInput) {
            imageInput.value = '';
        }

        // Resetar contadores
        const charCounter = document.querySelector('.char-counter');
        if (charCounter) {
            charCounter.textContent = '0/500';
        }

        const titleField = document.getElementById('title');
        if (titleField) {
            const titleCounter = titleField.parentElement.querySelector('.char-counter');
            if (titleCounter) {
                titleCounter.textContent = '0/100';
            }
        }

        const imageCounter = document.querySelector('.image-counter');
        if (imageCounter) {
            imageCounter.textContent = '0/10';
        }

        // 4. Limpa rascunho salvo localmente
        chrome.storage.local.remove('postDraft');

        // 5. NOVO: Limpa dados do formulário salvos na sessão
        chrome.storage.session.remove('formData');

        // 6. Reset tipo de agendamento para "now"
        const scheduleNowRadio = document.querySelector('input[name="scheduleType"][value="now"]');
        if (scheduleNowRadio) {
            scheduleNowRadio.checked = true;
            this.handleScheduleTypeChange(); // Atualizar UI
        }

        // 7. Reset flag de edição (ID local)
        this.editingPostId = null;
    }

    // Formatação do campo de preço em tempo real
    formatPriceInput(e) {
        const input = e.target;
        let value = input.value;
        
        // Se o campo estiver vazio
        if (!value || value.trim() === '') {
            input.dataset.numericValue = '0';
            return;
        }
        
        // Remove o símbolo R$ e espaços
        value = value.replace(/R\$\s?/g, '');
        
        // Se o usuário está digitando, permite pontos e vírgulas temporariamente
        // Mas valida o formato
        const isValidFormat = /^[\d.,]*$/.test(value);
        if (!isValidFormat) {
            // Remove caracteres inválidos
            value = value.replace(/[^\d.,]/g, '');
        }
        
        // Converte o valor para número
        // Remove pontos (separadores de milhares) e troca vírgula por ponto
        const cleanValue = value.replace(/\./g, '').replace(',', '.');
        const numericValue = parseFloat(cleanValue) || 0;
        
        // Armazena o valor numérico real
        input.dataset.numericValue = numericValue;
        
        // Se o usuário terminou de digitar (perdeu o foco), formata
        if (e.type === 'blur' || e.type === 'change') {
            input.value = numericValue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        console.log(`[Price Format] Input: "${value}" -> Clean: "${cleanValue}" -> Numeric: ${numericValue}`);
    }

    // Manipula teclas especiais no campo de preço
    handlePriceKeydown(e) {
        // Permite números, vírgula, ponto, backspace, delete e teclas de navegação
        const isNumber = /^[0-9]$/.test(e.key);
        const isCommaOrDot = e.key === ',' || e.key === '.';
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];

        if (!isNumber && !isCommaOrDot && !allowed.includes(e.key)) {
            e.preventDefault();
        }
    }

    // Converter valor formatado para número
    parsePriceValue(formattedValue) {
        if (!formattedValue || formattedValue.trim() === '') return 0;
        
        // Primeiro tenta usar o valor armazenado no dataset
        const priceInput = document.getElementById('price');
        if (priceInput && priceInput.dataset.numericValue) {
            const datasetValue = parseFloat(priceInput.dataset.numericValue);
            console.log(`[Parse Price] Using dataset value: ${datasetValue}`);
            return datasetValue;
        }
        
        // Se não tiver dataset, faz o parse do valor formatado
        const parsed = this.parseBRL(formattedValue);
        console.log(`[Parse Price] Parsed from formatted: ${formattedValue} -> ${parsed}`);
        return parsed;
    }

    // Função melhorada para converter valor brasileiro para número
    parseBRL(formattedValue) {
        if (!formattedValue || formattedValue.trim() === '') return 0;
        
        // Remove R$, espaços e pontos (separadores de milhares)
        let clean = formattedValue.replace(/[R$\s\.]/g, '');
        
        // Troca vírgula por ponto (separador decimal)
        clean = clean.replace(',', '.');
        
        // Parse para float
        const result = parseFloat(clean) || 0;
        
        console.log(`[Parse BRL] "${formattedValue}" -> cleaned: "${clean}" -> result: ${result}`);
        
        return result;
    }

    // Função de validação de preço
    validatePrice(price) {
        console.log(`[Validate Price] 🔍 DEBUGGING - Input recebido:`, {
            price: price,
            type: typeof price,
            isEmpty: !price || price === '',
            isZero: price === 0 || price === '0'
        });

        // Garante que o preço é um número válido
        const numericPrice = typeof price === 'string' ? this.parsePriceValue(price) : price;
        
        console.log(`[Validate Price] 🔍 DEBUGGING - Após conversão:`, {
            original: price,
            converted: numericPrice,
            isNaN: isNaN(numericPrice),
            isZeroOrNegative: numericPrice <= 0
        });

        // Validações básicas
        if (isNaN(numericPrice) || numericPrice <= 0) {
            console.error(`[Validate Price] ❌ INVALID PRICE DEBUG:`, {
                original: price,
                converted: numericPrice,
                reason: isNaN(numericPrice) ? 'NaN' : 'Zero ou negativo',
                priceInputElement: document.getElementById('price')?.value,
                priceDataset: document.getElementById('price')?.dataset?.numericValue
            });
            return false;
        }
        
        // Validação de limite máximo (ajuste conforme necessário)
        if (numericPrice > 9999999) {
            console.error(`[Validate Price] Price too high: ${numericPrice}`);
            return false;
        }
        
        console.log(`[Validate Price] ✅ Valid price: ${numericPrice}`);
        return numericPrice;
    }

    // Formatar número para exibição como moeda
    formatCurrencyDisplay(value) {
        if (!value || isNaN(value)) return 'R$ 0,00';
        
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    // Métodos para exibir notificações
    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" type="button" title="Fechar notificação">×</button>
            </div>
        `;

        // Adicionar estilos se não existirem
        this.addNotificationStyles();

        // Adicionar event listener para o botão de fechar
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeNotification(notification);
            });
        }

        // Adicionar ao body
        document.body.appendChild(notification);

        // Auto-remover após 5 segundos
        const autoRemoveTimeout = setTimeout(() => {
            this.closeNotification(notification);
        }, 5000);

        // Armazenar o timeout para poder cancelá-lo se o usuário fechar manualmente
        notification.dataset.timeoutId = autoRemoveTimeout;

        // Animar entrada
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
    }
    
    closeNotification(notification) {
        if (!notification || !notification.parentElement) {
            return;
        }
        
        // Cancelar timeout de auto-remoção se existir
        if (notification.dataset.timeoutId) {
            clearTimeout(parseInt(notification.dataset.timeoutId));
        }
        
        // Animar saída
        notification.classList.add('notification-closing');
        
        // Remover após animação
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 400px;
                border-left: 4px solid #ccc;
            }
            .notification.show {
                transform: translateX(0);
            }
            .notification-closing {
                transform: translateX(100%) !important;
                opacity: 0;
            }
            .notification-success {
                border-left-color: #10b981;
            }
            .notification-error {
                border-left-color: #ef4444;
            }
            .notification-warning {
                border-left-color: #f59e0b;
            }
            .notification-info {
                border-left-color: #3b82f6;
            }
            .notification-content {
                display: flex;
                align-items: center;
                padding: 16px;
                gap: 12px;
            }
            .notification-icon {
                font-size: 18px;
                flex-shrink: 0;
            }
            .notification-message {
                flex: 1;
                color: #374151;
                font-size: 14px;
            }
            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #9ca3af;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            }
            .notification-close:hover {
                background: #f3f4f6;
                color: #374151;
            }
            .notification-close:active {
                background: #e5e7eb;
            }
            .notification-close:focus {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    // NOVO: Configurar listeners para posts em segundo plano
    setupBackgroundPostListeners() {
        // Escutar mensagens do background script sobre posts executados
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'postExecutedInBackground') {
                this.handleBackgroundPostNotification(message.data);
            } else if (message.action === 'postFailedInBackground') {
                this.handleBackgroundPostError(message.data);
            } else if (message.action === 'facebookTabRequired') {
                this.handleFacebookTabRequired(message.data);
            } else if (message.action === 'connectionStatus') {
                this.handleConnectionStatus(message);
            } else if (message.action === 'syncRecovered') {
                this.handleSyncRecovered(message);
            }
        });
        
        // NOVO: Configurar atualização automática periódica quando na aba 'scheduled'
        setInterval(() => {
            if (this.currentTab === 'scheduled') {
                console.log('[Popup] 🔄 Atualização automática periódica da lista de posts');
                this.loadScheduledPosts();
            }
        }, 10000); // Atualizar a cada 10 segundos
    }

    // Tratar notificação de post executado em segundo plano
    handleBackgroundPostNotification(data) {
        const { postTitle, success, timestamp } = data;
        
        console.log('[Popup] ✅ Recebida notificação de post em background:', {
            postTitle,
            success,
            timestamp
        });
        
        if (success) {
            this.showNotification(
                `✅ Post "${postTitle}" foi publicado automaticamente em segundo plano!`,
                'success'
            );
            console.log('[Popup] Post publicado com sucesso, atualizando lista...');
        } else {
            this.showNotification(
                `❌ Falha ao publicar "${postTitle}" em segundo plano.`,
                'error'
            );
            console.log('[Popup] Post falhou, atualizando lista...');
        }
        
        // Atualizar lista de posts agendados IMEDIATAMENTE
        console.log('[Popup] Iniciando atualização da lista de posts...');
        this.loadScheduledPosts();
        
        // Atualizar estatísticas se estiver na aba Database
        if (this.currentTab === 'database') {
            console.log('[Popup] Atualizando também as estatísticas...');
            this.loadSchedulingStats();
        }
        
        console.log('[Popup] Notificação de background processada completamente');
    }

    // Tratar erro de post em segundo plano
    handleBackgroundPostError(data) {
        const { postTitle, error, needsUserAction } = data;
        
        if (needsUserAction) {
            this.showNotification(
                `⚠️ "${postTitle}": ${error}. Abra o Facebook para continuar.`,
                'warning'
            );
        } else {
            this.showNotification(
                `❌ Erro ao publicar "${postTitle}": ${error}`,
                'error'
            );
        }
    }

    // Tratar solicitação de aba do Facebook
    handleFacebookTabRequired(data) {
        const { postTitle } = data;
        
        this.showNotification(
            `📱 Para publicar "${postTitle}", uma aba do Facebook será aberta automaticamente.`,
            'info'
        );
    }

    // NOVO: Tratar mudanças no status de conexão
    handleConnectionStatus(message) {
        console.log(`[Popup] Status de conexão: ${message.online ? 'Online' : 'Offline'}`);
        
        if (!message.online) {
            this.showNotification('📴 Conexão perdida - Trabalhando offline', 'warning', 3000);
            this.updateConnectionIndicator(false);
        } else {
            this.showNotification('🌐 Conexão restaurada', 'success', 2000);
            this.updateConnectionIndicator(true);
        }
    }

    // NOVO: Tratar recuperação de sincronização
    handleSyncRecovered(message) {
        console.log(`[Popup] Sync de recuperação concluído: ${message.count} agendamentos`);
        
        this.showNotification(`✅ Sincronização recuperada: ${message.count} agendamentos`, 'success', 3000);
        
        // Atualizar dados na interface
        if (this.currentTab === 'scheduled') {
            this.loadScheduledPosts();
        }
        
        if (this.currentTab === 'database') {
            this.loadSchedulingStats();
        }
    }

    // NOVO: Atualizar indicador de conexão na interface
    updateConnectionIndicator(isOnline) {
        const indicator = document.getElementById('connectionIndicator');
        
        if (!indicator) {
            // Criar indicador se não existir
            const statusDiv = document.createElement('div');
            statusDiv.id = 'connectionIndicator';
            statusDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                z-index: 1000;
                transition: all 0.3s ease;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(statusDiv);
        }
        
        const finalIndicator = document.getElementById('connectionIndicator');
        if (finalIndicator) {
            finalIndicator.style.backgroundColor = isOnline ? '#4CAF50' : '#F44336';
            finalIndicator.title = isOnline ? 'Conectado' : 'Trabalhando offline';
        }
    }

    // Função para normalizar status
    normalizeStatus(status) {
        if (!status) {
            console.log(`[Status Normalize] Status vazio/null, retornando 'scheduled'`);
            return 'scheduled';
        }
        
        // Mapear diferentes variações de status para valores padronizados
        const statusMap = {
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
        
        // Log mais detalhado para debug
        if (status.toString().toLowerCase().includes('complet') || status.toString().toLowerCase().includes('conclu')) {
            console.log(`[Status Normalize] 🔍 COMPLETED STATUS DETECTADO: "${status}" (tipo: ${typeof status}) -> "${mappedStatus}"`);
        } else {
            console.log(`[Status Normalize] "${status}" -> "${mappedStatus}"`);
        }
        
        return mappedStatus;
    }

    // === FUNÇÕES PARA REMOÇÃO AUTOMÁTICA DE DUPLICATAS ===

    // Gerar chave única a partir de dados do post (compatível com background.js)
    generateUniqueKeyFromPost(post) {
        if (!post.title || !post.scheduleDate || !post.scheduleTime) {
            return null;
        }
        
        // Geração de chave única MENOS RESTRITIVA (preserva mais caracteres)
        const normalizedTitle = post.title.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Preserva letras, números, espaços e hífens
            .replace(/\s+/g, '_')     // Apenas substituir espaços por underscore
            .trim();
        
        return `${normalizedTitle}_${post.scheduleDate}_${post.scheduleTime}`;
    }

    // Remover duplicatas automáticamente baseado em chave única
    removeDuplicates(posts) {
        if (!posts || posts.length === 0) return [];
        
        const uniquePosts = [];
        const seenKeys = new Set();
        const seenIds = new Set();
        let duplicatesRemoved = 0;
        
        console.log('[Popup] Iniciando remoção automática de duplicatas...');
        
        for (const post of posts) {
            // Verificar duplicação por ID primeiro
            if (seenIds.has(post.id)) {
                console.log(`[Popup] Duplicata por ID removida: ${post.id} - "${post.title}"`);
                duplicatesRemoved++;
                continue;
            }
            
            // Gerar chave única se não existir
            if (!post.uniqueKey && post.title && post.scheduleDate && post.scheduleTime) {
                post.uniqueKey = this.generateUniqueKeyFromPost(post);
            }
            
            // Verificar duplicação por chave única
            if (post.uniqueKey) {
                if (seenKeys.has(post.uniqueKey)) {
                    console.log(`[Popup] Duplicata por chave única removida: ${post.uniqueKey} - "${post.title}"`);
                    duplicatesRemoved++;
                    continue;
                }
                seenKeys.add(post.uniqueKey);
            }
            
            seenIds.add(post.id);
            uniquePosts.push(post);
        }
        
        if (duplicatesRemoved > 0) {
            console.log(`[Popup] ${duplicatesRemoved} duplicatas removidas automaticamente`);
            this.showNotification(`${duplicatesRemoved} agendamentos duplicados foram removidos automaticamente`, 'info');
        }
        
        return uniquePosts;
    }

    // NOVA FUNÇÃO: Verificar duplicatas apenas quando solicitado pelo usuário
    checkAndShowDuplicates() {
        if (!this.scheduledPosts || this.scheduledPosts.length === 0) {
            this.showNotification('Nenhum agendamento para verificar', 'info');
            return;
        }

        const duplicateInfo = this.analyzeDuplicates(this.scheduledPosts);
        
        if (duplicateInfo.total === 0) {
            this.showNotification('✅ Nenhuma duplicata encontrada!', 'success');
        } else {
            this.showDuplicateReport(duplicateInfo);
        }
    }

    // Analisar duplicatas sem removê-las
    analyzeDuplicates(posts) {
        const seenKeys = new Set();
        const seenIds = new Set();
        const duplicatesByKey = [];
        const duplicatesById = [];
        
        for (const post of posts) {
            // Verificar duplicação por ID
            if (seenIds.has(post.id)) {
                duplicatesById.push(post);
            } else {
                seenIds.add(post.id);
            }
            
            // Gerar e verificar uniqueKey
            if (!post.uniqueKey && post.title && post.scheduleDate && post.scheduleTime) {
                post.uniqueKey = this.generateUniqueKeyFromPost(post);
            }
            
            if (post.uniqueKey) {
                if (seenKeys.has(post.uniqueKey)) {
                    duplicatesByKey.push(post);
                } else {
                    seenKeys.add(post.uniqueKey);
                }
            }
        }
        
        return {
            total: duplicatesById.length + duplicatesByKey.length,
            byId: duplicatesById,
            byKey: duplicatesByKey
        };
    }

    // Mostrar relatório de duplicatas
    showDuplicateReport(duplicateInfo) {
        let message = `⚠️ ${duplicateInfo.total} possíveis duplicatas encontradas:\n\n`;
        
        if (duplicateInfo.byId.length > 0) {
            message += `📋 Duplicatas por ID: ${duplicateInfo.byId.length}\n`;
        }
        
        if (duplicateInfo.byKey.length > 0) {
            message += `🔑 Duplicatas por título/horário: ${duplicateInfo.byKey.length}\n`;
        }
        
        message += '\n⚠️ Limpeza automática foi DESABILITADA para proteger seus agendamentos.';
        
        // Perguntar se o usuário quer ver detalhes
        if (confirm(message + '\n\nDeseja ver os detalhes das duplicatas?')) {
            this.showDetailedDuplicateReport(duplicateInfo);
        }
    }

    // Mostrar relatório detalhado
    showDetailedDuplicateReport(duplicateInfo) {
        let details = '=== RELATÓRIO DETALHADO DE DUPLICATAS ===\n\n';
        
        if (duplicateInfo.byId.length > 0) {
            details += '📋 DUPLICATAS POR ID:\n';
            duplicateInfo.byId.forEach((post, index) => {
                details += `${index + 1}. ID: ${post.id} - "${post.title}" (${post.scheduleDate} ${post.scheduleTime})\n`;
            });
            details += '\n';
        }
        
        if (duplicateInfo.byKey.length > 0) {
            details += '🔑 DUPLICATAS POR TÍTULO/HORÁRIO:\n';
            duplicateInfo.byKey.forEach((post, index) => {
                details += `${index + 1}. "${post.title}" - ${post.scheduleDate} ${post.scheduleTime} (Chave: ${post.uniqueKey})\n`;
            });
        }
        
        console.log(details);
        alert(details);
    }

    // === FIM DAS FUNÇÕES DE REMOÇÃO DE DUPLICATAS ===

    // ============================================
    // 🔔 Toast Notification System
    // ============================================
    
    showToast(message, type = 'info', duration = 4000) {
        console.log(`[Toast] ${type.toUpperCase()}: ${message}`);
        
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            console.warn('[Toast] Toast container not found');
            return;
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Toast content
        toast.innerHTML = `
            <div class="toast-icon">
                ${this.getToastIcon(type)}
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg viewBox="0 0 24 24" fill="none">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);

        // Manual close functionality
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            });
        }
    }

    getToastIcon(type) {
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
            </svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
            </svg>`,
            info: `<svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                <path d="M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="8" r="1" fill="currentColor"/>
            </svg>`
        };
        
        return icons[type] || icons.info;
    }
}


// Classe para gerenciar grupos do Facebook
class GruposManager {
    constructor() {
        this.grupos = [];
        this.gruposFiltrados = [];
        this.init();
    }
    
    async init() {
        await this.carregarGrupos();
        this.setupEventListeners();
        this.renderizar();
    }
    
    setupEventListeners() {
        // Botão de detectar grupos (atualizado para usar ID correto)
        const btnDetectGroups = document.getElementById('detectGroupsBtn');
        if (btnDetectGroups) {
            btnDetectGroups.addEventListener('click', () => {
                this.escanearGrupos();
            });
        }
        
        // Botão de excluir todos
        const btnExcluirTodos = document.getElementById('deleteAllGroups');
        if (btnExcluirTodos) {
            btnExcluirTodos.addEventListener('click', () => {
                this.excluirTodosGrupos();
            });
        }
        
        // Filtro de busca com debouncing
        const filtroGrupos = document.getElementById('groupsManagerSearchInput');
        if (filtroGrupos) {
            let debounceTimer;
            filtroGrupos.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filtrarGrupos(e.target.value);
                }, 150); // 150ms debounce for smooth filtering
            });
        }
        
        // Ordenação
        const ordenarGrupos = document.getElementById('ordenarGrupos');
        if (ordenarGrupos) {
            ordenarGrupos.addEventListener('change', (e) => {
                this.ordenarGrupos(e.target.value);
            });
        }
    }
    
    async escanearGrupos(detectAll = false) {
        try {
            console.log('[GruposManager] Iniciando escaneamento de grupos...');
            this.mostrarStatus('Escaneando grupos...', true);
            
            // Verifica se está na página do Facebook
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            console.log('[GruposManager] Tab atual:', tab.url);
            
            if (!tab.url.includes('facebook.com')) {
                this.mostrarStatus('❌ Acesse o Facebook primeiro!', false);
                console.error('[GruposManager] Não está no Facebook');
                return;
            }
            
            // Verifica se o runtime está disponível
            if (!chrome.runtime || !chrome.runtime.id) {
                this.mostrarStatus('❌ Extensão desconectada. Recarregue a página.', false);
                console.error('[GruposManager] Runtime não disponível');
                return;
            }
            
            // Tenta injetar o content script primeiro
            console.log('[GruposManager] Garantindo content script...');
            await this.garantirContentScript(tab.id);
            
            // Aguarda um pouco para o script carregar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verifica se o content script está respondendo
            console.log('[GruposManager] Verificando content script...');
            const scriptDisponivel = await this.verificarContentScript(tab.id);
            if (!scriptDisponivel) {
                this.mostrarStatus('❌ Content script não está respondendo. Recarregue a página.', false);
                console.error('[GruposManager] Content script não responde');
                return;
            }
            
            // Envia mensagem para o content script com tratamento de erro melhorado
            console.log('[GruposManager] Enviando mensagem para content script...');
            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'escanearGrupos',
                    detectAll: detectAll
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            console.log('[GruposManager] Resposta recebida:', response);
            
            if (response && response.sucesso) {
                console.log(`[GruposManager] ${response.total} grupos encontrados`);
                await this.salvarGrupos(response.grupos);
                this.mostrarStatus(`✅ ${response.total} grupos encontrados!`, false);
                // Força a atualização da interface
                await this.carregarGrupos();
                // Pequeno delay para garantir que a interface seja atualizada
                setTimeout(() => {
                    this.renderizar();
                }, 100);
            } else {
                const errorMsg = response ? response.erro : 'Resposta inválida';
                console.error('[GruposManager] Erro na resposta:', errorMsg);
                this.mostrarStatus(`❌ Erro: ${errorMsg}`, false);
            }
            
        } catch (erro) {
            console.error('[GruposManager] Erro ao escanear grupos:', erro);
            if (erro.message.includes('Could not establish connection')) {
                this.mostrarStatus('❌ Content script não carregado. Tente recarregar a página.', false);
            } else if (erro.message.includes('Extension context invalidated')) {
                this.mostrarStatus('❌ Extensão desconectada. Recarregue a extensão.', false);
            } else {
                this.mostrarStatus(`❌ Erro: ${erro.message}`, false);
            }
        }
    }
    
    // Função para garantir que o content script está injetado
     async garantirContentScript(tabId) {
         try {
             // Tenta injetar o content script manualmente
             await chrome.scripting.executeScript({
                 target: { tabId: tabId },
                 files: ['content.js']
             });
             console.log('Content script injetado manualmente');
         } catch (error) {
             console.warn('Erro ao injetar content script:', error);
             // Não é crítico se falhar, pode já estar injetado
         }
     }
     
     // Função para verificar se o content script está respondendo
     async verificarContentScript(tabId) {
         try {
             const response = await new Promise((resolve, reject) => {
                 const timeout = setTimeout(() => {
                     reject(new Error('Timeout'));
                 }, 5000);
                 
                 chrome.tabs.sendMessage(tabId, {
                     action: 'ping'
                 }, (response) => {
                     clearTimeout(timeout);
                     if (chrome.runtime.lastError) {
                         reject(new Error(chrome.runtime.lastError.message));
                     } else {
                         resolve(response);
                     }
                 });
             });
             
             return response && response.success;
         } catch (error) {
             console.warn('Content script não está respondendo:', error);
             return false;
         }
     }
    
    mostrarStatus(texto, loading = false) {
        const statusContainer = document.getElementById('statusEscaneamento');
        const statusTexto = document.getElementById('statusTexto');
        const botaoDetect = document.getElementById('detectGroupsBtn');
        const botaoDetectAll = document.getElementById('detectAllGroupsBtn');
        
        if (statusContainer && statusTexto) {
            statusTexto.textContent = texto;
            statusContainer.style.display = loading ? 'flex' : 'none';
        }
        
        // Disable both buttons during loading
        if (botaoDetect) {
            botaoDetect.disabled = loading;
            if (loading) {
                botaoDetect.textContent = '⏳ Detectando...';
            } else {
                botaoDetect.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Detectar Grupos
                `;
            }
        }
        
        if (botaoDetectAll) {
            botaoDetectAll.disabled = loading;
            if (loading) {
                botaoDetectAll.textContent = '⏳ Detectando Todos...';
            } else {
                botaoDetectAll.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0v6m0 0v6m0-6h6m-6 0h-6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Detectar Todos
                `;
            }
        }
        
        // Remove status após 3 segundos se não estiver carregando
        if (!loading && statusContainer) {
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 3000);
        }
    }
    
    async salvarGrupos(novosGrupos) {
        // Use StorageManager methods
        // Carrega grupos existentes
        const gruposExistentes = await storageManager.getGrupos();
        
        // Mescla com novos grupos (evita duplicatas)
        const gruposMap = new Map();
        
        // Adiciona grupos existentes
        gruposExistentes.forEach(grupo => {
            gruposMap.set(grupo.id, grupo);
        });
        
        // Adiciona novos grupos
        novosGrupos.forEach(grupo => {
            gruposMap.set(grupo.id, {
                ...grupo,
                dataEncontrado: new Date().toISOString(),
                ativo: grupo.ativo !== undefined ? grupo.ativo : true // Define como ativo por padrão
            });
        });
        
        // Salva no storage
        this.grupos = Array.from(gruposMap.values());
        await storageManager.saveGrupos(this.grupos);
    }
    
    async carregarGrupos() {
        // Use StorageManager method
        this.grupos = await storageManager.getGrupos();
        console.log('Carregando grupos do storage:', this.grupos.length);
        this.gruposFiltrados = [...this.grupos];
    }
    
    filtrarGrupos(termo) {
        if (!termo) {
            this.gruposFiltrados = [...this.grupos];
        } else {
            this.gruposFiltrados = this.grupos.filter(grupo =>
                grupo.nome.toLowerCase().includes(termo.toLowerCase()) ||
                grupo.id.toLowerCase().includes(termo.toLowerCase())
            );
        }
        
        // Use efficient filtering instead of full re-render
        this.aplicarFiltroVisual(termo);
    }
    
    aplicarFiltroVisual(termo) {
        const container = document.getElementById('groupsContainer');
        if (!container) return;
        
        // Add performance optimization class
        container.classList.add('filtering');
        
        const grupoItems = container.querySelectorAll('.grupo-item');
        
        if (grupoItems.length === 0) {
            // If no items exist, do full render
            container.classList.remove('filtering');
            this.renderizarLista();
            return;
        }
        
        let visibleCount = 0;
        
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            grupoItems.forEach(item => {
                const grupoId = item.getAttribute('data-id');
                const grupo = this.grupos.find(g => g.id === grupoId);
                
                if (!grupo) {
                    item.classList.add('hidden');
                    return;
                }
                
                const matches = !termo || 
                    grupo.nome.toLowerCase().includes(termo.toLowerCase()) ||
                    grupo.id.toLowerCase().includes(termo.toLowerCase());
                
                if (matches) {
                    item.classList.remove('hidden');
                    visibleCount++;
                } else {
                    item.classList.add('hidden');
                }
            });
            
            // Show empty state if no results
            this.mostrarEstadoVazio(visibleCount === 0, termo);
            
            // Remove performance optimization class
            container.classList.remove('filtering');
        });
    }
    
    mostrarEstadoVazio(mostrar, termo = '') {
        const container = document.getElementById('groupsContainer');
        if (!container) return;
        
        let emptyState = container.querySelector('.empty-state');
        
        if (mostrar) {
            if (!emptyState) {
                emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                container.appendChild(emptyState);
            }
            
            emptyState.innerHTML = termo ? `
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                </svg>
                <h3 class="empty-title">Nenhum grupo encontrado</h3>
                <p class="empty-description">Nenhum grupo corresponde à busca "${termo}"</p>
            ` : `
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" stroke-width="2"/>
                </svg>
                <h3 class="empty-title">Nenhum grupo detectado</h3>
                <p class="empty-description">Clique em "Detectar Grupos" para encontrar seus grupos do Facebook</p>
            `;
        } else if (emptyState) {
            emptyState.remove();
        }
    }
    
    ordenarGrupos(criterio) {
        switch (criterio) {
            case 'nome':
                this.gruposFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
                break;
            case 'recente':
                this.gruposFiltrados.sort((a, b) => 
                    new Date(b.dataEncontrado || 0) - new Date(a.dataEncontrado || 0)
                );
                break;
            case 'id':
                this.gruposFiltrados.sort((a, b) => a.id.localeCompare(b.id));
                break;
        }
        this.renderizarLista();
    }
    
    renderizar() {
        console.log('Renderizando grupos:', this.grupos.length);
        this.atualizarStats();
        this.renderizarLista();
        this.atualizarVisibilidadeBotoes();
    }
    
    atualizarStats() {
        const hoje = new Date().toDateString();
        const gruposRecentes = this.grupos.filter(grupo => 
            grupo.dataEncontrado && new Date(grupo.dataEncontrado).toDateString() === hoje
        ).length;
        
        const totalGrupos = document.getElementById('totalGrupos');
        const gruposRecentesEl = document.getElementById('gruposRecentes');
        
        if (totalGrupos) totalGrupos.textContent = this.grupos.length;
        if (gruposRecentesEl) gruposRecentesEl.textContent = gruposRecentes;
    }
    
    renderizarLista() {
        const container = document.getElementById('groupsContainer');
        if (!container) {
            console.error('[GruposManager] Container groupsContainer não encontrado!');
            return;
        }
        
        console.log(`[GruposManager] Renderizando ${this.gruposFiltrados.length} grupos filtrados`);
        
        if (this.gruposFiltrados.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3 class="empty-title">Nenhum grupo encontrado</h3>
                    <p class="empty-description">Clique em "Detectar Grupos" para buscar seus grupos do Facebook</p>
                </div>
            `;
            return;
        }
        
        const gruposHTML = this.gruposFiltrados.map(grupo => `
            <div class="grupo-item" data-id="${grupo.id}">
                <div class="grupo-header">
                    ${grupo.avatar ? `
                        <div class="grupo-avatar">
                            <img src="${grupo.avatar}" alt="Avatar do grupo ${grupo.nome}" onerror="this.style.display='none'">
                        </div>
                    ` : `
                        <div class="grupo-avatar grupo-avatar-placeholder">
                            <span class="avatar-initials">${grupo.nome.charAt(0).toUpperCase()}</span>
                        </div>
                    `}
                    <div class="grupo-info">
                        <h3 class="grupo-nome">${grupo.nome}</h3>
                        <div class="grupo-badges">
                            <span class="grupo-id">ID: ${grupo.id}</span>
                            ${grupo.dataEncontrado ? `<span class="grupo-data">Encontrado em: ${new Date(grupo.dataEncontrado).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="grupo-acoes">
                    <div class="grupo-status">
                        <div class="status-toggle-container">
                            <div class="status-toggle-button ${grupo.ativo !== false ? 'selected' : ''}" data-grupo-id="${grupo.id}">
                                <span class="status-text">${grupo.ativo !== false ? 'Ativo' : 'Desativado'}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn-delete" data-grupo-id="${grupo.id}">
                        ✕
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = gruposHTML;
        
        // Update group count
        const groupCountElement = document.getElementById('groupCount');
        if (groupCountElement) {
            groupCountElement.textContent = this.grupos.length;
        }
        
        // Adicionar event listeners para os botões de remoção
        container.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const grupoId = e.target.getAttribute('data-grupo-id');
                this.removerGrupo(grupoId);
            });
        });
        
        // Adicionar event listeners para os toggle buttons de status
        container.querySelectorAll('.status-toggle-button').forEach(toggleButton => {
            toggleButton.addEventListener('click', (e) => {
                const grupoId = e.currentTarget.getAttribute('data-grupo-id');
                const isCurrentlyActive = e.currentTarget.classList.contains('selected');
                const newStatus = !isCurrentlyActive;
                const statusTextElement = e.currentTarget.querySelector('.status-text');
                
                // Update visual state and text
                if (newStatus) {
                    e.currentTarget.classList.add('selected');
                    statusTextElement.textContent = 'Ativo';
                } else {
                    e.currentTarget.classList.remove('selected');
                    statusTextElement.textContent = 'Desativado';
                }
                
                // Update backend
                this.alterarStatusGrupo(grupoId, newStatus);
            });
        });
        
        console.log('[GruposManager] Grupos renderizados com sucesso');
    }
    
    async alterarStatusGrupo(id, ativo) {
        // Alteração: Removida duplicidade - Agora usa exclusivamente Dexie para atualização de grupos
        // Encontrar o grupo nos arrays e atualizar o status
        const grupoIndex = this.grupos.findIndex(grupo => grupo.id === id);
        if (grupoIndex !== -1) {
            this.grupos[grupoIndex].ativo = ativo;
        }
        
        const grupoFiltradoIndex = this.gruposFiltrados.findIndex(grupo => grupo.id === id);
        if (grupoFiltradoIndex !== -1) {
            this.gruposFiltrados[grupoFiltradoIndex].ativo = ativo;
        }
        
        // Salvar no storage
        await storageManager.updateGrupo(id, { ativo });
        
        console.log(`Grupo ${id} ${ativo ? 'ativado' : 'desativado'}`);
    }
    
    async removerGrupo(id) {
        // Use StorageManager method
        if (confirm('Tem certeza que deseja remover este grupo?')) {
            this.grupos = this.grupos.filter(grupo => grupo.id !== id);
            this.gruposFiltrados = this.gruposFiltrados.filter(grupo => grupo.id !== id);
            await storageManager.deleteGrupo(id);
            this.renderizar();
            this.atualizarVisibilidadeBotoes();
        }
    }
    
    async excluirTodosGrupos() {
        // Alteração: Removida duplicidade - Agora usa exclusivamente Dexie para exclusão de grupos
        if (this.grupos.length === 0) {
            this.showNotification('Não há grupos para excluir.', 'info');
            return;
        }
        
        // Primeira confirmação
        const primeiraConfirmacao = confirm(
            `Tem certeza que deseja excluir TODOS os ${this.grupos.length} grupos?\n\nEsta ação não pode ser desfeita!`
        );
        
        if (!primeiraConfirmacao) {
            return;
        }
        
        // Segunda confirmação
        const segundaConfirmacao = confirm(
            'ATENÇÃO: Esta é sua última chance!\nn\nTodos os grupos serão permanentemente removidos.\n\nDeseja continuar?'
        );
        
        if (!segundaConfirmacao) {
            return;
        }
        
        try {
            // Limpar arrays locais
            this.grupos = [];
            this.gruposFiltrados = [];
            
            // Limpar usando StorageManager
            await storageManager.saveGrupos([]);
            
            // Atualizar interface
            this.renderizar();
            this.atualizarVisibilidadeBotoes();
            
            // Mostrar notificação de sucesso
            this.showNotification('Todos os grupos foram excluídos com sucesso!', 'success');
            
            console.log('Todos os grupos foram excluídos');
            
        } catch (error) {
            console.error('Erro ao excluir todos os grupos:', error);
            this.showNotification('Erro ao excluir grupos. Tente novamente.', 'error');
        }
    }
    
    atualizarVisibilidadeBotoes() {
        const btnExcluirTodos = document.getElementById('btnExcluirTodos');
        if (btnExcluirTodos) {
            // Mostrar botão apenas se houver grupos
            btnExcluirTodos.style.display = this.grupos.length > 0 ? 'inline-flex' : 'none';
        }
    }
    
    showNotification(message, type = 'info') {
        // Reutilizar a função de notificação do PopupManager se disponível
        if (window.popupManager && typeof window.popupManager.showNotification === 'function') {
            window.popupManager.showNotification(message, type);
        } else {
            // Fallback simples
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }
}

// Inicializar quando o DOM estiver carregado
let gruposManager;
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize database first
        console.log('[Popup] Initializing database...');
        const dbInitialized = await initializeStorage();
        if (!dbInitialized) {
            console.error('[Popup] Failed to initialize database');
            return;
        }
        console.log('[Popup] Database initialized successfully');
        
        // Then initialize managers
        const popupManager = new PopupManager();
        gruposManager = new GruposManager();
        gruposManager.init(); // Inicializa o GruposManager
        window.gruposManager = gruposManager; // Torna acessível globalmente
        window.popupManager = popupManager; // Torna acessível globalmente
        
        // Carregar status da API Key OpenAI após inicialização
        try {
            await popupManager.loadApiKeyStatus();
        } catch (error) {
            console.error('[Popup] Erro ao carregar status da API Key:', error);
        }
    } catch (error) {
        console.error('[Popup] Critical error during initialization:', error);
    }
});

// Adicionar estilos para animações (sem alterações, apenas para completar o arquivo)
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #6b7280;
        font-style: italic;
    }
    
    .status-scheduled { color: #c52c3e; }
    .status-posting { color: #f59e0b; }
    .status-completed { color: #10b981; }
    .status-failed { color: #ef4444; }
    .status-draft { color: #6b7280; }
`;
document.head.appendChild(style);