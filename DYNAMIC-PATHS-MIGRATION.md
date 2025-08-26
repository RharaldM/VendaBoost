# 🔧 Dynamic Paths Migration - VendaBoost Extension

## 📋 Resumo das Mudanças

O sistema de paths hardcoded foi refatorado para **paths dinâmicos multiplataforma**, melhorando a portabilidade e facilidade de deploy.

## ✅ O que foi Implementado

### 1. **Bridge Server (`start-file-bridge.js`)**
- ✅ Detecção automática de diretório base
- ✅ Suporte a variáveis de ambiente (`USER_DATA_DIR`, `VENDA_BOOST_DATA_DIR`)
- ✅ Fallback inteligente para diretório do projeto
- ✅ Sistema de migração automática de dados existentes
- ✅ Novo endpoint `/api/file-system/config` para configuração dinâmica

### 2. **Extension (`localFileManager.js`)**
- ✅ Remoção de paths hardcoded do Windows
- ✅ Carregamento dinâmico de configuração do servidor
- ✅ Construção de paths multiplataforma (`buildPath()`)
- ✅ Compatibilidade com Linux/Mac/Windows

### 3. **Configuração**
- ✅ Arquivo `.env.example` atualizado com novas variáveis
- ✅ Documentação de cenários de uso

## 🚀 Benefícios

1. **Multiplataforma**: Funciona em Windows, Linux e Mac
2. **Portável**: Deploy em qualquer servidor sem hardcode
3. **Flexível**: Configuração via variáveis de ambiente
4. **Automático**: Migração de dados existentes sem intervenção
5. **Compatível**: Mantém funcionamento atual durante transição

## ⚙️ Como Usar

### **Cenário 1: Uso Atual (sem mudanças)**
```bash
# Funciona igual ao anterior, dados em ./data/
node start-file-bridge.js
```

### **Cenário 2: Diretório Personalizado**
```bash
# Define diretório customizado
export USER_DATA_DIR=/home/user/meus-dados
node start-file-bridge.js
```

### **Cenário 3: Produção**
```bash
# Configuração para servidor
export USER_DATA_DIR=/var/vendaboost/data
export NODE_ENV=production
export PORT=3000
node start-file-bridge.js
```

## 📁 Estrutura de Paths

### **Detecção Automática (por prioridade)**:
1. `process.env.USER_DATA_DIR`
2. `process.env.VENDA_BOOST_DATA_DIR`
3. Projeto atual (`process.cwd()/data`)
4. Fallback (`__dirname/data`)

### **Migração Automática**:
- Detecta dados em `C:\Users\Hardd\Documents\AUTOMACAO\data`
- Migra automaticamente para novo diretório (se diferente)
- Não sobrescreve arquivos existentes
- Log detalhado do processo

## 🔄 Fluxo de Funcionamento

1. **Servidor inicia** → Detecta diretório base
2. **Migração automática** → Move dados existentes (se necessário)
3. **Extension conecta** → Solicita configuração via API
4. **Paths atualizados** → Usa configuração dinâmica do servidor

## 🧪 Testes Realizados

- ✅ Funcionamento atual mantido
- ✅ Migração automática funcionando
- ✅ API de configuração operacional
- ✅ Paths multiplataforma validados

## 📝 Variáveis de Ambiente

```bash
# Diretório de dados da extensão
USER_DATA_DIR=./data                    # Relativo ao projeto
USER_DATA_DIR=/custom/path/to/data      # Absoluto customizado
VENDA_BOOST_DATA_DIR=./custom-data      # Nome alternativo

# Configurações do servidor
PORT=3000                               # Porta do bridge
NODE_ENV=development                    # Ambiente
```

## ⚠️ Notas Importantes

1. **Compatibilidade**: Dados existentes são migrados automaticamente
2. **Performance**: Zero impacto na performance atual
3. **Rollback**: Possível voltar ao sistema anterior se necessário
4. **Logs**: Processo de migração é logado detalhadamente

## 🎯 Próximos Passos Sugeridos

1. **Validação de Conectividade**: Sistema de heartbeat para bridge
2. **Error Handling**: Melhorar tratamento de erros com retry inteligente
3. **Monitoring**: Dashboard de status do bridge na extensão