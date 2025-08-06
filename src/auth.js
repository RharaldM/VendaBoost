// ============================================
// 🔐 VendaBoost Authentication Module (Supabase)
// ============================================
// Updated to use Supabase authentication

import supabaseAuthManager from './supabase-auth.js';

class AuthManager {
    constructor() {
        // Configuration - updated for Supabase
        this.config = {
            mode: 'supabase', // 'supabase' | 'redirect' | 'embedded'
            
            // URLs - Supabase hosted login page
            loginUrl: 'https://xcjrvacqztpjsuoweztr.supabase.co',
            
            // Storage keys
            storageKeys: {
                accessToken: 'vendaboost_access_token',
                refreshToken: 'vendaboost_refresh_token',
                user: 'vendaboost_user_data',
                expiresAt: 'vendaboost_token_expires',
                lastAuth: 'vendaboost_last_auth_check'
            },
            
            // Auth check interval (5 minutes)
            tokenCheckInterval: 5 * 60 * 1000
        };
        
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authCheckTimer = null;
        this.supabaseAuth = supabaseAuthManager;
    }

    // ============================================
    // 🔍 Authentication Status Check
    // ============================================
    
    async checkAuthStatus() {
        console.log('[Auth] Checking authentication status with Supabase...');
        
        try {
            const isAuthenticated = await this.supabaseAuth.checkAuthStatus();
            
            if (isAuthenticated) {
                this.isAuthenticated = true;
                this.currentUser = this.supabaseAuth.getCurrentUser();
                console.log('[Auth] User authenticated:', this.currentUser?.email);
                return true;
            } else {
                this.isAuthenticated = false;
                this.currentUser = null;
                return false;
            }
            
        } catch (error) {
            console.error('[Auth] Error checking auth status:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    // ============================================
    // 🔑 Token Management
    // ============================================
    
    async getStoredToken() {
        return await this.supabaseAuth.getStoredAccessToken();
    }

    async setStoredToken(token) {
        // This is handled by Supabase auth manager
        console.warn('[Auth] setStoredToken is deprecated with Supabase');
        return true;
    }

    async getStoredUser() {
        return await this.supabaseAuth.getStoredUser();
    }

    async setStoredUser(userData) {
        // This is handled by Supabase auth manager
        console.warn('[Auth] setStoredUser is deprecated with Supabase');
        return true;
    }

    // ============================================
    // 🚪 Login/Logout Actions
    // ============================================
    
    async login() {
        console.log('[Auth] Initiating Supabase login...');
        
        // For Supabase, we can open the local login page or redirect to Supabase UI
        const loginPagePath = chrome.runtime.getURL('login-system/supabase-login.html');
        
        chrome.tabs.create({
            url: loginPagePath,
            active: true
        });
        
        // Set up listener for successful login
        this.setupLoginSuccessListener();
    }

    async register() {
        console.log('[Auth] Initiating Supabase registration...');
        
        // Open the same login page but in register mode
        const loginPagePath = chrome.runtime.getURL('login-system/supabase-login.html#register');
        
        chrome.tabs.create({
            url: loginPagePath,
            active: true
        });
        
        // Set up listener for successful registration
        this.setupLoginSuccessListener();
    }

    async logout() {
        console.log('[Auth] Logging out from Supabase...');
        
        try {
            await this.supabaseAuth.signOut();
        } catch (error) {
            console.error('[Auth] Supabase logout error:', error);
        }
        
        // Update state
        this.isAuthenticated = false;
        this.currentUser = null;
        
        // Stop auth check timer
        if (this.authCheckTimer) {
            clearInterval(this.authCheckTimer);
        }
        
        // Emit logout event
        this.emitAuthEvent('logout');
    }

    async clearAuthData() {
        return await this.supabaseAuth.clearAuthData();
    }

    // ============================================
    // 🎧 Event Listeners & Communication
    // ============================================
    
    setupLoginSuccessListener() {
        // Listen for messages from Supabase login page
        const messageListener = (message, sender, sendResponse) => {
            if (message.type === 'SUPABASE_LOGIN_SUCCESS' && message.authData) {
                console.log('[Auth] Supabase login success received:', message.authData.user?.email);
                
                // Update state
                this.isAuthenticated = true;
                this.currentUser = message.authData.user;
                
                // Emit login event
                this.emitAuthEvent('login', message.authData.user);
                
                // Remove listener
                chrome.runtime.onMessage.removeListener(messageListener);
                
                sendResponse({ success: true });
            }
            
            // Also handle legacy login success for backward compatibility
            if (message.type === 'LOGIN_SUCCESS' && message.token && message.user) {
                console.log('[Auth] Legacy login success received:', message.user.username);
                
                // Update state
                this.isAuthenticated = true;
                this.currentUser = message.user;
                
                // Emit login event
                this.emitAuthEvent('login', message.user);
                
                // Remove listener
                chrome.runtime.onMessage.removeListener(messageListener);
                
                sendResponse({ success: true });
            }
        };
        
        chrome.runtime.onMessage.addListener(messageListener);
    }

    // ============================================
    // 📡 Event System
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
    // 🔧 Configuration & Utility Methods
    // ============================================
    
    getCurrentUser() {
        return this.currentUser || this.supabaseAuth.getCurrentUser();
    }

    getAccessToken() {
        return this.supabaseAuth.getAccessToken();
    }

    isUserAuthenticated() {
        return this.isAuthenticated || this.supabaseAuth.isUserAuthenticated();
    }

    // Get current auth info for debugging
    getAuthInfo() {
        return {
            mode: this.config.mode,
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser,
            supabaseUrl: this.config.loginUrl,
            supabaseAuth: this.supabaseAuth.getAuthInfo()
        };
    }

    // ============================================
    // 🔄 Backward Compatibility Methods
    // ============================================
    
    // Easy method to upgrade to embedded mode later
    async upgradeToEmbedded(embeddedConfig = {}) {
        console.log('[Auth] Embedded mode upgrade not applicable for Supabase');
        return false;
    }
}

// ============================================
// 📤 Export
// ============================================

// Create singleton instance
const authManager = new AuthManager();

export default authManager;