// ============================================
// 🔐 VendaBoost Authentication Client
// ============================================
// Integrates with the Node.js login-system server

class AuthClient {
    constructor() {
        this.config = {
            // Server URLs - update these to match your login-system server
            serverUrl: 'https://vendaboost-login.onrender.com', // Servidor no Render.com
            endpoints: {
                login: '/api/login',
                validate: '/api/validate',
                logout: '/api/logout'
            },
            
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
        console.log('[AuthClient] Checking authentication status...');
        
        try {
            const token = await this.getStoredToken();
            
            if (!token) {
                console.log('[AuthClient] No token found');
                this.isAuthenticated = false;
                return false;
            }

            // Check if we have a recent successful auth check
            const lastAuthCheck = await this.getLastAuthCheck();
            const now = Date.now();
            const timeSinceLastCheck = now - (lastAuthCheck || 0);
            
            // If last check was less than 30 minutes ago, consider user authenticated
            // This prevents logout on temporary connection issues
            if (timeSinceLastCheck < 30 * 60 * 1000) { // 30 minutes
                const user = await this.getStoredUser();
                if (user) {
                    this.isAuthenticated = true;
                    this.currentUser = user;
                    console.log('[AuthClient] Using cached authentication:', user?.username);
                    
                    // Try to validate with server in background (don't wait for result)
                    this.validateTokenWithServer(token).then(isValid => {
                        if (isValid) {
                            this.updateLastAuthCheck();
                        }
                    }).catch(() => {
                        // Ignore server validation errors for cached auth
                    });
                    
                    return true;
                }
            }

            // If no recent cache, validate with server
            const isValid = await this.validateTokenWithServer(token);
            
            if (isValid) {
                const user = await this.getStoredUser();
                this.isAuthenticated = true;
                this.currentUser = user;
                await this.updateLastAuthCheck();
                console.log('[AuthClient] User authenticated via server:', user?.username);
                return true;
            } else {
                // Only clear data if we're sure the token is invalid (not just server unreachable)
                console.log('[AuthClient] Token validation failed');
                await this.clearAuthData();
                return false;
            }
            
        } catch (error) {
            console.error('[AuthClient] Error checking auth status:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    // ============================================
    // 🔑 Server Communication
    // ============================================
    
    async validateTokenWithServer(token) {
        try {
            const response = await fetch(`${this.config.serverUrl}${this.config.endpoints.validate}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // Add timeout to avoid hanging
                signal: AbortSignal.timeout(10000) // 10 seconds timeout
            });

            if (response.ok) {
                const data = await response.json();
                return data.valid === true;
            } else if (response.status === 401 || response.status === 403) {
                // Token is definitely invalid
                console.log('[AuthClient] Token is invalid (401/403)');
                return false;
            } else {
                // Server error - don't assume token is invalid
                console.warn('[AuthClient] Server error during validation:', response.status);
                throw new Error(`Server error: ${response.status}`);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('[AuthClient] Token validation timeout');
            } else {
                console.warn('[AuthClient] Network error during token validation:', error.message);
            }
            // Don't return false for network errors - let calling function handle it
            throw error;
        }
    }

    // ============================================
    // 🚪 Login Method
    // ============================================
    
    async login(username, password) {
        console.log('[AuthClient] Attempting login for:', username);
        
        try {
            const response = await fetch(`${this.config.serverUrl}${this.config.endpoints.login}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store token and user data
                await this.setStoredToken(data.token);
                await this.setStoredUser(data.user);
                await this.updateLastAuthCheck();
                
                this.isAuthenticated = true;
                this.currentUser = data.user;
                
                console.log('[AuthClient] Login successful');
                this.startAuthCheckTimer();
                
                return {
                    success: true,
                    user: data.user,
                    message: 'Login realizado com sucesso!'
                };
            } else {
                console.log('[AuthClient] Login failed:', data.message);
                return {
                    success: false,
                    message: data.message || 'Erro ao fazer login'
                };
            }
            
        } catch (error) {
            console.error('[AuthClient] Login error:', error);
            return {
                success: false,
                message: 'Erro de conexão com o servidor'
            };
        }
    }

    // ============================================
    //  Logout Method
    // ============================================
    
    async logout() {
        console.log('[AuthClient] Logging out...');
        
        try {
            const token = await this.getStoredToken();
            
            if (token) {
                // Notify server about logout
                fetch(`${this.config.serverUrl}${this.config.endpoints.logout}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }).catch(err => console.log('[AuthClient] Server logout notification failed:', err));
            }
            
            // Clear local data
            await this.clearAuthData();
            this.stopAuthCheckTimer();
            
            console.log('[AuthClient] Logout successful');
            return { success: true };
            
        } catch (error) {
            console.error('[AuthClient] Logout error:', error);
            return { success: false, message: 'Erro ao fazer logout' };
        }
    }

    // ============================================
    // 💾 Storage Management
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

    async clearAuthData() {
        return new Promise((resolve) => {
            chrome.storage.local.remove([
                this.config.storageKeys.token,
                this.config.storageKeys.user,
                this.config.storageKeys.lastAuth
            ], () => {
                this.isAuthenticated = false;
                this.currentUser = null;
                resolve();
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

    // ============================================
    // ⏰ Auto Auth Check Timer
    // ============================================
    
    startAuthCheckTimer() {
        this.stopAuthCheckTimer();
        this.authCheckTimer = setInterval(() => {
            this.checkAuthStatus();
        }, this.config.tokenCheckInterval);
    }

    stopAuthCheckTimer() {
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

    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Test server connection
    async testConnection() {
        try {
            const response = await fetch(`${this.config.serverUrl}/api/health`, {
                method: 'GET'
            });
            
            return response.ok;
        } catch (error) {
            console.error('[AuthClient] Connection test failed:', error);
            return false;
        }
    }
}

// Export the AuthClient class
export default AuthClient;
