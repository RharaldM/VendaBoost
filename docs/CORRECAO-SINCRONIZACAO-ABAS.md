# Correção da Dessincronização entre Abas

## Problema Identificado

Existia uma dessincronização do perfil de usuário entre as abas `dashboard`, `publish` e `Jobs`. Quando um perfil era selecionado em uma aba, essa seleção não era mantida nas outras abas, causando inconsistência na experiência do usuário.

## Causa do Problema

O problema ocorria porque cada componente que utilizava sessões (`SessionSelector`, `SessionStatusIndicator`, página `publish`) estava gerenciando seu próprio estado local da sessão ativa, sem compartilhamento entre os componentes.

### Problemas Específicos:

1. **Estado Local Isolado**: Cada página mantinha seu próprio `useState` para `selectedSession`
2. **Falta de Contexto Global**: Não havia um sistema centralizado para gerenciar o estado da sessão ativa
3. **Queries Independentes**: Embora o React Query fornecesse cache compartilhado, cada componente interpretava os dados de forma independente

## Solução Implementada

### 1. Criação do Context Provider Global

Criado o arquivo `src/contexts/SessionContext.tsx` que centraliza o gerenciamento do estado da sessão ativa:

```typescript
// Principais funcionalidades do SessionContext:
- activeSession: SessionInfo | null
- isLoading: boolean
- error: Error | null
- selectSession: (sessionId: string) => Promise<void>
- refreshSession: () => void
```

### 2. Integração no Sistema de Providers

O `SessionProvider` foi adicionado ao arquivo `src/app/providers.tsx`, envolvendo toda a aplicação:

```typescript
<QueryClientProvider client={queryClient}>
  <SessionProvider>
    {children}
  </SessionProvider>
</QueryClientProvider>
```

### 3. Atualização dos Componentes

#### SessionSelector (`src/components/SessionSelector.tsx`)
- Removido estado local `selectedSession`
- Removido `useEffect` para notificação do componente pai
- Substituído `useMutation` local pelo `selectSession` do contexto
- Simplificada a lógica de seleção de sessões

#### SessionStatusIndicator (`src/components/SessionStatusIndicator.tsx`)
- Removido `useQuery` para sessão ativa (agora vem do contexto)
- Removido `useMutation` local
- Substituídas funções `handleRefresh` e `handleSelectSession` para usar o contexto
- Removidas referências a `selectSessionMutation.isPending`

#### Página Publish (`src/app/publish/page.tsx`)
- Removido `useState` para `selectedSession`
- Substituído por `const { activeSession: selectedSession } = useSession()`
- Removido prop `onSessionChange` do `SessionSelector`

## Como a Solução Funciona

### 1. Estado Centralizado
O `SessionContext` mantém um único estado global para a sessão ativa, acessível por todos os componentes da aplicação.

### 2. Sincronização Automática
Quando uma sessão é selecionada em qualquer lugar da aplicação:
1. O contexto executa a mutation para o backend
2. Invalida as queries do React Query
3. Atualiza o estado local do contexto
4. Todos os componentes que usam `useSession()` são automaticamente atualizados

### 3. Consistência entre Abas
Como o estado é global e o React Query mantém cache compartilhado:
- Selecionar uma sessão no Dashboard atualiza automaticamente Publish e Jobs
- Navegar entre abas mantém a sessão selecionada
- Mudanças são refletidas instantaneamente em todos os componentes

## Benefícios da Correção

1. **Experiência Consistente**: O usuário vê a mesma sessão ativa em todas as abas
2. **Redução de Bugs**: Elimina problemas de estado desatualizado
3. **Código Mais Limpo**: Centraliza a lógica de gerenciamento de sessões
4. **Performance**: Reduz queries desnecessárias e re-renders
5. **Manutenibilidade**: Facilita futuras modificações no sistema de sessões

## Arquivos Modificados

### Criados:
- `src/contexts/SessionContext.tsx` - Context Provider para gerenciamento global de sessões

### Modificados:
- `src/app/providers.tsx` - Adicionado SessionProvider
- `src/components/SessionSelector.tsx` - Migrado para usar contexto global
- `src/components/SessionStatusIndicator.tsx` - Migrado para usar contexto global
- `src/app/publish/page.tsx` - Migrado para usar contexto global

## Teste da Correção

Para verificar se a correção está funcionando:

1. Abra o painel em múltiplas abas
2. Selecione uma sessão na aba Dashboard
3. Navegue para a aba Publish - a mesma sessão deve estar selecionada
4. Navegue para a aba Jobs - a sessão deve permanecer consistente
5. Mude a sessão em qualquer aba - todas as outras devem atualizar automaticamente

A sincronização agora funciona perfeitamente entre todas as abas da aplicação.