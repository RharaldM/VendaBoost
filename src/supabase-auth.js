// ============================================
// 🔐 VendaBoost Supabase Authentication Manager
// ============================================

import supabaseClient from './supabase-client.js';

class SupabaseAuthManager {
    constructor() {
        this.config = {
            // Storage keys
            storageKeys: {
                accessToken: 'vendaboost_access_token',
                refreshToken: 'vendaboost_refresh_token',
                user: 'vendaboost_user_data',
                expiresAt: 'vendaboost_token_expires',
                lastAuth: 'vendaboost_last_auth_check'
            },
            
            // Auth check interval (5 minutes)
            tokenCheckInterval: 5 * 60 * 1000,
            
            // Token refresh threshold (5 minutes before expiry)
            refreshThreshold: 5 * 60 * 1000
        };
        
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authCheckTimer = null;
        this.currentAccessToken = null;
    }

    // ============================================
    // 🔍 Authentication Status Check
    // ============================================
    
    async checkAuthStatus() {
        console.log('[SupabaseAuth] Checking authentication status...');
        
        try {
            const accessToken = await this.getStoredAccessToken();
            const refreshToken = await this.getStoredRefreshToken();
            const expiresAt = await this.getStoredTokenExpiry();
            
            if (!accessToken || !refreshToken) {
                console.log('[SupabaseAuth] No tokens found');
                this.isAuthenticated = false;
                return false;
            }

            const now = Date.now();
            const tokenExpiry = new Date(expiresAt).getTime();
            
            // Check if token needs refresh
            if (tokenExpiry - now < this.config.refreshThreshold) {
                console.log('[SupabaseAuth] Token needs refresh');
                try {
                    const refreshResult = await supabaseClient.refreshToken(refreshToken);
                    await this.storeAuthData(refreshResult);
                    this.currentAccessToken = refreshResult.access_token;
                } catch (error) {
                    console.error('[SupabaseAuth] Token refresh failed:', error);
                    await this.clearAuthData();
                    return false;
                }
            } else {
                this.currentAccessToken = accessToken;
            }

            // Validate token with Supabase
            try {
                const user = await supabaseClient.getUser(this.currentAccessToken);
                this.isAuthenticated = true;
                this.currentUser = user;
                await this.updateLastAuthCheck();
                console.log('[SupabaseAuth] User authenticated:', user.email);
                return true;
            } catch (error) {
                console.error('[SupabaseAuth] Token validation failed:', error);
                await this.clearAuthData();
                return false;
            }
            
        } catch (error) {
            console.error('[SupabaseAuth] Error checking auth status:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    // ============================================
    // 🔑 Authentication Actions
    // ============================================
    
    async signIn(email, password) {
        console.log('[SupabaseAuth] Attempting sign in for:', email);
        
        try {
            const result = await supabaseClient.signIn(email, password);
            
            if (result.access_token) {
                await this.storeAuthData(result);
                this.currentAccessToken = result.access_token;
                this.isAuthenticated = true;
                this.currentUser = result.user;
                
                console.log('[SupabaseAuth] Sign in successful:', result.user.email);
                this.emitAuthEvent('login', result.user);
                
                return {
                    success: true,
                    user: result.user,
                    token: result.access_token
                };
            } else {
                throw new Error('No access token received');
            }
            
        } catch (error) {
            console.error('[SupabaseAuth] Sign in failed:', error);
            throw error;
        }
    }

    async signUp(email, password, userData = {}) {
        console.log('[SupabaseAuth] Attempting sign up for:', email);
        
        try {
            const result = await supabaseClient.signUp(email, password, userData);
            
            console.log('[SupabaseAuth] Sign up successful:', result);
            
            return {
                success: true,
                message: 'Registration successful. Please check your email for verification.',
                user: result.user
            };
            
        } catch (error) {
            console.error('[SupabaseAuth] Sign up failed:', error);
            throw error;
        }
    }

    async signOut() {
        console.log('[SupabaseAuth] Signing out...');
        
        try {
            if (this.currentAccessToken) {
                await supabaseClient.signOut(this.currentAccessToken);
            }
        } catch (error) {
            console.error('[SupabaseAuth] Sign out API call failed:', error);
            // Continue with local cleanup even if API call fails
        }
        
        // Clear local data
        await this.clearAuthData();
        
        // Update state
        this.isAuthenticated = false;
        this.currentUser = null;
        this.currentAccessToken = null;
        
        // Stop auth check timer
        if (this.authCheckTimer) {
            clearInterval(this.authCheckTimer);
        }
        
        // Emit logout event
        this.emitAuthEvent('logout');
        
        console.log('[SupabaseAuth] Sign out complete');
    }

    // ============================================
    // 💾 Token Storage Management
    // ============================================
    
    async storeAuthData(authResult) {
        const expiresAt = new Date(Date.now() + (authResult.expires_in * 1000)).toISOString();
        
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [this.config.storageKeys.accessToken]: authResult.access_token,
                [this.config.storageKeys.refreshToken]: authResult.refresh_token,
                [this.config.storageKeys.user]: authResult.user,
                [this.config.storageKeys.expiresAt]: expiresAt,
                [this.config.storageKeys.lastAuth]: Date.now()
            }, resolve);
        });
    }

    async getStoredAccessToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.accessToken], (result) => {
                resolve(result[this.config.storageKeys.accessToken] || null);
            });
        });
    }

    async getStoredRefreshToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.refreshToken], (result) => {
                resolve(result[this.config.storageKeys.refreshToken] || null);
            });
        });
    }

    async getStoredUser() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.user], (result) => {
                resolve(result[this.config.storageKeys.user] || null);
            });
        });
    }

    async getStoredTokenExpiry() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.expiresAt], (result) => {
                resolve(result[this.config.storageKeys.expiresAt] || null);
            });
        });
    }

    async getLastAuthCheck() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.lastAuth], (result) => {
                resolve(result[this.config.storageKeys.lastAuth] || 0);
            });
        });
    }

    async updateLastAuthCheck() {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [this.config.storageKeys.lastAuth]: Date.now()
            }, resolve);
        });
    }

    async clearAuthData() {
        return new Promise((resolve) => {
            chrome.storage.local.remove([
                this.config.storageKeys.accessToken,
                this.config.storageKeys.refreshToken,
                this.config.storageKeys.user,
                this.config.storageKeys.expiresAt,
                this.config.storageKeys.lastAuth
            ], resolve);
        });
    }

    // ============================================
    // 🎧 Event System
    // ============================================
    
    emitAuthEvent(type, data = null) {
        const event = new CustomEvent('vendaboost-auth', {
            detail: { type, data, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }

    onAuthChange(callback) {
        document.addEventListener('vendaboost-auth', (event) => {
            callback(event.detail.type, event.detail.data);
        });
    }

    // ============================================
    // 🔄 Periodic Auth Check
    // ============================================
    
    startPeriodicAuthCheck() {
        // Check auth status every 5 minutes
        this.authCheckTimer = setInterval(async () => {
            await this.checkAuthStatus();
        }, this.config.tokenCheckInterval);
    }

    stopPeriodicAuthCheck() {
        if (this.authCheckTimer) {
            clearInterval(this.authCheckTimer);
            this.authCheckTimer = null;
        }
    }

    // ============================================
    // 🔧 Utility Methods
    // ============================================
    
    getCurrentUser() {
        return this.currentUser;
    }

    getAccessToken() {
        return this.currentAccessToken;
    }

    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Get current auth info for debugging
    getAuthInfo() {
        return {
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser,
            hasAccessToken: !!this.currentAccessToken,
            supabaseUrl: supabaseClient.config.url
        };
    }
}

// Create singleton instance
const supabaseAuthManager = new SupabaseAuthManager();

export default supabaseAuthManager;
