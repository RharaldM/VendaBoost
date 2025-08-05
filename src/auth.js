// ============================================
// 🔐 VendaBoost Authentication Module
// ============================================
// Modular auth system - easy to upgrade from simple redirect to full integration

class AuthManager {
    constructor() {
        // Configuration - easily changeable for different integration types
        this.config = {
            // Current: Simple redirect mode
            mode: 'redirect', // 'redirect' | 'embedded' | 'popup'
            
            // URLs - centralized for easy management
            loginUrl: 'https://vendaboost-login.onrender.com', // Your Render URL
            registerUrl: 'https://vendaboost-login.onrender.com',
            validateUrl: 'https://vendaboost-login.onrender.com/api/validate',
            
            // Storage keys
            storageKeys: {
                token: 'vendaboost_auth_token',
                user: 'vendaboost_user_data',
                lastAuth: 'vendaboost_last_auth_check'
            },
            
            // Auth check interval (5 minutes)
            tokenCheckInterval: 5 * 60 * 1000
        };
        
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authCheckTimer = null;
    }

    // ============================================
    // 🔍 Authentication Status Check
    // ============================================
    
    async checkAuthStatus() {
        console.log('[Auth] Checking authentication status...');
        
        try {
            const token = await this.getStoredToken();
            
            if (!token) {
                console.log('[Auth] No token found');
                this.isAuthenticated = false;
                return false;
            }

            // For simple mode, just check if token exists and is not expired
            if (this.config.mode === 'redirect') {
                const user = await this.getStoredUser();
                if (user) {
                    this.isAuthenticated = true;
                    this.currentUser = user;
                    console.log('[Auth] User authenticated:', user.username);
                    return true;
                }
            }

            // Future: For embedded mode, validate token with server
            // if (this.config.mode === 'embedded') {
            //     return await this.validateTokenWithServer(token);
            // }

            return false;
            
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
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.token], (result) => {
                resolve(result[this.config.storageKeys.token] || null);
            });
        });
    }

    async setStoredToken(token) {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [this.config.storageKeys.token]: token,
                [this.config.storageKeys.lastAuth]: Date.now()
            }, resolve);
        });
    }

    async getStoredUser() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.config.storageKeys.user], (result) => {
                resolve(result[this.config.storageKeys.user] || null);
            });
        });
    }

    async setStoredUser(userData) {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [this.config.storageKeys.user]: userData
            }, resolve);
        });
    }

    // ============================================
    // 🚪 Login/Logout Actions
    // ============================================
    
    async login() {
        console.log('[Auth] Initiating login...');
        
        if (this.config.mode === 'redirect') {
            // Simple mode: Open login page in new tab
            chrome.tabs.create({
                url: this.config.loginUrl,
                active: true
            });
            
            // Set up listener for successful login
            this.setupLoginSuccessListener();
            
        } else if (this.config.mode === 'embedded') {
            // Future: Show embedded login form
            console.log('[Auth] Embedded login not implemented yet');
            
        } else if (this.config.mode === 'popup') {
            // Future: Open popup window
            console.log('[Auth] Popup login not implemented yet');
        }
    }

    async register() {
        console.log('[Auth] Initiating registration...');
        
        if (this.config.mode === 'redirect') {
            // Simple mode: Open register page in new tab
            chrome.tabs.create({
                url: this.config.registerUrl + '?mode=register',
                active: true
            });
            
            // Set up listener for successful registration
            this.setupLoginSuccessListener();
        }
    }

    async logout() {
        console.log('[Auth] Logging out...');
        
        // Clear stored data
        await this.clearAuthData();
        
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
        return new Promise((resolve) => {
            chrome.storage.local.remove([
                this.config.storageKeys.token,
                this.config.storageKeys.user,
                this.config.storageKeys.lastAuth
            ], resolve);
        });
    }

    // ============================================
    // 🎧 Event Listeners & Communication
    // ============================================
    
    setupLoginSuccessListener() {
        // Listen for messages from login page
        const messageListener = (message, sender, sendResponse) => {
            if (message.type === 'LOGIN_SUCCESS' && message.token && message.user) {
                console.log('[Auth] Login success received:', message.user.username);
                
                // Store auth data
                this.setStoredToken(message.token);
                this.setStoredUser(message.user);
                
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
    // 🔧 Configuration & Upgrade Path
    // ============================================
    
    // Easy method to upgrade to embedded mode later
    async upgradeToEmbedded(embeddedConfig = {}) {
        console.log('[Auth] Upgrading to embedded mode...');
        
        this.config.mode = 'embedded';
        
        // Merge custom config
        Object.assign(this.config, embeddedConfig);
        
        // Future: Initialize embedded UI
        // this.initializeEmbeddedUI();
    }

    // Get current auth info for debugging
    getAuthInfo() {
        return {
            mode: this.config.mode,
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser,
            loginUrl: this.config.loginUrl
        };
    }
}

// ============================================
// 📤 Export
// ============================================

// Create singleton instance
const authManager = new AuthManager();

export default authManager;