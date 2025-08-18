const FormData = require('form-data');
const http = require('http');

async function testAutomation() {
  try {
    console.log('🧪 Testando endpoint de automação...');
    
    const formData = new FormData();
    formData.append('title', 'Produto Teste Automação');
    formData.append('price', '199');
    formData.append('description', 'Descrição detalhada do produto de teste para verificar a automação do Facebook Marketplace.');
    formData.append('category', 'Eletrônicos');
    formData.append('location', 'São Paulo, SP');
    
    const options = {
      hostname: 'localhost',
      port: 7849,
      path: '/api/items/schedule',
      method: 'POST',
      headers: formData.getHeaders()
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data });
        });
      });
      
      req.on('error', reject);
      formData.pipe(req);
    });
    
    const result = JSON.parse(response.data);
    
    console.log('📊 Status da resposta:', response.statusCode);
    console.log('📋 Resultado:', JSON.stringify(result, null, 2));
    
    if (response.statusCode === 200) {
      console.log('✅ Teste bem-sucedido!');
      
      // Aguardar um pouco e verificar status
      console.log('⏳ Aguardando 5 segundos para verificar status...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await new Promise((resolve, reject) => {
        const statusReq = http.request({
          hostname: 'localhost',
          port: 7849,
          path: '/api/items/status',
          method: 'GET'
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, data });
          });
        });
        statusReq.on('error', reject);
        statusReq.end();
      });
      
      const statusResult = JSON.parse(statusResponse.data);
      console.log('📈 Status da automação:', JSON.stringify(statusResult, null, 2));
    } else {
      console.log('❌ Teste falhou!');
    }
    
  } catch (error) {
    console.error('💥 Erro durante o teste:', error.message);
  }
}

testAutomation();