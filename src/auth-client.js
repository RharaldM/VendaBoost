// ============================================
// 🔐 VendaBoost Authentication Client (Supabase)
// ============================================
// Updated to use Supabase authentication

import supabaseAuthManager from './supabase-auth.js';

class AuthClient {
    constructor() {
        this.authManager = supabaseAuthManager;
        this.config = {
            // Storage keys for backward compatibility
            storageKeys: {
                token: 'vendaboost_access_token',
                user: 'vendaboost_user_data',
                lastAuth: 'vendaboost_last_auth_check'
            }
        };
        
        this.isAuthenticated = false;
        this.currentUser = null;
    }

    // ============================================
    // 🔍 Authentication Status Check
    // ============================================
    
    async checkAuthStatus() {
        console.log('[AuthClient] Checking authentication status with Supabase...');
        
        try {
            const isAuthenticated = await this.authManager.checkAuthStatus();
            
            if (isAuthenticated) {
                this.isAuthenticated = true;
                this.currentUser = this.authManager.getCurrentUser();
                console.log('[AuthClient] User authenticated:', this.currentUser?.email);
                return true;
            } else {
                this.isAuthenticated = false;
                this.currentUser = null;
                return false;
            }
            
        } catch (error) {
            console.error('[AuthClient] Error checking auth status:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    // ============================================
    // 🔑 Authentication Actions
    // ============================================
    
    async signIn(email, password) {
        console.log('[AuthClient] Attempting sign in...');
        
        try {
            const result = await this.authManager.signIn(email, password);
            
            if (result.success) {
                this.isAuthenticated = true;
                this.currentUser = result.user;
                return result;
            } else {
                throw new Error('Sign in failed');
            }
            
        } catch (error) {
            console.error('[AuthClient] Sign in error:', error);
            throw error;
        }
    }

    // Legacy method for backward compatibility
    async login(email, password) {
        return await this.signIn(email, password);
    }

    async signUp(email, password, userData = {}) {
        console.log('[AuthClient] Attempting sign up...');
        
        try {
            const result = await this.authManager.signUp(email, password, userData);
            return result;
            
        } catch (error) {
            console.error('[AuthClient] Sign up error:', error);
            throw error;
        }
    }

    async signOut() {
        console.log('[AuthClient] Signing out...');
        
        try {
            await this.authManager.signOut();
            this.isAuthenticated = false;
            this.currentUser = null;
            
        } catch (error) {
            console.error('[AuthClient] Sign out error:', error);
            throw error;
        }
    }

    // Legacy method for backward compatibility
    async logout() {
        return await this.signOut();
    }

    // ============================================
    // 🔄 Token Management (Backward Compatibility)
    // ============================================
    
    async getStoredToken() {
        return await this.authManager.getStoredAccessToken();
    }

    async getStoredUser() {
        return await this.authManager.getStoredUser();
    }

    async getLastAuthCheck() {
        return await this.authManager.getLastAuthCheck();
    }

    async setStoredToken(token) {
        // This method is deprecated as Supabase handles token storage
        console.warn('[AuthClient] setStoredToken is deprecated with Supabase');
        return true;
    }

    async setStoredUser(userData) {
        // This method is deprecated as Supabase handles user data storage
        console.warn('[AuthClient] setStoredUser is deprecated with Supabase');
        return true;
    }

    async clearAuthData() {
        return await this.authManager.clearAuthData();
    }

    async updateLastAuthCheck() {
        return await this.authManager.updateLastAuthCheck();
    }

    // ============================================
    // 🎧 Event System
    // ============================================
    
    onAuthChange(callback) {
        this.authManager.onAuthChange(callback);
    }

    // ============================================
    // ⏰ Timer Management
    // ============================================
    
    startAuthCheckTimer() {
        this.authManager.startPeriodicAuthCheck();
    }

    stopAuthCheckTimer() {
        this.authManager.stopPeriodicAuthCheck();
    }

    // ============================================
    // 🔧 Utility Methods
    // ============================================
    
    getCurrentUser() {
        return this.currentUser || this.authManager.getCurrentUser();
    }

    getAccessToken() {
        return this.authManager.getAccessToken();
    }

    isUserAuthenticated() {
        return this.isAuthenticated || this.authManager.isUserAuthenticated();
    }

    // Test Supabase connection
    async testConnection() {
        try {
            // Simple ping to Supabase
            const response = await fetch(`${this.authManager.authManager.config.url}/rest/v1/`, {
                method: 'HEAD',
                headers: {
                    'apikey': this.authManager.authManager.config.anonKey
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('[AuthClient] Supabase connection test failed:', error);
            return false;
        }
    }

    // Get current auth info for debugging
    getAuthInfo() {
        return {
            ...this.authManager.getAuthInfo(),
            clientAuthenticated: this.isAuthenticated,
            clientUser: this.currentUser
        };
    }

    // ============================================
    // 📱 Legacy Server Validation (Deprecated)
    // ============================================
    
    async validateTokenWithServer(token) {
        // This method is deprecated but kept for backward compatibility
        console.warn('[AuthClient] validateTokenWithServer is deprecated. Using Supabase validation instead.');
        return await this.checkAuthStatus();
    }
}

// Export the AuthClient class
export default AuthClient;
