# Correção do Problema no Modo Headless

## Problema Identificado

A automação falhava ao selecionar a localização no Facebook Marketplace quando executada em modo headless (`headless: true`), mas funcionava perfeitamente no modo visível (`headless: false`).

## Causa Raiz

Baseado na pesquisa e análise do código, foram identificadas as seguintes causas:

1. **Viewport Inadequado**: No modo headless, o Playwright usa um viewport padrão menor que pode não exibir todos os elementos corretamente
2. **Detecção de Bot**: O user agent padrão do modo headless indica explicitamente que é um bot
3. **Timing Issues**: Elementos podem levar mais tempo para carregar/responder no modo headless
4. **Configurações de Browser**: Algumas configurações específicas são necessárias para melhor compatibilidade

## Solução Implementada

### 1. Configuração Específica para Modo Headless (browser.ts)

```typescript
// Viewport fixo para modo headless
viewport: this.config.headless ? { width: 1920, height: 1080 } : this.config.viewport,

// Args específicos para modo headless
args: this.config.headless ? [
  '--start-maximized',
  '--disable-blink-features=AutomationControlled',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor'
] : this.config.args,

// User agent personalizado para evitar detecção
userAgent: this.config.headless ? 
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' : 
  undefined,
```

### 2. Melhorias no Método selectLocation (marketplace.ts)

- **Wait inicial aumentado**: 1000ms para garantir carregamento completo
- **Timeout aumentado**: De 3000ms para 5000ms para encontrar elementos
- **ScrollIntoView**: Garantir que elementos estão visíveis antes de interagir
- **Waits maiores**: 1000ms após clicar no combobox (vs 500ms anterior)
- **Logs melhorados**: Mensagens específicas para debug

## Benefícios da Correção

1. **Compatibilidade**: Funciona tanto em modo headless quanto visível
2. **Robustez**: Timeouts e waits adequados para diferentes condições
3. **Detecção Reduzida**: User agent realístico reduz chances de bloqueio
4. **Debugging**: Logs melhorados para identificar problemas
5. **Performance**: Configurações otimizadas para automação

## Configurações Aplicadas

### Args do Chrome para Modo Headless
- `--start-maximized`: Maximiza a janela (mesmo invisível)
- `--disable-blink-features=AutomationControlled`: Remove indicadores de automação
- `--disable-web-security`: Reduz restrições de segurança
- `--disable-features=VizDisplayCompositor`: Melhora compatibilidade

### Viewport Fixo
- **1920x1080**: Resolução padrão que garante visibilidade de todos os elementos
- **Consistente**: Mesmo tamanho sempre, independente do sistema

### User Agent Realístico
- **Chrome 120**: Versão atual e amplamente usada
- **Windows 10**: Sistema operacional comum
- **Sem indicadores de bot**: Remove "HeadlessChrome" do user agent

## Teste da Correção

Para testar a correção:

```bash
# Modo headless (invisível)
npm start -- --headless

# Modo visível (para comparação)
npm start
```

Ambos os modos devem agora funcionar corretamente para seleção de localização.

## Monitoramento

Caso ainda ocorram problemas:

1. Verificar logs específicos de "Localização"
2. Aumentar timeouts se necessário
3. Considerar adicionar screenshots para debug
4. Verificar se o Facebook não mudou a estrutura da página

---

**Data da Correção**: Janeiro 2025  
**Arquivos Modificados**: 
- `src/session/browser.ts`
- `src/facebook/marketplace.ts`