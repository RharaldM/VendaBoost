const http = require('http');
const FormData = require('form-data');

// Test data
const testData = {
  title: 'Produto de Teste',
  price: '100',
  description: 'Descrição do produto de teste para automação',
  category: 'Eletrônicos',
  location: 'São Paulo, SP'
};

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testAutomation() {
  try {
    console.log('🧪 Testando endpoint de automação...');
    
    // Create form data
    const form = new FormData();
    Object.keys(testData).forEach(key => {
      form.append(key, testData[key]);
    });
    
    const formData = form.getBuffer();
    const headers = form.getHeaders();
    
    // Test POST request
    const postOptions = {
      hostname: 'localhost',
      port: 7849,
      path: '/api/items/schedule',
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': formData.length
      }
    };
    
    const postResult = await makeRequest(postOptions, formData);
    console.log('📤 POST /api/items/schedule:', {
      status: postResult.status,
      success: postResult.data.success,
      message: postResult.data.message
    });
    
    if (postResult.data.success) {
      console.log('✅ Item agendado com sucesso!');
      
      // Wait a bit and check automation status
      console.log('⏳ Aguardando 5 segundos para verificar status...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check automation status
      const statusOptions = {
        hostname: 'localhost',
        port: 7849,
        path: '/api/items/status',
        method: 'GET'
      };
      
      const statusResult = await makeRequest(statusOptions);
      console.log('📊 Status da automação:', {
        status: statusResult.status,
        isAutomationRunning: statusResult.data.isAutomationRunning,
        error: statusResult.data.logs?.filter(log => log.type === 'error').length || 0
      });
      
      if (statusResult.data.logs) {
        const recentLogs = statusResult.data.logs.slice(-3);
        console.log('📝 Últimos logs:');
        recentLogs.forEach(log => {
          console.log(`   ${log.type}: ${log.message}`);
        });
      }
    } else {
      console.log('❌ Falha ao agendar item:', postResult.data.error);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testAutomation();