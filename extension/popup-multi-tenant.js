// VendaBoost Multi-Tenant Popup Script
console.log('VendaBoost Multi-Tenant Popup loaded');

// Estados da interface
const states = {
  notConfigured: document.getElementById('notConfigured'),
  configured: document.getElementById('configured'),
  loading: document.getElementById('loading')
};

// Elementos da interface
const elements = {
  // Configuração
  userToken: document.getElementById('userToken'),
  serverUrl: document.getElementById('serverUrl'),
  configureBtn: document.getElementById('configureBtn'),
  registerLink: document.getElementById('registerLink'),
  
  // Informações do usuário
  userId: document.getElementById('userId'),
  serverInfo: document.getElementById('serverInfo'),
  configDate: document.getElementById('configDate'),
  
  // Status do Facebook
  facebookStatus: document.getElementById('facebookStatus'),
  fbIndicator: document.getElementById('fbIndicator'),
  fbInfo: document.getElementById('fbInfo'),
  
  // Ações
  syncBtn: document.getElementById('syncBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  
  // Mensagens
  messageContainer: document.getElementById('messageContainer')
};

// Estado atual
let currentConfig = null;

/**
 * Inicializar popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    showState('loading');
    
    // Verificar configuração atual
    const response = await sendMessage({ action: 'getConfig' });
    
    if (response.configured) {
      currentConfig = response.config;
      showConfiguredState();
      await checkFacebookStatus();
    } else {
      showState('notConfigured');
    }
    
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    showMessage('Erro ao inicializar extensão', 'error');
    showState('notConfigured');
  }
});

/**
 * Event Listeners
 */
elements.configureBtn.addEventListener('click', configureUser);
elements.syncBtn.addEventListener('click', syncWithFacebook);
elements.logoutBtn.addEventListener('click', logoutUser);
elements.registerLink.addEventListener('click', openRegistration);

// Enter key no token
elements.userToken.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    configureUser();
  }
});

/**
 * Configurar usuário
 */
async function configureUser() {
  const token = elements.userToken.value.trim();
  const serverUrl = elements.serverUrl.value.trim();
  
  if (!token) {
    showMessage('Por favor, cole seu token', 'error');
    return;
  }
  
  if (!serverUrl) {
    showMessage('Por favor, informe a URL do servidor', 'error');
    return;
  }
  
  try {
    showState('loading');
    clearMessages();
    
    // Validar token com o servidor
    const response = await fetch(serverUrl + '/api/users/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': token
      }
    });
    
    if (!response.ok) {
      throw new Error('Token inválido ou servidor inacessível');
    }
    
    const userData = await response.json();
    
    // Configurar na extensão
    const configResult = await sendMessage({
      action: 'configureUser',
      data: {
        userId: userData.userId,
        userToken: token,
        serverUrl: serverUrl
      }
    });
    
    if (configResult.success) {
      currentConfig = {
        userId: userData.userId,
        userToken: token,
        serverUrl: serverUrl,
        configuredAt: new Date().toISOString()
      };
      
      showMessage('✅ Extensão configurada com sucesso!', 'success');
      showConfiguredState();
      await checkFacebookStatus();
    } else {
      throw new Error(configResult.error || 'Erro ao configurar');
    }
    
  } catch (error) {
    console.error('Erro ao configurar:', error);
    showMessage('Erro: ' + error.message, 'error');
    showState('notConfigured');
  }
}

/**
 * Mostrar estado configurado
 */
function showConfiguredState() {
  if (!currentConfig) return;
  
  elements.userId.textContent = currentConfig.userId;
  elements.serverInfo.textContent = new URL(currentConfig.serverUrl).hostname;
  elements.configDate.textContent = new Date(currentConfig.configuredAt).toLocaleDateString('pt-BR');
  
  showState('configured');
}

/**
 * Verificar status do Facebook
 */
async function checkFacebookStatus() {
  try {
    // Verificar se estamos numa aba do Facebook
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    const isOnFacebook = currentTab && currentTab.url && currentTab.url.includes('facebook.com');
    
    if (!isOnFacebook) {
      elements.fbIndicator.className = 'status-indicator offline';
      elements.fbInfo.innerHTML = '❌ Abra o Facebook em uma aba para sincronizar';
      elements.facebookStatus.className = 'facebook-status';
      return;
    }
    
    // Verificar se está logado
    const response = await sendMessageToTab(currentTab.id, { action: 'checkLogin' });
    
    if (response && response.isLoggedIn) {
      // Buscar informações do usuário
      const sessionResponse = await sendMessageToTab(currentTab.id, { action: 'extractData' });
      
      if (sessionResponse && sessionResponse.success) {
        const userData = sessionResponse.data.userInfo;
        elements.fbIndicator.className = 'status-indicator online';
        elements.fbInfo.innerHTML = `
          ✅ Conectado como <strong>${userData.name}</strong><br>
          <small>ID: ${userData.id}</small>
        `;
        elements.facebookStatus.className = 'facebook-status connected';
      } else {
        elements.fbIndicator.className = 'status-indicator offline';
        elements.fbInfo.innerHTML = '⚠️ Erro ao verificar dados do usuário';
        elements.facebookStatus.className = 'facebook-status';
      }
    } else {
      elements.fbIndicator.className = 'status-indicator offline';
      elements.fbInfo.innerHTML = '❌ Você não está logado no Facebook';
      elements.facebookStatus.className = 'facebook-status';
    }
    
  } catch (error) {
    console.error('Erro ao verificar Facebook:', error);
    elements.fbIndicator.className = 'status-indicator offline';
    elements.fbInfo.innerHTML = '❌ Erro ao verificar status';
    elements.facebookStatus.className = 'facebook-status';
  }
}

/**
 * Sincronizar com Facebook
 */
async function syncWithFacebook() {
  try {
    showMessage('Sincronizando com Facebook...', 'info');
    elements.syncBtn.disabled = true;
    
    // Verificar aba atual
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url || !currentTab.url.includes('facebook.com')) {
      showMessage('Abra uma aba do Facebook para sincronizar', 'error');
      return;
    }
    
    // Extrair dados da sessão
    const sessionResponse = await sendMessageToTab(currentTab.id, { action: 'extractData' });
    
    if (!sessionResponse || !sessionResponse.success) {
      showMessage('Erro ao extrair dados do Facebook', 'error');
      return;
    }
    
    // Enviar para o servidor
    const sendResponse = await sendMessage({
      action: 'userLoggedIn',
      data: sessionResponse.data
    });
    
    if (sendResponse.success) {
      showMessage('✅ Sincronização concluída!', 'success');
      await checkFacebookStatus();
    } else {
      showMessage('Erro: ' + sendResponse.error, 'error');
    }
    
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    showMessage('Erro ao sincronizar: ' + error.message, 'error');
  } finally {
    elements.syncBtn.disabled = false;
  }
}

/**
 * Logout do usuário
 */
async function logoutUser() {
  if (!confirm('Deseja realmente desconectar a extensão?')) {
    return;
  }
  
  try {
    showState('loading');
    
    const response = await sendMessage({ action: 'clearConfig' });
    
    if (response.success) {
      currentConfig = null;
      elements.userToken.value = '';
      showMessage('✅ Extensão desconectada!', 'success');
      showState('notConfigured');
    } else {
      throw new Error('Erro ao desconectar');
    }
    
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    showMessage('Erro ao desconectar', 'error');
    showConfiguredState();
  }
}

/**
 * Abrir página de registro
 */
function openRegistration() {
  const serverUrl = elements.serverUrl.value.trim() || 'http://localhost:3000';
  chrome.tabs.create({ 
    url: serverUrl + '/register' 
  });
}

/**
 * Mostrar estado específico
 */
function showState(stateName) {
  Object.keys(states).forEach(key => {
    states[key].classList.toggle('active', key === stateName);
  });
}

/**
 * Mostrar mensagem
 */
function showMessage(text, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = text;
  
  elements.messageContainer.appendChild(messageDiv);
  
  // Remover após 5 segundos
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 5000);
}

/**
 * Limpar mensagens
 */
function clearMessages() {
  elements.messageContainer.innerHTML = '';
}

/**
 * Enviar mensagem para background script
 */
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

/**
 * Enviar mensagem para content script
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// Atualizar status periodicamente
setInterval(checkFacebookStatus, 30000); // A cada 30 segundos