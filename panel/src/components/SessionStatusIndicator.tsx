'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { bridgeQueries } from '@/lib/bridgeClient';
import { useSession } from '@/contexts/SessionContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, ChevronDown, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface SessionStatusIndicatorProps {
  className?: string;
  showDropdown?: boolean;
}

export function SessionStatusIndicator({ 
  className = '', 
  showDropdown = true 
}: SessionStatusIndicatorProps) {
  const { activeSession, isLoading, error, selectSession, refreshSession } = useSession();
  
  const {
    data: sessionsData,
    refetch: refetchSessions
  } = useQuery(bridgeQueries.facebookSessions());

  const handleRefresh = () => {
    refreshSession();
    refetchSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    selectSession(sessionId);
  };

  // Filtrar outras sessões (excluindo a ativa)
  const otherSessions = sessionsData?.sessions?.filter(
    session => session.id !== activeSession?.id
  ) || [];

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Há poucos minutos';
    } else if (diffHours < 24) {
      return `Há ${diffHours}h`;
    } else {
      return `Há ${diffDays}d`;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Verificando...</span>
      </div>
    );
  }

  if (error || !activeSession) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Nenhuma sessão ativa
        </Badge>
        {showDropdown && (
          <Button onClick={handleRefresh} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  const sessionName = activeSession.userName || `Usuário ${activeSession.userId}`;
  const isHealthy = activeSession.isValid;

  if (!showDropdown) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge 
          variant={isHealthy ? "default" : "destructive"} 
          className="flex items-center gap-1"
        >
          {isHealthy ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          {sessionName}
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-auto p-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-32">
                  {sessionName}
                </span>
                <div className="flex items-center gap-1">
                  <Badge 
                    variant={isHealthy ? "default" : "destructive"} 
                    className="text-xs h-4"
                  >
                    {isHealthy ? 'Ativa' : 'Expirada'}
                  </Badge>
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Sessão Ativa</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <div className="px-2 py-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{sessionName}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {activeSession.userId}
                </p>
              </div>
            </div>
            
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge 
                  variant={isHealthy ? "default" : "destructive"} 
                  className="text-xs h-4"
                >
                  {isHealthy ? 'Ativa' : 'Expirada'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Capturada em:</span>
                <span>{formatLastUsed(activeSession.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Arquivo:</span>
                <span className="truncate max-w-24">{activeSession.id}</span>
              </div>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Status
          </DropdownMenuItem>
          
          {otherSessions.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Outras Sessões ({otherSessions.length})</DropdownMenuLabel>
              
              {otherSessions.map((session) => (
                <DropdownMenuItem 
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                disabled={isLoading}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="h-4 w-4" />
                      <div>
                         <div className="font-medium">{session.userName || `Usuário ${session.userId}`}</div>
                         <div className="text-xs text-muted-foreground">
                           {formatLastUsed(session.timestamp)}
                         </div>
                       </div>
                    </div>
                    {isLoading && (
              <RefreshCw className="h-3 w-3 animate-spin" />
            )}
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default SessionStatusIndicator;