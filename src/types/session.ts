export interface FacebookCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface FacebookUserInfo {
  id: string;
  name: string;
  email?: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface SessionData {
  userId: string;
  timestamp: string;
  cookies: FacebookCookie[];
  userInfo: FacebookUserInfo;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  userAgent: string;
  url: string;
  source: 'extension' | 'manual';
  metadata?: {
    userAgent?: string;
    extractedAt?: string;
    method?: string;
    needsEnhancement?: boolean;
    lastMerged?: string;
    mergeCount?: number;
    [key: string]: any;
  };
}

export interface SessionValidation {
  isValid: boolean;
  errors: string[];
}

export interface AutomationResult {
  success: boolean;
  id?: string;
  error?: string;
  details?: any;
}

export interface ExtensionMessage {
  action: 'extractSession' | 'sendSession' | 'getStatus';
  data?: any;
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SessionInfo {
  id: string;           // Nome do arquivo (ex: "session-2025-08-21T17-04-53-608Z")
  userId: string;       // ID do usuário Facebook  
  userName: string;     // Nome da conta
  timestamp: string;    // Data de captura ISO
  isActive: boolean;    // Se é a sessão atualmente ativa
  isValid: boolean;     // Se ainda não expirou (< 24h)
  filePath: string;     // Caminho completo do arquivo
}

export interface SessionListResponse {
  success: boolean;
  sessions: SessionInfo[];
  activeSessionId?: string | null;
}

export interface SessionSelectRequest {
  sessionId: string;
}

export interface SessionSelectResponse {
  success: boolean;
  message: string;
  activeSession?: SessionInfo;
}
