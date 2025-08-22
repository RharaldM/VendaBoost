'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { bridgeClient } from '@/lib/bridgeClient';
// Removendo import conflitante
import { useEffect, useState, useRef, useCallback } from 'react';
import { Terminal, Wifi, WifiOff, Play, Pause, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface LogStreamProps {
  jobId: string;
}

interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  component: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Mock logs para demonstração
const mockLogs: LogEntry[] = [
  {
    timestamp: new Date('2024-01-15T10:30:15.123Z'),
    level: 'info',
    message: 'Iniciando job de publicação no Marketplace',
    component: 'job-manager',
  },
  {
    timestamp: new Date('2024-01-15T10:30:16.456Z'),
    level: 'info',
    message: 'Carregando sessão do Facebook...',
    component: 'facebook-session',
  },
  {
    timestamp: new Date('2024-01-15T10:30:17.789Z'),
    level: 'info',
    message: 'Sessão carregada com sucesso',
    component: 'facebook-session',
  },
  {
    timestamp: new Date('2024-01-15T10:30:18.012Z'),
    level: 'info',
    message: 'Navegando para o Facebook Marketplace...',
    component: 'playwright',
  },
  {
    timestamp: new Date('2024-01-15T10:30:20.345Z'),
    level: 'info',
    message: 'Página do Marketplace carregada',
    component: 'playwright',
  },
  {
    timestamp: new Date('2024-01-15T10:30:21.678Z'),
    level: 'info',
    message: 'Clicando no botão "Criar nova listagem"',
    component: 'playwright',
  },
  {
    timestamp: new Date('2024-01-15T10:30:23.901Z'),
    level: 'info',
    message: 'Preenchendo título: "iPhone 13 Pro Max 256GB"',
    component: 'form-filler',
  },
  {
    timestamp: new Date('2024-01-15T10:30:25.234Z'),
    level: 'info',
    message: 'Preenchendo descrição do produto...',
    component: 'form-filler',
  },
  {
    timestamp: new Date('2024-01-15T10:30:27.567Z'),
    level: 'info',
    message: 'Definindo preço: R$ 3.500,00',
    component: 'form-filler',
  },
  {
    timestamp: new Date('2024-01-15T10:30:29.890Z'),
    level: 'info',
    message: 'Selecionando categoria: Eletrônicos',
    component: 'form-filler',
  },
  {
    timestamp: new Date('2024-01-15T10:30:31.123Z'),
    level: 'info',
    message: 'Definindo condição: Usado - Como Novo',
    component: 'form-filler',
  },
  {
    timestamp: new Date('2024-01-15T10:30:33.456Z'),
    level: 'info',
    message: 'Clicando em "Publicar"...',
    component: 'playwright',
  },
  {
    timestamp: new Date('2024-01-15T10:32:10.789Z'),
    level: 'success',
    message: 'Anúncio publicado com sucesso!',
    component: 'job-manager',
  },
  {
    timestamp: new Date('2024-01-15T10:32:15.012Z'),
    level: 'info',
    message: 'Job concluído em 2m 0s',
    component: 'job-manager',
  },
];

function getLevelColor(level: string) {
  switch (level) {
    case 'error':
      return 'text-red-500';
    case 'warn':
      return 'text-yellow-500';
    case 'success':
      return 'text-green-500';
    case 'debug':
      return 'text-gray-400';
    default:
      return 'text-blue-500';
  }
}

function getLevelBadge(level: string) {
  switch (level) {
    case 'error':
      return <Badge variant="destructive">ERROR</Badge>;
    case 'warn':
      return <Badge className="bg-yellow-500">WARN</Badge>;
    case 'success':
      return <Badge className="bg-green-500">SUCCESS</Badge>;
    case 'debug':
      return <Badge variant="secondary">DEBUG</Badge>;
    default:
      return <Badge variant="outline">INFO</Badge>;
  }
}

function getConnectionStatusIcon(status: ConnectionStatus) {
  switch (status) {
    case 'connected':
      return <Wifi className="h-4 w-4 text-green-500" />;
    case 'connecting':
      return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
    case 'disconnected':
    case 'error':
      return <WifiOff className="h-4 w-4 text-red-500" />;
  }
}

export function LogStream({ jobId }: LogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const scrollToBottom = useCallback(() => {
    if (isAutoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [isAutoScroll]);

  const connectEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    
    try {
      // Usar SSE real do bridge
      const eventSource = bridgeClient.createEventStream(jobId);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        console.log(`[SSE] Conectado ao job ${jobId}`);
      };

      eventSource.onerror = (error) => {
        console.error(`[SSE] Erro na conexão para job ${jobId}:`, error);
        setConnectionStatus('error');
        eventSource.close();
        if (!isPaused) {
          scheduleReconnect();
        }
      };

      eventSource.addEventListener('log', (event) => {
        try {
          const logData = JSON.parse(event.data);
          const newLog: LogEntry = {
            timestamp: new Date(logData.ts), // Converter string para Date
            level: 'INFO', // Pode ser extraído do logData se disponível
            component: logData.component || 'automation', // Usar component do backend
            message: logData.msg
          };
          
          if (!isPaused) {
            setLogs(prev => [...prev, newLog]);
          }
        } catch (err) {
          console.error('[SSE] Erro ao processar log:', err);
        }
      });

      eventSource.addEventListener('status', (event) => {
        try {
          const statusData = JSON.parse(event.data);
          console.log(`[SSE] Status update:`, statusData);
          // Aqui você pode atualizar o status do job se necessário
        } catch (err) {
          console.error('[SSE] Erro ao processar status:', err);
        }
      });
      
    } catch (error) {
      console.error('Erro ao conectar SSE:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  }, [jobId, isPaused]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      toast.error('Máximo de tentativas de reconexão atingido');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Backoff exponencial
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connectEventSource();
    }, delay);
  }, [reconnectAttempts, connectEventSource]);

  const handleManualReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setReconnectAttempts(0);
    connectEventSource();
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = logs
      .map(log => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${jobId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    connectEventSource();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectEventSource]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Logs em Tempo Real
            </CardTitle>
            <CardDescription>
              Acompanhe a execução do job em tempo real
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon(connectionStatus)}
            <span className="text-sm text-muted-foreground capitalize">
              {connectionStatus === 'connected' ? 'Conectado' :
               connectionStatus === 'connecting' ? 'Conectando...' :
               connectionStatus === 'disconnected' ? 'Desconectado' : 'Erro'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isPaused ? 'Retomar' : 'Pausar'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoScroll(!isAutoScroll)}
          >
            Auto-scroll: {isAutoScroll ? 'ON' : 'OFF'}
          </Button>
          
          {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualReconnect}
            >
              <Wifi className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          ) : null}
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportLogs}
            disabled={logs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-6 pb-6" ref={scrollAreaRef}>
          <div className="space-y-2 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Terminal className="h-6 w-6 mr-2" />
                Aguardando logs...
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 rounded border-l-2 border-l-transparent hover:border-l-primary hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLevelBadge(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>{log.timestamp.toLocaleTimeString('pt-BR', { hour12: false })}</span>
                      <span>•</span>
                      <span className="font-medium">{log.component}</span>
                    </div>
                    <div className={`${getLevelColor(log.level)} break-words`}>
                      {log.message}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {isPaused && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Pause className="h-4 w-4 mr-2" />
                Stream pausado
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}