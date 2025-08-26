'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { bridgeQueries } from '@/lib/bridgeClient';
import { useQuery } from '@tanstack/react-query';
import { Activity, Users, Clock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useQuery(bridgeQueries.health());

  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useQuery(bridgeQueries.sessions());

  const handleRefresh = async () => {
    try {
      await Promise.all([refetchHealth(), refetchSessions()]);
      toast.success('Dados atualizados com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar dados');
    }
  };

  const isOnline = health?.status === 'online';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema de automação
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Bridge</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {healthLoading ? (
                <Badge variant="secondary">Verificando...</Badge>
              ) : healthError ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Offline
                </Badge>
              ) : isOnline ? (
                <Badge variant="default" className="flex items-center gap-1 bg-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Online
                </Badge>
              ) : (
                <Badge variant="destructive">Erro</Badge>
              )}
            </div>
            {health?.uptime && (
              <p className="text-xs text-muted-foreground mt-1">
                Uptime: {Math.floor(health.uptime / 1000)}s
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionsLoading ? '...' : sessions?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Sessões do Facebook disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Ativos</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Jobs em execução
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Atividade</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Nenhuma atividade recente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Sessões do Facebook</CardTitle>
          <CardDescription>
            Lista de sessões disponíveis para automação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando sessões...</span>
            </div>
          ) : sessionsError ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-6 w-6 mr-2" />
              Erro ao carregar sessões
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Users className="h-6 w-6 mr-2" />
              Nenhuma sessão disponível
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <div
                  key={`${session.userId}-${session.id}-${index}`}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {session.userName || 'Usuário'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ID: {session.userId || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {new Date(session.timestamp).toLocaleDateString('pt-BR')}
                    </Badge>
                    {session.isActive ? (
                      <Badge variant="default" className="bg-green-500">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        Disponível
                      </Badge>
                    )}
                    {!session.isValid && (
                      <Badge variant="destructive">
                        Expirada
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
