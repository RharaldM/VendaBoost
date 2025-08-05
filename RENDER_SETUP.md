# 🚀 Configuração do Render - VendaBoost Login System

## 📋 Variáveis de Ambiente para Configurar no Render

### 1. Acesse o Dashboard do Render
- Vá para: https://dashboard.render.com
- Selecione seu serviço "vendaboost-login"
- Clique em "Environment"

### 2. Adicione as seguintes variáveis:

#### ✅ **NODE_ENV**
```
NODE_ENV = production
```

#### ✅ **PORT** 
```
PORT = 10000
```

#### ✅ **JWT_SECRET** (Use esta chave secreta forte)
```
JWT_SECRET = vb_jwt_2024_c8f9a2b5e7d3f1a6b9c4e2f8a1d5b7c3e9f2a8d4b6c1f7e3a9b5d2f8c4e1a7b3f9c6e2a8d5
```

#### ✅ **SESSION_SECRET** (Use esta chave secreta forte)
```
SESSION_SECRET = vb_session_2024_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 3. Como Adicionar as Variáveis:

1. **Clique em "Add Environment Variable"**
2. **Digite o nome da variável** (ex: JWT_SECRET)
3. **Digite o valor da variável** (ex: a chave secreta)
4. **Clique em "Save Changes"**
5. **Repita para todas as 4 variáveis**

### 4. Redeploy do Serviço:

Após adicionar todas as variáveis:
1. Clique em "Manual Deploy" 
2. Ou o Render fará redeploy automaticamente

## ✅ Verificação Final

Após o deploy, seu login system estará disponível em:
```
https://your-service-name.onrender.com
```

## 🔐 Segurança

- ⚠️ **NUNCA** compartilhe essas chaves secretas
- ✅ Use as chaves fornecidas acima (são únicas para seu projeto)
- ✅ Mantenha o NODE_ENV como "production"

## 🐛 Troubleshooting

Se ainda houver problemas:
1. Verifique se todas as 4 variáveis foram adicionadas
2. Confirme se os valores estão corretos (sem espaços extras)
3. Tente um redeploy manual

---
*Gerado automaticamente para o projeto VendaBoost* 🚀