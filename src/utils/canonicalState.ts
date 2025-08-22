import crypto from 'crypto';
import { SessionData, FacebookCookie } from '../types/session.js';

// Essential cookies allowlist
const ESSENTIAL_COOKIES = ['c_user', 'xs', 'datr', 'fr'] as const;

export interface CanonicalState {
  version: string;
  userId: string;
  essentialCookies: {
    c_user: string;
    xs: string;
    datr: string;
    fr: string;
  };
  deviceHint: string;
}

export interface SessionPointer {
  hash: string;
  timestamp: string;
}

/**
 * Extract essential cookies from session data
 */
function extractEssentialCookies(cookies: FacebookCookie[]): CanonicalState['essentialCookies'] {
  const essential = {} as CanonicalState['essentialCookies'];
  
  for (const cookieName of ESSENTIAL_COOKIES) {
    const cookie = cookies.find(c => c.name === cookieName);
    essential[cookieName] = cookie?.value || '';
  }
  
  return essential;
}

/**
 * Generate device hint from user agent
 */
function generateDeviceHint(userAgent: string): string {
  // Extract key browser/OS info for device fingerprinting
  const hints = [];
  
  if (userAgent.includes('Windows')) hints.push('win');
  else if (userAgent.includes('Mac')) hints.push('mac');
  else if (userAgent.includes('Linux')) hints.push('linux');
  
  if (userAgent.includes('Chrome/')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) hints.push(`chrome${match[1]}`);
  }
  
  return hints.join('-') || 'unknown';
}

/**
 * Convert session data to canonical state v1
 */
export function toCanonicalState(sessionData: SessionData): CanonicalState {
  return {
    version: '1',
    userId: sessionData.userId,
    essentialCookies: extractEssentialCookies(sessionData.cookies),
    deviceHint: generateDeviceHint(sessionData.userAgent)
  };
}

/**
 * Calculate hash from canonical state
 */
export function calculateHash(canonicalState: CanonicalState): string {
  // Ensure stable serialization by sorting keys
  const stableState = {
    version: canonicalState.version,
    userId: canonicalState.userId,
    essentialCookies: Object.keys(canonicalState.essentialCookies)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalState.essentialCookies[key as keyof typeof canonicalState.essentialCookies];
        return acc;
      }, {} as Record<string, string>),
    deviceHint: canonicalState.deviceHint
  };
  
  const serialized = JSON.stringify(stableState);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Check if two canonical states are equivalent
 */
export function areStatesEqual(state1: CanonicalState, state2: CanonicalState): boolean {
  return calculateHash(state1) === calculateHash(state2);
}

/**
 * Validate canonical state
 */
export function validateCanonicalState(state: CanonicalState): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (state.version !== '1') {
    errors.push('Invalid version, expected 1');
  }
  
  if (!state.userId) {
    errors.push('userId is required');
  }
  
  if (!state.essentialCookies) {
    errors.push('essentialCookies is required');
  } else {
    // Check for required cookies
    if (!state.essentialCookies.c_user) {
      errors.push('c_user cookie is required');
    }
    if (!state.essentialCookies.xs) {
      errors.push('xs cookie is required');
    }
  }
  
  if (!state.deviceHint) {
    errors.push('deviceHint is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}