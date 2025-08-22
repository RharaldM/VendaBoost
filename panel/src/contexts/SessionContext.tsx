'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bridgeQueries, bridgeMutations } from '@/lib/bridgeClient';
import { SessionInfo } from '@/lib/types';
import { toast } from 'sonner';

interface SessionContextType {
  activeSession: SessionInfo | null;
  isLoading: boolean;
  error: Error | null;
  selectSession: (sessionId: string) => Promise<void>;
  refreshSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [localActiveSession, setLocalActiveSession] = useState<SessionInfo | null>(null);

  // Query para sessão ativa
  const {
    data: activeSession,
    isLoading,
    error,
    refetch: refreshSession
  } = useQuery(bridgeQueries.activeSession());

  // Mutation para selecionar sessão
  const selectSessionMutation = useMutation({
    ...bridgeMutations.selectSession(),
    onSuccess: (response) => {
      toast.success('Sessão selecionada com sucesso!');
      // Invalidar queries para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['bridge', 'facebook-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['bridge', 'active-session'] });
      
      // Atualizar estado local
      if (response.activeSession) {
        setLocalActiveSession(response.activeSession);
      }
    },
    onError: (error) => {
      console.error('Erro ao selecionar sessão:', error);
      toast.error('Erro ao selecionar sessão. Tente novamente.');
    }
  });

  // Sincronizar estado local com a query
  useEffect(() => {
    if (activeSession && !isLoading) {
      setLocalActiveSession(activeSession);
    }
  }, [activeSession, isLoading]);

  const selectSession = async (sessionId: string) => {
    await selectSessionMutation.mutateAsync({ sessionId });
  };

  const contextValue: SessionContextType = {
    activeSession: localActiveSession,
    isLoading: isLoading || selectSessionMutation.isPending,
    error: error as Error | null,
    selectSession,
    refreshSession
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

export default SessionProvider;