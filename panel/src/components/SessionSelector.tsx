'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { bridgeQueries } from '@/lib/bridgeClient';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SessionSelectorProps {
  onSessionChange?: (session: any) => void; // Mantido para compatibilidade, mas não usado
}

export function SessionSelector({ onSessionChange }: SessionSelectorProps) {
  const { activeSession, isLoading: isLoadingActive, selectSession } = useSession();

  // Query para buscar sessões do Facebook
  const {
    data: sessionsData,
    isLoading: isLoadingSessions,
    error: sessionsError,
    refetch: refetchSessions
  } = useQuery(bridgeQueries.facebookSessions());

  const handleSelectSession = (sessionId: string) => {
    selectSession(sessionId);
  };

  const handleRefresh = () => {
    refetchSessions();
    toast.info('Atualizando lista de sessões...');
  };

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Há poucos minutos';
    } else if (diffHours < 24) {
      return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else {
      return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    }
  };

  if (isLoadingSessions || isLoadingActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Sessões do Facebook
          </CardTitle>
          <CardDescription>
            Carregando sessões disponíveis...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessionsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Sessões do Facebook
          </CardTitle>
          <CardDescription>
            Erro ao carregar sessões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Não foi possível carregar as sessões do Facebook.
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sessions = sessionsData?.sessions || [];
  const activeSessionId = sessionsData?.activeSessionId;


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Sessões do Facebook
            </CardTitle>
            <CardDescription>
              Selecione qual conta do Facebook usar para automação
            </CardDescription>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Nenhuma sessão do Facebook encontrada.
            </p>
            <p className="text-xs text-muted-foreground">
              Faça login no Facebook através da automação para criar uma sessão.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, index) => (
              <div key={session.id}>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {false ? ( // Avatar não disponível no backend ainda
                        <img
                          src=""
                          alt={session.userName || session.userId}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">
                          {session.userName || `Usuário ${session.userId}`}
                        </p>
                        {session.isActive && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativa
                          </Badge>
                        )}
                        {!session.isValid && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expirada
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatLastUsed(session.timestamp)}
                        </span>
                        <span>ID: {session.userId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {session.isActive ? (
                      <Badge variant="outline" className="text-xs">
                        Em Uso
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => handleSelectSession(session.id)}
                        disabled={!session.isValid}
                        size="sm"
                        variant="outline"
                      >
                        Selecionar
                      </Button>
                    )}
                  </div>
                </div>
                {index < sessions.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
        
        {activeSession && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1">Sessão Ativa:</p>
            <p className="text-sm text-muted-foreground">
              {activeSession.userName || `Usuário ${activeSession.userId}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SessionSelector;