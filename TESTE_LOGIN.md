# 🔧 Como Testar a Integração de Login

## 🚀 Passos para Testar

### 1. **Carregue a Extensão Atualizada**
1. Abra o Chrome e vá para `chrome://extensions/`
2. Certifique-se que "Modo do desenvolvedor" está ativado
3. Clique em "Recarregar" na extensão VendaBoost (ou remova e adicione novamente)
4. Carregue a pasta `dist/` como "extensão sem pacote"

### 2. **Teste o Fluxo de Login**
1. **Abra a extensão** clicando no ícone na barra de ferramentas
2. **Você deve ver a tela de login/cadastro** da extensão
3. **Clique no botão de login** - isso abrirá uma nova aba com a página de login do Render
4. **Faça login** com suas credenciais na página do Render
5. **Após o login bem-sucedido**, você verá uma mensagem de sucesso
6. **A aba deve fechar automaticamente** após alguns segundos
7. **Volte para a extensão** - ela deve agora mostrar a interface principal (não mais a tela de login)

### 3. **Verifique se Funcionou**

#### ✅ **Sinais de Sucesso:**
- A extensão não mostra mais a tela de login/cadastro
- Você vê a interface principal da VendaBoost
- No console da extensão (F12 → Console), você vê mensagens como:
  ```
  [Background] Login success received: seu_username
  [Background] Auth data stored successfully
  [Popup] Auth status changed: true
  ```

#### ❌ **Se Não Funcionou:**
- A extensão ainda mostra a tela de login após fechar a aba
- Não há mensagens de sucesso no console
- A interface principal não carrega

### 4. **Debug/Troubleshooting**

#### **Verificar Console da Extensão:**
1. Clique com botão direito na extensão → "Inspecionar popup"
2. Vá para a aba "Console"
3. Procure por erros ou mensagens de debug

#### **Verificar Console da Página de Login:**
1. Na página de login do Render, pressione F12
2. Vá para "Console"
3. Faça o login e veja se aparecem mensagens como:
   ```
   Message sent to extension: {success: true}
   Auth data stored in chrome.storage
   ```

#### **Verificar Storage da Extensão:**
1. No console da extensão, digite:
   ```javascript
   chrome.storage.local.get(['vendaboost_auth_token', 'vendaboost_user_data'], console.log)
   ```
2. Deve mostrar o token e dados do usuário se o login funcionou

### 5. **URLs Importantes**

- **Sistema de Login**: https://vendaboost-login.onrender.com
- **Extensão**: `chrome-extension://[id-da-extensao]/popup.html`

### 6. **Credenciais de Teste**

Se você ainda não tem uma conta, use:
- **Username**: admin
- **Password**: admin123

## 🐛 Problemas Comuns

### **Problema**: "Extension context invalidated"
**Solução**: Recarregue a extensão em `chrome://extensions/`

### **Problema**: A página de login não abre
**Solução**: Verifique se as permissões estão corretas no `manifest.json`

### **Problema**: Login funciona mas extensão não atualiza
**Solução**: Verifique se o background script está rodando (veja console)

### **Problema**: "Network error" na página de login
**Solução**: Verifique se o servidor do Render está funcionando

## 📝 Logs Esperados

### **No Console da Extensão (Background):**
```
[Background] Login success received: username
[Background] Auth data stored successfully
```

### **No Console da Extensão (Popup):**
```
[Popup] Auth status changed: true
[Popup] User authenticated externally, hiding auth screen
[Auth] User authenticated: username
```

### **No Console da Página de Login:**
```
Login realizado com sucesso!
Message sent to extension: {success: true}
Auth data stored in chrome.storage
```

---

**💡 Dica**: Se algo não funcionar, primeiro recarregue a extensão e tente novamente. A comunicação entre páginas web e extensões às vezes precisa de uma segunda tentativa.
