// ============================================
// 🔐 VendaBoost Supabase Client Configuration
// ============================================

class SupabaseClient {
    constructor() {
        this.config = {
            url: 'https://xcjrvacqztpjsuoweztr.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjanJ2YWNxenRwanN1b3dlenRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NDU5NDcsImV4cCI6MjA3MDAyMTk0N30.N0ks34HGzaQQxyoMDK1a0lDUzVo577AuILNd_QM-9H4'
        };
        
        this.headers = {
            'apikey': this.config.anonKey,
            'Authorization': `Bearer ${this.config.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };
    }

    // ============================================
    // 🔐 Authentication Methods
    // ============================================

    async signUp(email, password, userData = {}) {
        const response = await fetch(`${this.config.url}/auth/v1/signup`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                email,
                password,
                data: userData
            })
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Signup failed');
        }

        return result;
    }

    async signIn(email, password) {
        const response = await fetch(`${this.config.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                email,
                password
            })
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error_description || result.message || 'Login failed');
        }

        return result;
    }

    async signOut(accessToken) {
        const response = await fetch(`${this.config.url}/auth/v1/logout`, {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'Logout failed');
        }

        return { success: true };
    }

    async getUser(accessToken) {
        const response = await fetch(`${this.config.url}/auth/v1/user`, {
            method: 'GET',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to get user');
        }

        return result;
    }

    async refreshToken(refreshToken) {
        const response = await fetch(`${this.config.url}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error_description || result.message || 'Token refresh failed');
        }

        return result;
    }

    // ============================================
    // 🗄️ Database Methods (if needed)
    // ============================================

    async query(table, options = {}) {
        let url = `${this.config.url}/rest/v1/${table}`;
        const params = new URLSearchParams();

        if (options.select) params.append('select', options.select);
        if (options.filter) {
            Object.entries(options.filter).forEach(([key, value]) => {
                params.append(key, `eq.${value}`);
            });
        }
        if (options.order) params.append('order', options.order);
        if (options.limit) params.append('limit', options.limit);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${options.accessToken || this.config.anonKey}`
            }
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Query failed');
        }

        return result;
    }

    async insert(table, data, accessToken) {
        const response = await fetch(`${this.config.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${accessToken || this.config.anonKey}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Insert failed');
        }

        return result;
    }

    async update(table, data, filter, accessToken) {
        let url = `${this.config.url}/rest/v1/${table}`;
        const params = new URLSearchParams();

        if (filter) {
            Object.entries(filter).forEach(([key, value]) => {
                params.append(key, `eq.${value}`);
            });
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${accessToken || this.config.anonKey}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Update failed');
        }

        return result;
    }
}

// Create singleton instance
const supabaseClient = new SupabaseClient();

export default supabaseClient;
