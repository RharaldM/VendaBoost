// ============================================
// 🔐 VendaBoost Supabase Authentication Modal
// ============================================
// This file creates a modal for Supabase authentication within the extension popup

class SupabaseAuthModal {
    constructor() {
        this.modal = null;
        this.isVisible = false;
        this.authCallback = null;
    }

    show(callback) {
        this.authCallback = callback;
        this.createModal();
        this.isVisible = true;
    }

    hide() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
        this.isVisible = false;
    }

    createModal() {
        // Remove existing modal if any
        this.hide();

        // Create modal element
        this.modal = document.createElement('div');
        this.modal.id = 'supabaseAuthModal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 2rem;
            width: 90%;
            max-width: 400px;
            max-height: 90%;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            position: relative;
        `;

        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <h2 style="color: #333; margin-bottom: 0.5rem; font-size: 1.5rem;">🔐 Autenticação Necessária</h2>
                <p style="color: #666; font-size: 0.9rem;">Entre com sua conta Supabase para usar o VendaBoost</p>
            </div>

            <div id="supabaseAlert" style="display: none; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem;"></div>
            
            <div id="supabaseLoading" style="display: none; text-align: center; margin: 1.5rem 0; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; display: inline-block; margin-right: 0.75rem; vertical-align: middle;"></div>
                <span>Processando...</span>
            </div>

            <form id="supabaseLoginForm">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #495057; font-weight: 600; font-size: 0.9rem;">Email:</label>
                    <input type="email" id="supabaseEmail" required placeholder="seu@email.com" style="width: 100%; padding: 0.875rem 1rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; background: #fafbfc;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #495057; font-weight: 600; font-size: 0.9rem;">Senha:</label>
                    <input type="password" id="supabasePassword" required placeholder="Digite sua senha" style="width: 100%; padding: 0.875rem 1rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; background: #fafbfc;">
                </div>
                <button type="submit" style="width: 100%; padding: 0.875rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                    Entrar
                </button>
            </form>

            <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e9ecef;">
                <a href="#" id="toggleSupabaseMode" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 0.9rem;">Não tem uma conta? Registre-se aqui</a>
            </div>

            <div style="text-align: center; margin-top: 1rem;">
                <button id="closeSupabaseModal" style="background: #6c757d; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer;">
                    Fechar
                </button>
            </div>

            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                #supabaseAuthModal input:focus {
                    outline: none;
                    border-color: #667eea;
                    background: white;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                
                #supabaseAuthModal button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
                }
            </style>
        `;

        this.modal.appendChild(modalContent);
        document.body.appendChild(this.modal);

        // Add event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const closeButton = this.modal.querySelector('#closeSupabaseModal');
        const loginForm = this.modal.querySelector('#supabaseLoginForm');
        const toggleMode = this.modal.querySelector('#toggleSupabaseMode');

        // Close modal
        closeButton.addEventListener('click', () => {
            this.hide();
        });

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Toggle between login and register
        let isLoginMode = true;
        toggleMode.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            
            const submitButton = loginForm.querySelector('button[type="submit"]');
            if (isLoginMode) {
                submitButton.textContent = 'Entrar';
                toggleMode.textContent = 'Não tem uma conta? Registre-se aqui';
            } else {
                submitButton.textContent = 'Criar Conta';
                toggleMode.textContent = 'Já tem uma conta? Entre aqui';
            }
        });

        // Handle form submission
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = this.modal.querySelector('#supabaseEmail').value;
            const password = this.modal.querySelector('#supabasePassword').value;
            
            this.setLoading(true);
            this.hideAlert();

            try {
                if (isLoginMode) {
                    await this.handleLogin(email, password);
                } else {
                    await this.handleRegister(email, password);
                }
            } catch (error) {
                this.showAlert(error.message || 'Erro na autenticação', 'error');
                this.setLoading(false);
            }
        });
    }

    async handleLogin(email, password) {
        try {
            // Import AuthClient
            const authModule = await import('./auth-client.js');
            const authClient = new authModule.default();
            
            const result = await authClient.signIn(email, password);
            
            if (result.success) {
                this.showAlert('Login realizado com sucesso!', 'success');
                setTimeout(() => {
                    this.hide();
                    if (this.authCallback) {
                        this.authCallback(true, result.user);
                    }
                }, 1000);
            } else {
                throw new Error(result.message || 'Falha no login');
            }
        } catch (error) {
            throw error;
        }
    }

    async handleRegister(email, password) {
        try {
            // Import AuthClient
            const authModule = await import('./auth-client.js');
            const authClient = new authModule.default();
            
            const result = await authClient.signUp(email, password);
            
            if (result.success) {
                this.showAlert('Conta criada com sucesso! Verifique seu email.', 'success');
                setTimeout(() => {
                    // Switch back to login mode
                    const toggleMode = this.modal.querySelector('#toggleSupabaseMode');
                    toggleMode.click();
                }, 2000);
            } else {
                throw new Error(result.message || 'Falha no registro');
            }
        } catch (error) {
            throw error;
        }
    }

    showAlert(message, type = 'error') {
        const alert = this.modal.querySelector('#supabaseAlert');
        alert.textContent = message;
        alert.className = '';
        
        const colors = {
            success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
            error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
            info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
        };
        
        const style = colors[type] || colors.error;
        alert.style.cssText = `
            display: block;
            background: ${style.bg};
            color: ${style.color};
            border: 1px solid ${style.border};
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
        `;
    }

    hideAlert() {
        const alert = this.modal.querySelector('#supabaseAlert');
        alert.style.display = 'none';
    }

    setLoading(show) {
        const loading = this.modal.querySelector('#supabaseLoading');
        const form = this.modal.querySelector('#supabaseLoginForm');
        
        loading.style.display = show ? 'block' : 'none';
        form.style.opacity = show ? '0.5' : '1';
        form.style.pointerEvents = show ? 'none' : 'auto';
    }
}

// Export for use in popup.js
export default SupabaseAuthModal;
