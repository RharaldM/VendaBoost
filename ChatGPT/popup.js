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
      
      if (savedData && savedData.data) {
        currentSessionData = savedData.data;
        updateUI(true, savedData.data, savedData.lastUpdate);
        return;
      }

      // Verificar tab ativa
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url || !tab.url.includes('facebook.com')) {
        updateUI(false, null, null, 'Navegue para o Facebook primeiro');
        return;
      }

      // Verificar login na tab ativa
      try {
        // Aguardar um pouco para o content script carregar
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkLogin' });
        
        if (response && response.isLoggedIn) {
          updateUI(true, null, null, '✅ Logado - Clique para extrair dados');
          extractBtn.disabled = false;
        } else {
          // Tentar verificar cookies diretamente
          const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
          const hasUserCookie = cookies.some(c => c.name === 'c_user');
          
          if (hasUserCookie) {
            updateUI(true, null, null, '✅ Logado - Clique para extrair dados');
            extractBtn.disabled = false;
          } else {
            updateUI(false, null, null, 'Faça login no Facebook primeiro');
          }
        }
      } catch (tabError) {
        console.error('Erro ao comunicar com a aba:', tabError);
        
        // Fallback: verificar cookies diretamente
        try {
          const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
          const hasUserCookie = cookies.some(c => c.name === 'c_user');
          
          if (hasUserCookie) {
            updateUI(true, null, null, '✅ Logado (detectado via cookies) - Clique para extrair');
            extractBtn.disabled = false;
          } else {
            updateUI(false, null, null, 'Recarregue a página do Facebook');
          }
        } catch (cookieError) {
          updateUI(false, null, null, 'Recarregue a extensão');
        }
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
      
      // Primeiro, tentar injetar o content script se necessário
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injetado');
        
        // Aguardar um pouco para o script carregar
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.log('Content script já está injetado ou erro:', injectError.message);
      }
      
      // Agora tentar enviar a mensagem
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });

        if (response && response.success && response.data) {
          // Obter cookies adicionais via background script
          const cookiesResponse = await chrome.runtime.sendMessage({ action: 'getCookies' });
          
          // Combinar dados
          const completeData = {
            ...response.data,
            cookies: cookiesResponse.cookies || []
          };

          currentSessionData = completeData;
          updateUI(true, completeData, new Date().toISOString());
          
          // Salvar no storage
          await chrome.runtime.sendMessage({ 
            action: 'userLoggedIn', 
            data: completeData 
          });
          
          showSuccessMessage('Dados extraídos com sucesso!');
          
          // Enviar automaticamente para o servidor local
          sendToLocalServer(completeData);
        } else {
          updateUI(false, null, null, response?.message || 'Erro ao extrair dados');
        }
      } catch (messageError) {
        console.error('Erro ao enviar mensagem:', messageError);
        
        // Fallback: tentar extrair dados diretamente
        await extractDataFallback(tab);
      }
    } catch (error) {
      console.error('Erro na extração:', error);
      updateUI(false, null, null, 'Erro ao extrair dados: ' + error.message);
    } finally {
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extrair Dados de Sessão';
    }
  }
  
  // Função fallback para extrair dados
  async function extractDataFallback(tab) {
    try {
      // Obter cookies diretamente
      const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
      
      // Procurar pelo cookie c_user para obter o ID
      const userCookie = cookies.find(c => c.name === 'c_user');
      const userId = userCookie ? userCookie.value : 'unknown';
      
      // Criar objeto de sessão básico
      const sessionData = {
        userId: userId,
        timestamp: new Date().toISOString(),
        cookies: cookies,
        userInfo: {
          id: userId,
          name: 'Usuário do Facebook',
          profileUrl: `https://www.facebook.com/profile.php?id=${userId}`
        },
        url: tab.url,
        userAgent: navigator.userAgent,
        source: 'extension-fallback'
      };
      
      currentSessionData = sessionData;
      updateUI(true, sessionData, new Date().toISOString());
      
      // Salvar no storage
      await chrome.runtime.sendMessage({ 
        action: 'userLoggedIn', 
        data: sessionData 
      });
      
      showSuccessMessage('Dados básicos extraídos com sucesso!');
      
      // Enviar para o servidor local
      sendToLocalServer(sessionData);
      
    } catch (fallbackError) {
      console.error('Erro no fallback:', fallbackError);
      updateUI(false, null, null, 'Não foi possível extrair dados');
    }
  }
  
  // Função para enviar dados ao servidor local
  async function sendToLocalServer(data) {
    const urls = [
      'http://localhost:3000/api/facebook-session',
      'http://localhost:3001/api/facebook-session'
    ];
    
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          console.log('Dados enviados ao servidor local com sucesso');
          return;
        }
      } catch (error) {
        console.log('Tentando próxima porta...');
      }
    }
    
    console.log('Servidor local não disponível, dados salvos localmente');
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