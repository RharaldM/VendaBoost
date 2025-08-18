class MarketplaceForm {
    constructor() {
        this.form = document.getElementById('marketplaceForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.fileSelected = document.getElementById('fileSelected');
        
        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.setupFileUpload();
        this.setupRealTimeValidation();
    }

    setupFileUpload() {
        const fileInput = document.getElementById('photo');
        const fileUpload = document.getElementById('fileUpload');
        
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
        
        // Drag and drop functionality
        if (fileUpload) {
            fileUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUpload.classList.add('dragover');
            });
            
            fileUpload.addEventListener('dragleave', () => {
                fileUpload.classList.remove('dragover');
            });
            
            fileUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUpload.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && fileInput) {
                    fileInput.files = files;
                    this.handleFileSelect({ target: fileInput });
                }
            });
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            const fileName = file.name;
            const fileSize = this.formatFileSize(file.size);
            
            // Atualizar o display do arquivo selecionado
            if (this.fileSelected) {
                this.fileSelected.innerHTML = `
                    <div class="file-info">
                        <span class="file-name">${fileName}</span>
                        <span class="file-size">${fileSize}</span>
                    </div>
                `;
                this.fileSelected.style.display = 'block';
            }
            
            this.validateField(e.target);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    setupRealTimeValidation() {
        const fields = ['title', 'price', 'description', 'photo'];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateField(field));
                field.addEventListener('input', () => {
                    if (field.classList.contains('error')) {
                        this.validateField(field);
                    }
                });
            }
        });
    }

    validateField(field) {
        const value = field.type === 'file' ? field.files.length : field.value.trim();
        let isValid = true;

        switch (field.id) {
            case 'title':
                if (!value) {
                    this.showError(field, 'Título é obrigatório');
                    isValid = false;
                } else if (value.length < 3) {
                    this.showError(field, 'Título deve ter pelo menos 3 caracteres');
                    isValid = false;
                }
                break;

            case 'price':
                if (!value || parseFloat(value) <= 0) {
                    this.showError(field, 'Preço deve ser maior que zero');
                    isValid = false;
                }
                break;

            case 'description':
                if (!value) {
                    this.showError(field, 'Descrição é obrigatória');
                    isValid = false;
                } else if (value.length < 10) {
                    this.showError(field, 'Descrição deve ter pelo menos 10 caracteres');
                    isValid = false;
                }
                break;

            case 'photo':
                if (!field.files.length) {
                    this.showError(field, 'Foto é obrigatória');
                    isValid = false;
                }
                break;
        }

        if (isValid) {
            this.clearError(field);
        }

        return isValid;
    }

    showError(field, message) {
        field.classList.add('error');
        field.classList.remove('success');
        
        const errorElement = document.getElementById(field.id + 'Error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearError(field) {
        field.classList.remove('error');
        field.classList.add('success');
        
        const errorElement = document.getElementById(field.id + 'Error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    validateForm() {
        const fields = ['title', 'price', 'description', 'photo'];
        let isValid = true;

        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    showAlert(type, message) {
        const alertElement = document.getElementById(type + 'Alert');
        if (alertElement) {
            if (message) {
                alertElement.innerHTML = message;
            }
            alertElement.style.display = 'block';
            
            setTimeout(() => {
                alertElement.style.display = 'none';
            }, 5000);
        }
    }

    hideAlerts() {
        document.getElementById('successAlert').style.display = 'none';
        document.getElementById('errorAlert').style.display = 'none';
    }

    setLoading(loading) {
        if (loading) {
            this.submitBtn.classList.add('btn-loading');
            this.submitBtn.disabled = true;
            this.progressBar.style.display = 'block';
            this.animateProgress();
        } else {
            this.submitBtn.classList.remove('btn-loading');
            this.submitBtn.disabled = false;
            this.progressBar.style.display = 'none';
            this.progressFill.style.width = '0%';
        }
    }

    animateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            
            this.progressFill.style.width = progress + '%';
            
            if (!this.submitBtn.classList.contains('btn-loading')) {
                clearInterval(interval);
                this.progressFill.style.width = '100%';
                setTimeout(() => {
                    this.progressBar.style.display = 'none';
                    this.progressFill.style.width = '0%';
                }, 500);
            }
        }, 200);
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        this.hideAlerts();
        
        if (!this.validateForm()) {
            this.showAlert('error', '❌ Por favor, corrija os erros no formulário');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/schedule-item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: document.getElementById('title').value,
                    price: parseFloat(document.getElementById('price').value),
                    description: document.getElementById('description').value,
                    location: document.getElementById('location').value || 'Sinop',
                    photoPath: './test-image.png' // Usando imagem de teste por enquanto
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert('success', '🚀 Item enviado com sucesso! A automação foi iniciada.');
                this.form.reset();
                this.fileSelected.style.display = 'none';
                
                // Limpar classes de validação
                const fields = this.form.querySelectorAll('.form-control');
                fields.forEach(field => {
                    field.classList.remove('success', 'error');
                });
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showAlert('error', `❌ Erro: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }
}

// Sistema de Logs em Tempo Real
class LogsManager {
    constructor() {
        this.socket = null;
        this.logsContent = document.getElementById('logsContent');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.clearLogsBtn = document.getElementById('clearLogsBtn');
        this.toggleLogsBtn = document.getElementById('toggleLogsBtn');
        this.logsContainer = document.getElementById('logsContainer');
        this.autoScroll = true;
        this.isMinimized = false;
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
    }

    connectWebSocket() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.updateConnectionStatus(true);
                this.addLogEntry('info', 'Conectado ao servidor de logs', null, new Date().toISOString());
            });
            
            this.socket.on('disconnect', () => {
                this.updateConnectionStatus(false);
                this.addLogEntry('error', 'Desconectado do servidor de logs', null, new Date().toISOString());
            });
            
            this.socket.on('log', (logEntry) => {
                this.addLogEntry(logEntry.level, logEntry.message, logEntry.data, logEntry.timestamp);
            });
            
            this.socket.on('logs-history', (logs) => {
                this.clearLogs();
                logs.forEach(log => {
                    this.addLogEntry(log.level, log.message, log.data, log.timestamp);
                });
            });
            
            this.socket.on('logs-cleared', () => {
                this.clearLogs();
            });
            
        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    setupEventListeners() {
        if (this.clearLogsBtn) {
            this.clearLogsBtn.addEventListener('click', () => {
                this.socket?.emit('clear-logs');
            });
        }
        
        if (this.toggleLogsBtn) {
            this.toggleLogsBtn.addEventListener('click', () => {
                this.toggleLogs();
            });
        }
        
        // Auto-scroll control
        if (this.logsContent) {
            this.logsContent.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = this.logsContent;
                this.autoScroll = scrollTop + clientHeight >= scrollHeight - 10;
            });
        }
    }

    updateConnectionStatus(isConnected) {
        if (this.connectionStatus) {
            this.connectionStatus.textContent = isConnected ? 'Conectado' : 'Desconectado';
            this.connectionStatus.className = `status-indicator ${isConnected ? 'online' : 'offline'}`;
        }
    }

    addLogEntry(level, message, data, timestamp) {
        if (!this.logsContent) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        
        const timeFormatted = new Date(timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timeFormatted}]</span>
            <span class="log-message">${this.escapeHtml(message)}</span>
            ${data ? `<div class="log-data">${this.escapeHtml(JSON.stringify(data, null, 2))}</div>` : ''}
        `;
        
        this.logsContent.appendChild(logEntry);
        
        // Manter apenas os últimos 500 logs para performance
        const logs = this.logsContent.children;
        if (logs.length > 500) {
            this.logsContent.removeChild(logs[0]);
        }
        
        // Auto-scroll se habilitado
        if (this.autoScroll) {
            this.logsContent.scrollTop = this.logsContent.scrollHeight;
        }
    }

    clearLogs() {
        if (this.logsContent) {
            this.logsContent.innerHTML = '';
        }
    }

    toggleLogs() {
        this.isMinimized = !this.isMinimized;
        
        if (this.logsContainer) {
            this.logsContainer.classList.toggle('minimized', this.isMinimized);
        }
        
        if (this.toggleLogsBtn) {
            this.toggleLogsBtn.textContent = this.isMinimized ? 'Expandir' : 'Minimizar';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the form and logs when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MarketplaceForm();
    new LogsManager();
});