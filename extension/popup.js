// VendaBoost Cookie Extractor - Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const userInfoEl = document.getElementById('userInfo');
  const extractBtn = document.getElementById('extractBtn');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const successMessage = document.getElementById('successMessage');
  
  const userNameEl = document.getElementById('userName');
  const userIdEl = document.getElementById('userId');
  const lastUpdateEl = document.getElementById('lastUpdate');

  let currentSessionData = null;

  // Verificar status inicial com retry
  setTimeout(async () => {
    await checkLoginStatus();
  }, 500); // Aguardar um pouco para a página carregar

  // Event listeners
  extractBtn.addEventListener('click', extractSessionData);
  exportBtn.addEventListener('click', exportToVendaBoost);
  clearBtn.addEventListener('click', clearSessionData);

  async function checkLoginStatus() {
    try {
      // Verificar se há dados salvos
      const savedData = await chrome.runtime.sendMessage({ action: 'getSessionData' });
      
      if (savedData.data) {
        currentSessionData = savedData.data;
        updateUI(true, savedData.data, savedData.lastUpdate);
        return;
      }

      // Verificar tab ativa
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('facebook.com')) {
        updateUI(false, null, null, 'Navegue para o Facebook primeiro');
        return;
      }

      // Verificar login na tab ativa
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkLogin' });
        
        if (response && response.isLoggedIn) {
          updateUI(true, null, null, 'Logado - Clique para extrair dados');
          extractBtn.disabled = false;
        } else {
          updateUI(false, null, null, 'Faça login no Facebook primeiro');
        }
      } catch (tabError) {
        console.error('Erro ao comunicar com a aba:', tabError);
        updateUI(false, null, null, 'Recarregue a página do Facebook e tente novamente');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      updateUI(false, null, null, 'Erro ao verificar status');
    }
  }

  async function extractSessionData() {
    try {
      extractBtn.disabled = true;
      extractBtn.textContent = 'Extraindo...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });

      if (response.success && response.data) {
        // Obter cookies adicionais via background script
        const cookiesResponse = await chrome.runtime.sendMessage({ action: 'getCookies' });
        
        // Combinar dados
        const completeData = {
          ...response.data,
          cookies: { ...response.data.cookies, ...cookiesResponse.cookies }
        };

        currentSessionData = completeData;
        updateUI(true, completeData, new Date().toISOString());
        
        showSuccessMessage('Dados extraídos com sucesso!');
      } else {
        updateUI(false, null, null, response.message || 'Erro ao extrair dados');
      }
    } catch (error) {
      console.error('Erro na extração:', error);
      updateUI(false, null, null, 'Erro ao extrair dados');
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extrair Dados de Sessão';
    }
  }

  async function exportToVendaBoost() {
    if (!currentSessionData) {
      alert('Nenhum dado para exportar. Extraia os dados primeiro.');
      return;
    }

    try {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exportando...';

      // Preparar dados para exportação
      const exportData = {
        timestamp: new Date().toISOString(),
        userAgent: currentSessionData.userAgent,
        cookies: currentSessionData.cookies,
        localStorage: currentSessionData.localStorage,
        sessionStorage: currentSessionData.sessionStorage,
        userInfo: currentSessionData.userInfo
      };

      // Criar arquivo JSON para download
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Criar link de download
      const url = URL.createObjectURL(dataBlob);
      const filename = `vendaboost-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      
      // Fazer download
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });

      showSuccessMessage('Arquivo exportado com sucesso!');
      
    } catch (error) {
      console.error('Erro na exportação:', error);
      alert('Erro ao exportar dados: ' + error.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Exportar para VendaBoost';
    }
  }

  async function clearSessionData() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearSessionData' });
      currentSessionData = null;
      updateUI(false, null, null, 'Dados limpos - Extraia novamente se necessário');
      showSuccessMessage('Dados limpos com sucesso!');
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
    }
  }

  function updateUI(isLoggedIn, sessionData, lastUpdate, customMessage) {
    if (customMessage) {
      statusEl.textContent = customMessage;
      statusEl.className = `status ${isLoggedIn ? 'logged-in' : 'logged-out'}`;
    } else if (isLoggedIn) {
      statusEl.textContent = '✅ Logado no Facebook';
      statusEl.className = 'status logged-in';
    } else {
      statusEl.textContent = '❌ Não logado no Facebook';
      statusEl.className = 'status logged-out';
    }

    if (sessionData) {
      userInfoEl.classList.remove('hidden');
      userNameEl.textContent = sessionData.userInfo?.name || 'Não identificado';
      userIdEl.textContent = sessionData.userInfo?.userId || 'Não identificado';
      lastUpdateEl.textContent = lastUpdate ? new Date(lastUpdate).toLocaleString('pt-BR') : 'Agora';
      
      extractBtn.disabled = false;
      exportBtn.disabled = false;
    } else {
      userInfoEl.classList.add('hidden');
      exportBtn.disabled = true;
    }
  }

  function showSuccessMessage(message) {
    successMessage.textContent = message;
    successMessage.classList.remove('hidden');
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 3000);
  }
});