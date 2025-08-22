import { env } from './env';
import {
  Session,
  Job,
  JobCreate,
  JobCreateResponse,
  JobStatusResponse,
  BridgeHealth,
  LogEntry,
  SessionInfo,
  SessionListResponse,
  SessionSelectRequest,
  SessionSelectResponse
} from './types';

export class BridgeClient {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL?: string, timeout = 10000) {
    this.baseURL = baseURL || env.NEXT_PUBLIC_BRIDGE_URL;
    this.timeout = timeout;
  }

  /**
   * Verifica se o bridge está online
   */
  async healthCheck(): Promise<BridgeHealth> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/healthz`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        return {
          status: text === 'ok' ? 'online' : 'offline',
          timestamp: new Date().toISOString()
        };
      }

      return { status: 'offline' };
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'offline' };
    }
  }

  /**
   * Lista todas as sessões salvas
   */
  async getSessions(): Promise<SessionInfo[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SessionListResponse = await response.json();
      return data.sessions || [];
    } catch (error) {
      console.error('Failed to get sessions:', error);
      throw new Error('Falha ao carregar sessões');
    }
  }

  /**
   * Lista todas as sessões do Facebook disponíveis
   */
  async getFacebookSessions(): Promise<SessionListResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Facebook sessions:', error);
      throw new Error('Falha ao carregar sessões do Facebook');
    }
  }

  /**
   * Obtém a sessão ativa atual
   */
  async getActiveSession(): Promise<SessionInfo | null> {
    try {
      const response = await fetch(`${this.baseURL}/api/sessions/active`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.activeSession || null;
    } catch (error) {
      console.error('Failed to get active session:', error);
      throw new Error('Falha ao carregar sessão ativa');
    }
  }

  /**
   * Seleciona uma sessão como ativa
   */
  async selectSession(sessionId: string): Promise<SessionSelectResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/sessions/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to select session:', error);
      throw new Error('Falha ao selecionar sessão');
    }
  }

  /**
   * Faz upload de imagens
   */
  async uploadImages(files: File[]): Promise<{ success: boolean; files: Array<{ originalName: string; filename: string; path: string; size: number; mimetype: string }> }> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch(`${this.baseURL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to upload images:', error);
      throw error;
    }
  }

  /**
   * Cria um novo job de publicação
   */
  async createJob(jobData: JobCreate): Promise<JobCreateResponse> {
    try {
      const response = await fetch(`${this.baseURL}/jobs/marketplace.publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create job:', error);
      throw error instanceof Error ? error : new Error('Falha ao criar job');
    }
  }

  /**
   * Obtém o status de um job
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    try {
      const response = await fetch(`${this.baseURL}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get job status:', error);
      throw error instanceof Error ? error : new Error('Falha ao obter status do job');
    }
  }

  /**
   * Cria uma conexão SSE para eventos de um job
   */
  createEventStream(jobId: string): EventSource {
    const url = `${this.baseURL}/events?jobId=${encodeURIComponent(jobId)}`;
    return new EventSource(url);
  }

  /**
   * Wrapper para facilitar o uso do SSE com callbacks
   */
  subscribeToJobEvents(
    jobId: string,
    callbacks: {
      onStatus?: (data: unknown) => void;
      onLog?: (data: LogEntry) => void;
      onError?: (error: Event) => void;
      onOpen?: () => void;
    }
  ): () => void {
    const eventSource = this.createEventStream(jobId);

    // Configurar listeners
    if (callbacks.onOpen) {
      eventSource.onopen = callbacks.onOpen;
    }

    if (callbacks.onError) {
      eventSource.onerror = callbacks.onError;
    }

    if (callbacks.onStatus) {
      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data);
          callbacks.onStatus!(data);
        } catch (error) {
          console.error('Failed to parse status event:', error);
        }
      });
    }

    if (callbacks.onLog) {
      eventSource.addEventListener('log', (event) => {
        try {
          const data = JSON.parse(event.data);
          callbacks.onLog!(data);
        } catch (error) {
          console.error('Failed to parse log event:', error);
        }
      });
    }

    // Retornar função de cleanup
    return () => {
      eventSource.close();
    };
  }

  /**
   * Testa a conectividade com retry
   */
  async testConnection(retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        const health = await this.healthCheck();
        if (health.status === 'online') {
          return true;
        }
      } catch (error) {
        console.warn(`Connection test attempt ${i + 1} failed:`, error);
      }

      if (i < retries - 1) {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    return false;
  }

  /**
   * Configura um novo baseURL
   */
  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  /**
   * Obtém o baseURL atual
   */
  getBaseURL(): string {
    return this.baseURL;
  }
}

// Instância singleton do cliente
export const bridgeClient = new BridgeClient();

// Hook personalizado para React Query
export const bridgeQueries = {
  health: () => ({
    queryKey: ['bridge', 'health'],
    queryFn: () => bridgeClient.healthCheck(),
    refetchInterval: 30000, // Verificar a cada 30 segundos
    retry: false,
  }),

  sessions: () => ({
    queryKey: ['bridge', 'sessions'],
    queryFn: () => bridgeClient.getSessions(),
    staleTime: 60000, // Considerar dados válidos por 1 minuto
  }),

  facebookSessions: () => ({
    queryKey: ['bridge', 'facebook-sessions'],
    queryFn: () => bridgeClient.getFacebookSessions(),
    staleTime: 30000, // Considerar dados válidos por 30 segundos
  }),

  activeSession: () => ({
    queryKey: ['bridge', 'active-session'],
    queryFn: () => bridgeClient.getActiveSession(),
    staleTime: 30000, // Considerar dados válidos por 30 segundos
  }),

  jobStatus: (jobId: string) => ({
    queryKey: ['bridge', 'jobs', jobId],
    queryFn: () => bridgeClient.getJobStatus(jobId),
    refetchInterval: (data: JobStatusResponse | undefined) => {
      // Parar de fazer polling se o job terminou
      if (data?.status === 'succeeded' || data?.status === 'failed') {
        return false;
      }
      return 5000; // Verificar a cada 5 segundos
    },
  }),
};

// Mutations para React Query
export const bridgeMutations = {
  uploadImages: () => ({
    mutationFn: (files: File[]) => bridgeClient.uploadImages(files),
  }),
  
  createJob: () => ({
    mutationFn: (jobData: JobCreate) => bridgeClient.createJob(jobData),
  }),

  selectSession: () => ({
    mutationFn: (data: { sessionId: string }) => bridgeClient.selectSession(data.sessionId),
  }),
};