// Script de teste para verificar integra��o da extens�o
// Execute no console do Chrome com a extens�o instalada

console.log('>� Iniciando teste de integra��o da extens�o VendaBoost...\n');

// Fun��o para testar extra��o de cookies
async function testCookieExtraction() {
  console.log('<j Testando extra��o de cookies...');
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCookies' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('L Erro ao obter cookies:', chrome.runtime.lastError);
        resolve(false);
        return;
      }
      
      const cookies = response.cookies || [];
      console.log(` ${cookies.length} cookies extra�dos`);
      
      // Verificar cookies essenciais
      const essentialCookies = ['c_user', 'xs', 'datr', 'fr', 'sb'];
      const foundCookies = cookies.map(c => c.name);
      
      console.log('\n=� Cookies essenciais:');
      essentialCookies.forEach(name => {
        const found = foundCookies.includes(name);
        console.log(`  ${found ? '' : 'L'} ${name}: ${found ? 'Encontrado' : 'N�O ENCONTRADO'}`);
      });
      
      // Mostrar cookie datr especificamente (importante para valida��o)
      const datrCookie = cookies.find(c => c.name === 'datr');
      if (datrCookie) {
        console.log('\n📍 Cookie datr detalhado:');
        console.log('  - Domain:', datrCookie.domain);
        console.log('  - Value:', datrCookie.value.substring(0, 10) + '...');
        console.log('  - HttpOnly:', datrCookie.httpOnly);
        console.log('  - Secure:', datrCookie.secure);
      }
      
      resolve(cookies.length > 0);
    });
  });
}

// Fun��o para testar envio de dados completos
async function testDataSending() {
  console.log('\n=� Testando envio de dados completos...');
  
  // Simular dados completos
  const testData = {
    userId: document.cookie.match(/c_user=(\d+)/)?.[1] || '123456789',
    userName: document.title.split('|')[0]?.trim() || 'Test User',
    userInfo: {
      id: document.cookie.match(/c_user=(\d+)/)?.[1] || '123456789',
      name: document.title.split('|')[0]?.trim() || 'Test User',
      email: '',
      profileUrl: window.location.href,
      avatarUrl: ''
    },
    userAgent: navigator.userAgent,
    url: window.location.href,
    cookies: [], // Ser� preenchido pela extens�o
    localStorage: { test: 'data' },
    sessionStorage: { test: 'data' },
    timestamp: new Date().toISOString(),
    source: 'test-script'
  };
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ 
      action: 'sendToLocalhost', 
      data: testData 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('L Erro ao enviar dados:', chrome.runtime.lastError);
        resolve(false);
        return;
      }
      
      if (response && response.success) {
        console.log(' Dados enviados com sucesso!');
        console.log('=� Resposta do servidor:', response.result);
      } else {
        console.log('L Falha ao enviar dados:', response?.error || 'Erro desconhecido');
      }
      
      resolve(response?.success || false);
    });
  });
}

// Fun��o para verificar servidor
async function testServerConnection() {
  console.log('\n< Testando conex�o com servidor...');
  
  const urls = [
    'http://localhost:3001/health',
    'http://localhost:3000/health'
  ];
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(` Servidor ativo em ${url.replace('/health', '')}`);
        console.log('=� Timestamp:', data.timestamp);
        return true;
      }
    } catch (e) {
      // Continue para pr�xima URL
    }
  }
  
  console.log('L Nenhum servidor encontrado nas portas 3000/3001');
  console.log('=� Execute: node dist/cli.js --start-server');
  return false;
}

// Fun��o principal de teste
async function runTests() {
  console.log('P'.repeat(50));
  console.log('=� TESTE DE INTEGRA��O - VENDABOOST EXTENSION');
  console.log('P'.repeat(50));
  
  // 1. Verificar se est� no Facebook
  const onFacebook = window.location.hostname.includes('facebook.com');
  console.log(`\n=� Localiza��o: ${onFacebook ? ' Facebook.com' : 'L N�O est� no Facebook'}`);
  
  if (!onFacebook) {
    console.log('� Abra este teste no Facebook.com para resultados completos');
  }
  
  // 2. Verificar login
  const isLoggedIn = document.cookie.includes('c_user=');
  console.log(`=d Status de login: ${isLoggedIn ? ' Logado' : 'L N�o logado'}`);
  
  if (isLoggedIn) {
    const userId = document.cookie.match(/c_user=(\d+)/)?.[1];
    console.log(`<� User ID: ${userId || 'N�o encontrado'}`);
  }
  
  // 3. Testar servidor
  const serverOk = await testServerConnection();
  
  // 4. Testar cookies (s� se estiver no Facebook)
  if (onFacebook) {
    const cookiesOk = await testCookieExtraction();
    
    // 5. Testar envio de dados (s� se servidor estiver OK)
    if (serverOk) {
      const sendOk = await testDataSending();
    }
  }
  
  console.log('\n' + 'P'.repeat(50));
  console.log('=� TESTE CONCLU�DO');
  console.log('P'.repeat(50));
  
  // Resumo
  console.log('\n=� Resumo:');
  console.log('  - Facebook:', onFacebook ? '' : 'L');
  console.log('  - Login:', isLoggedIn ? '' : 'L');
  console.log('  - Servidor:', serverOk ? '' : 'L');
  
  if (!onFacebook) {
    console.log('\n� Para teste completo:');
    console.log('1. Abra o Facebook.com');
    console.log('2. Fa�a login');
    console.log('3. Abra o console (F12)');
    console.log('4. Cole e execute este script novamente');
  }
}

// Executar testes
runTests().catch(console.error);