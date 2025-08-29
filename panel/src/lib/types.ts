import { z } from 'zod';

// Schemas de validação
export const listingSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  location: z.string().min(1, 'Localização é obrigatória'),
  images: z.array(z.string()).default([]),
  condition: z.enum(['new', 'used', 'refurbished']).default('used'),
  brand: z.string().optional(), // Campo opcional para marca
});

export const jobCreateSchema = z.object({
  fbUserId: z.string().min(1, 'ID do usuário do Facebook é obrigatório'),
  listing: listingSchema,
  groups: z.array(z.string()).optional(),
});

// Tipos TypeScript
export type Listing = z.infer<typeof listingSchema>;
export type JobCreate = z.infer<typeof jobCreateSchema>;

export interface Session {
  fbUserId: string;
  lastUpdated: string;
}

// Tipos para gerenciamento de sessões do Facebook (compatível com backend)
export interface SessionInfo {
  id: string;
  userId: string;           // Backend usa 'userId'
  userName: string;         // Backend usa 'userName'  
  timestamp: string;        // Backend usa 'timestamp'
  isActive: boolean;
  isValid: boolean;         // Backend usa 'isValid'
  filePath: string;
}

export interface SessionListResponse {
  success: boolean;
  sessions: SessionInfo[];
  activeSessionId: string | null;
}

export interface SessionSelectRequest {
  sessionId: string;
}

export interface SessionSelectResponse {
  success: boolean;
  message: string;
  activeSession?: SessionInfo;
}

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  event: 'status' | 'log';
  data: unknown;
}

export interface LogEntry {
  msg: string;
  ts: string;
}

export interface BridgeHealth {
  status: 'online' | 'offline';
  timestamp?: string;
}

// Estados da aplicação
export interface AppState {
  bridgeHealth: BridgeHealth;
  sessions: Session[];
  jobs: Job[];
  selectedSession: string | null;
}

// Tipos de resposta da API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface JobCreateResponse {
  id: string;
  status: 'queued';
}

export interface JobStatusResponse {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  listing?: Listing;
  result?: {
    success: boolean;
    marketplaceUrl?: string;
    publishedAt?: string;
  };
}