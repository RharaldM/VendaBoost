/**
 * VendaBoost Extension - Automation Dashboard
 * Interface de monitoramento e controle do sistema de automação
 */

class AutomationDashboard {
  constructor() {
    this.refreshInterval = null;
    this.isRefreshing = false;
    this.currentTab = 'dashboard';
    this.systemStatus = null;
    
    // Configuration
    this.config = {
      refreshInterval: 5000,        // 5 segundos
      maxLogEntries: 50,
      autoRefresh: true,
      enableNotifications: true
    };
    
    // Initialize dashboard
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Automation Dashboard');
      
      // Load initial data
      await this.loadSystemStatus();
      
      // Setup auto-refresh
      if (this.config.autoRefresh) {
        this.startAutoRefresh();
      }
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('✅ Dashboard initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize dashboard:', error);
      this.showError('Failed to initialize dashboard');
    }
  }

  async loadSystemStatus() {
    try {
      this.showRefreshIndicator(true);
      
      // Get detailed system status
      const response = await this.sendMessage({ action: 'getDetailedStatus' });
      
      if (response && response.initialized) {
        this.systemStatus = response;
        this.updateDashboard(response);
        this.hideLoading();
      } else {
        throw new Error('System not initialized');
      }
      
    } catch (error) {
      console.error('Error loading system status:', error);
      this.showError('Failed to load system status');
    } finally {
      this.showRefreshIndicator(false);
    }
  }

  updateDashboard(status) {
    // Update system status
    this.updateSystemStatus(status);
    
    // Update automation status
    this.updateAutomationStatus(status);
    
    // Update session status
    this.updateSessionStatus(status);
    
    // Update components list
    this.updateComponentsList(status);
  }

  updateSystemStatus(status) {
    // System indicator
    const systemIndicator = document.getElementById('systemIndicator');
    const systemSection = document.getElementById('systemSection');
    
    if (status.state.status === 'running') {
      systemIndicator.className = 'status-indicator';
      systemSection.className = 'status-section';
    } else if (status.state.status === 'error') {
      systemIndicator.className = 'status-indicator error';
      systemSection.className = 'status-section error';
    } else {
      systemIndicator.className = 'status-indicator warning';
      systemSection.className = 'status-section warning';
    }
    
    // Update stats
    document.getElementById('uptime').textContent = this.formatDuration(status.performance.uptime);
    document.getElementById('extractions').textContent = status.performance.extractionCount || 0;
    
    // Calculate success rate
    const total = (status.performance.extractionCount || 0) + (status.performance.errorCount || 0);
    const successRate = total > 0 
      ? Math.round(((status.performance.extractionCount || 0) / total) * 100)
      : 100;
    document.getElementById('successRate').textContent = `${successRate}%`;
    
    // Queue size
    if (status.automationDetails && status.automationDetails.components.queueManager) {
      const queueStats = status.automationDetails.components.queueManager.stats;
      document.getElementById('queueSize').textContent = queueStats.queuedTasks || 0;
    } else {
      document.getElementById('queueSize').textContent = '--';
    }
  }

  updateAutomationStatus(status) {
    const automationIndicator = document.getElementById('automationIndicator');
    const automationSection = document.getElementById('automationSection');
    const enableBtn = document.getElementById('enableBtn');
    
    if (status.state.automationEnabled && status.automation && status.automation.running) {
      automationIndicator.className = 'status-indicator';
      automationSection.className = 'status-section';
      enableBtn.textContent = 'Disable Automation';
      enableBtn.className = 'btn btn-danger';
    } else {
      automationIndicator.className = 'status-indicator inactive';
      automationSection.className = 'status-section warning';
      enableBtn.textContent = 'Enable Automation';
      enableBtn.className = 'btn btn-primary';
    }
    
    // Update component statuses
    this.updateComponentStatus('cronStatus', status, 'cronScheduler');
    this.updateComponentStatus('adaptiveStatus', status, 'adaptiveScheduler');
    this.updateComponentStatus('queueStatus', status, 'queueManager');
    this.updateComponentStatus('cacheStatus', status, 'cacheManager');
  }

  updateComponentStatus(elementId, status, componentName) {
    const element = document.getElementById(elementId);
    
    if (status.componentDetails && status.componentDetails[componentName]) {
      const componentStatus = status.componentDetails[componentName];
      
      if (componentStatus.error) {
        element.textContent = 'Error';
        element.className = 'component-status error';
      } else if (componentStatus.isRunning !== false) {
        element.textContent = 'Active';
        element.className = 'component-status active';
      } else {
        element.textContent = 'Inactive';
        element.className = 'component-status warning';
      }
    } else {
      element.textContent = 'Unknown';
      element.className = 'component-status warning';
    }
  }

  updateSessionStatus(status) {
    const sessionIndicator = document.getElementById('sessionIndicator');
    const sessionSection = document.getElementById('sessionSection');
    
    if (status.session.hasData) {
      sessionIndicator.className = 'status-indicator';
      sessionSection.className = 'status-section';
    } else {
      sessionIndicator.className = 'status-indicator warning';
      sessionSection.className = 'status-section warning';
    }
    
    // Update session data
    document.getElementById('userId').textContent = status.session.userId || 'Not available';
    document.getElementById('lastUpdate').textContent = status.session.lastUpdate 
      ? this.formatDateTime(status.session.lastUpdate)
      : 'Never';
    
    // Cache hit rate
    if (status.componentDetails && status.componentDetails.cacheManager) {
      const cacheStats = status.componentDetails.cacheManager;
      document.getElementById('cacheHitRate').textContent = cacheStats.hitRate || '--';
    } else {
      document.getElementById('cacheHitRate').textContent = '--';
    }
  }

  updateComponentsList(status) {
    const componentsList = document.getElementById('componentsList');
    if (!componentsList) return;
    
    componentsList.innerHTML = '';
    
    if (status.componentDetails) {
      for (const [componentName, componentData] of Object.entries(status.componentDetails)) {
        const componentDiv = this.createComponentCard(componentName, componentData);
        componentsList.appendChild(componentDiv);
      }
    }
  }

  createComponentCard(name, data) {
    const card = document.createElement('div');
    card.className = 'status-section';
    
    const isHealthy = !data.error && data.isRunning !== false;
    if (!isHealthy) {
      card.className += ' warning';
    }
    
    card.innerHTML = `
      <h3>
        <div class="status-indicator ${isHealthy ? '' : 'warning'}"></div>
        ${this.formatComponentName(name)}
      </h3>
      <div class="component-list">
        ${this.formatComponentStats(data)}
      </div>
    `;
    
    return card;
  }

  formatComponentName(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  formatComponentStats(data) {
    let html = '';
    
    if (data.error) {
      html += `<div class="component-item">
        <span>Error</span>
        <span class="component-status error">${data.error}</span>
      </div>`;
    }
    
    if (data.totalTasks !== undefined) {
      html += `<div class="component-item">
        <span>Total Tasks</span>
        <span>${data.totalTasks}</span>
      </div>`;
    }
    
    if (data.successRate) {
      html += `<div class="component-item">
        <span>Success Rate</span>
        <span>${data.successRate}</span>
      </div>`;
    }
    
    if (data.hitRate) {
      html += `<div class="component-item">
        <span>Cache Hit Rate</span>
        <span>${data.hitRate}</span>
      </div>`;
    }
    
    if (data.isRunning !== undefined) {
      html += `<div class="component-item">
        <span>Status</span>
        <span class="component-status ${data.isRunning ? 'active' : 'warning'}">
          ${data.isRunning ? 'Running' : 'Stopped'}
        </span>
      </div>`;
    }
    
    return html || '<div class="component-item"><span>No data available</span></div>';
  }

  async loadLogs() {
    try {
      const response = await this.sendMessage({ 
        action: 'system.logs',
        level: 'INFO',
        limit: this.config.maxLogEntries
      });
      
      if (response && response.logs) {
        this.updateLogsDisplay(response.logs);
      }
      
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  }

  updateLogsDisplay(logs) {
    const logsList = document.getElementById('logsList');
    if (!logsList) return;
    
    logsList.innerHTML = '';
    
    if (!logs || logs.length === 0) {
      logsList.innerHTML = '<div class="log-item">No logs available</div>';
      return;
    }
    
    for (const log of logs.slice(-this.config.maxLogEntries)) {
      const logElement = document.createElement('div');
      logElement.className = `log-item ${log.level.toLowerCase()}`;
      
      const time = new Date(log.timestamp).toLocaleTimeString();
      logElement.innerHTML = `
        <strong>[${time}]</strong> 
        <strong>[${log.component}]</strong> 
        ${log.message}
      `;
      
      logsList.appendChild(logElement);
    }
    
    // Scroll to bottom
    logsList.scrollTop = logsList.scrollHeight;
  }

  setupEventListeners() {
    // Setup refresh on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.refreshStatus();
      }
    });
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      if (!document.hidden && this.currentTab === 'dashboard') {
        this.refreshStatus();
      }
    }, this.config.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshStatus() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    await this.loadSystemStatus();
    this.isRefreshing = false;
  }

  showRefreshIndicator(show) {
    const indicator = document.getElementById('refreshIndicator');
    if (indicator) {
      indicator.style.display = show ? 'block' : 'none';
    }
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    const systemStatus = document.getElementById('systemStatus');
    
    if (loading) loading.style.display = 'none';
    if (systemStatus) systemStatus.style.display = 'block';
  }

  showError(message) {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `❌ ${message}`;
    }
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  formatDateTime(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString;
    }
  }
}

// Global functions for HTML
let dashboard = null;

document.addEventListener('DOMContentLoaded', () => {
  dashboard = new AutomationDashboard();
});

function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
  
  dashboard.currentTab = tabName;
  
  // Load tab-specific data
  if (tabName === 'components') {
    dashboard.loadSystemStatus();
  } else if (tabName === 'logs') {
    dashboard.loadLogs();
  }
}

async function toggleAutomation() {
  const enableBtn = document.getElementById('enableBtn');
  const isEnabled = enableBtn.textContent.includes('Disable');
  
  try {
    enableBtn.disabled = true;
    
    const action = isEnabled ? 'disableAutomation' : 'enableAutomation';
    const response = await dashboard.sendMessage({ action });
    
    if (response && response.success) {
      // Update button text
      enableBtn.textContent = isEnabled ? 'Enable Automation' : 'Disable Automation';
      enableBtn.className = isEnabled ? 'btn btn-primary' : 'btn btn-danger';
      
      // Refresh status
      setTimeout(() => {
        dashboard.refreshStatus();
      }, 1000);
      
      // Show notification
      dashboard.showNotification(response.message, 'success');
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Error toggling automation:', error);
    dashboard.showNotification(`Error: ${error.message}`, 'error');
  } finally {
    enableBtn.disabled = false;
  }
}

async function triggerExtraction() {
  try {
    // Show different extraction options
    const extractionType = await showExtractionOptions();
    
    const response = await dashboard.sendMessage({
      action: 'triggerAutonomousExtraction',
      type: extractionType,
      options: { 
        force: true,
        autonomous: true,
        triggeredBy: 'popup'
      }
    });
    
    if (response && response.success) {
      dashboard.showNotification(`${extractionType} extraction started (autonomous mode)`, 'success');
      
      // Show progress indicator
      showExtractionProgress(extractionType);
      
      // Refresh status after delay
      setTimeout(() => {
        dashboard.refreshStatus();
      }, 5000);
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Error triggering extraction:', error);
    dashboard.showNotification(`Error: ${error.message}`, 'error');
  }
}

async function showExtractionOptions() {
  return new Promise((resolve) => {
    // Create modal for extraction type selection
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 8px; min-width: 250px;">
        <h3 style="margin-bottom: 15px; text-align: center;">Select Extraction Type</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-primary" onclick="selectExtraction('session')">
            🔑 Session Data
          </button>
          <button class="btn btn-primary" onclick="selectExtraction('groups')">
            👥 Groups Data
          </button>
          <button class="btn btn-primary" onclick="selectExtraction('profile')">
            👤 Profile Data
          </button>
          <button class="btn btn-secondary" onclick="selectExtraction('all')">
            🔄 All Data Types
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Global function for selection
    window.selectExtraction = (type) => {
      document.body.removeChild(modal);
      delete window.selectExtraction;
      resolve(type);
    };
  });
}

function showExtractionProgress(type) {
  const progressDiv = document.createElement('div');
  progressDiv.style.cssText = `
    position: fixed;
    top: 50px;
    right: 10px;
    background: #2196F3;
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
  `;
  
  progressDiv.innerHTML = `
    🔄 Extracting ${type} data...
    <div style="margin-top: 5px;">
      <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px;">
        <div style="width: 0%; height: 100%; background: white; border-radius: 2px; transition: width 0.3s;" id="progressBar"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(progressDiv);
  
  // Simulate progress
  let progress = 0;
  const progressBar = progressDiv.querySelector('#progressBar');
  const interval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress > 100) progress = 100;
    
    progressBar.style.width = `${progress}%`;
    
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (progressDiv.parentNode) {
          progressDiv.parentNode.removeChild(progressDiv);
        }
      }, 1000);
    }
  }, 500);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    clearInterval(interval);
    if (progressDiv.parentNode) {
      progressDiv.parentNode.removeChild(progressDiv);
    }
  }, 30000);
}

async function refreshStatus() {
  await dashboard.refreshStatus();
  dashboard.showNotification('Status refreshed', 'info');
}

async function refreshLogs() {
  await dashboard.loadLogs();
  dashboard.showNotification('Logs refreshed', 'info');
}

async function clearLogs() {
  try {
    const response = await dashboard.sendMessage({
      action: 'system.clearLogs'
    });
    
    if (response && response.success) {
      await dashboard.loadLogs();
      dashboard.showNotification('Logs cleared', 'info');
    }
    
  } catch (error) {
    console.error('Error clearing logs:', error);
    dashboard.showNotification(`Error: ${error.message}`, 'error');
  }
}

// Add notification method to dashboard
AutomationDashboard.prototype.showNotification = function(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        notification.parentNode.removeChild(notification);
      }, 300);
    }
  }, 3000);
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);