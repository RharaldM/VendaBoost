/**
 * VendaBoost Extension - Configuração Centralizada
 * Gerencia todas as configurações da extensão
 */

class ExtensionConfig {
  constructor() {
    this.defaultConfig = {
      // Configurações de Extração
      extraction: {
        autoExtractEnabled: true,
        extractionInterval: 15, // minutos
        maxRetries: 3,
        timeoutMs: 30000,
        batchSize: 50,
        
        // Tipos de dados para extrair
        dataTypes: {
          sessions: true,
          groups: true,
          friends: false,
          posts: false,
          profile: true
        }
      },

      // Sistema de Agendamento
      scheduling: {
        enabled: true,
        strategies: {
          fixed: {
            enabled: true,
            interval: 15 // minutos
          },
          adaptive: {
            enabled: true,
            minInterval: 10, // minutos
            maxInterval: 60, // minutos
            activityBasedScaling: true
          },
          eventBased: {
            enabled: true,
            triggers: ['login', 'url_change', 'cookie_change']
          }
        }
      },

      // Anti-Detecção
      antiDetection: {
        enabled: true,
        rateLimiting: {
          enabled: true,
          maxRequestsPerMinute: 10,
          adaptiveDelay: true,
          baseDelayMs: 2000,
          randomFactorPercent: 50
        },
        
        fingerprinting: {
          enabled: true,
          rotateUserAgent: false, // Perigoso para extensões
          randomizeTimings: true,
          simulateHumanBehavior: true
        },
        
        patterns: {
          randomizeRequestOrder: true,
          varyRequestIntervals: true,
          mimicUserBehavior: true
        }
      },

      // Storage e Cache
      storage: {
        maxCacheSize: 100, // MB
        maxHistoryDays: 30,
        compressionEnabled: true,
        
        cache: {
          sessionTTL: 24 * 60 * 60 * 1000, // 24 horas
          groupsTTL: 6 * 60 * 60 * 1000,   // 6 horas
          profileTTL: 12 * 60 * 60 * 1000, // 12 horas
          
          cleanupInterval: 60 * 60 * 1000   // 1 hora
        }
      },

      // API e Sincronização
      api: {
        enabled: true,
        endpoints: {
          local: {
            enabled: true,
            urls: [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://127.0.0.1:3000',
              'http://127.0.0.1:3001'
            ],
            timeout: 10000,
            retries: 3
          },
          
          remote: {
            enabled: false,
            baseUrl: '',
            apiKey: '',
            timeout: 15000,
            retries: 2
          }
        },
        
        sync: {
          enabled: true,
          batchMode: true,
          deltaSync: true, // Só envia mudanças
          compressionEnabled: true,
          maxBatchSize: 100
        }
      },

      // Logging
      logging: {
        level: 'INFO', // DEBUG, INFO, WARN, ERROR, CRITICAL
        console: true,
        persistCritical: true,
        maxHistorySize: 1000,
        
        components: {
          core: true,
          extraction: true,
          scheduler: true,
          antiDetection: true,
          api: true,
          storage: true
        }
      },

      // Performance
      performance: {
        enableMetrics: true,
        memoryLimit: 50, // MB
        
        monitoring: {
          trackExecutionTime: true,
          trackMemoryUsage: true,
          trackNetworkUsage: true,
          alertThresholds: {
            executionTimeMs: 5000,
            memoryUsageMB: 40,
            errorRate: 0.1 // 10%
          }
        }
      },

      // Debugging
      debug: {
        enabled: false,
        verboseLogging: false,
        trackAllRequests: false,
        dumpDataToConsole: false,
        simulateErrors: false
      },

      // Feature Flags
      features: {
        groupsExtraction: true,
        friendsExtraction: false,
        postsExtraction: false,
        marketplaceIntegration: true,
        realTimeSync: false,
        advancedAntiDetection: true,
        
        experimental: {
          graphqlExtraction: false,
          aiBasedDetection: false,
          proxyRotation: false
        }
      }
    };

    this.loadedConfig = null;
    this.configVersion = '2.0.0';
  }

  async initialize() {
    try {
      await this.loadConfig();
      await this.validateConfig();
      await this.applyConfig();
      
      if (globalThis.logger) {
        globalThis.logger.info('CONFIG', 'Configuration initialized successfully', {
          version: this.configVersion,
          source: this.loadedConfig ? 'stored' : 'default'
        });
      }
    } catch (error) {
      if (globalThis.logger) {
        globalThis.logger.error('CONFIG', 'Failed to initialize configuration', null, error);
      }
      // Usa configuração padrão em caso de erro
      this.loadedConfig = this.defaultConfig;
    }
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['vendaboost_config']);
      
      if (result.vendaboost_config) {
        this.loadedConfig = this.mergeConfig(this.defaultConfig, result.vendaboost_config);
      } else {
        this.loadedConfig = { ...this.defaultConfig };
        await this.saveConfig();
      }
    } catch (error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  async saveConfig() {
    try {
      await chrome.storage.local.set({
        vendaboost_config: {
          ...this.loadedConfig,
          version: this.configVersion,
          lastUpdated: new Date().toISOString()
        }
      });
      
      if (globalThis.logger) {
        globalThis.logger.info('CONFIG', 'Configuration saved successfully');
      }
    } catch (error) {
      if (globalThis.logger) {
        globalThis.logger.error('CONFIG', 'Failed to save configuration', null, error);
      }
      throw error;
    }
  }

  mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(userConfig)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = this.mergeConfig(defaultConfig[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  validateConfig() {
    const config = this.loadedConfig;
    const errors = [];

    // Validações básicas
    if (config.extraction.extractionInterval < 1) {
      errors.push('extraction.extractionInterval must be at least 1 minute');
    }

    if (config.antiDetection.rateLimiting.maxRequestsPerMinute > 60) {
      errors.push('antiDetection.rateLimiting.maxRequestsPerMinute should not exceed 60');
    }

    if (config.storage.maxCacheSize > 500) {
      errors.push('storage.maxCacheSize should not exceed 500MB');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  applyConfig() {
    const config = this.loadedConfig;

    // Aplica configurações de logging
    if (globalThis.logger) {
      globalThis.logger.setLogLevel(config.logging.level);
      
      if (config.debug.enabled) {
        globalThis.logger.setLogLevel('DEBUG');
      }
    }

    // Outras aplicações de config podem ser adicionadas aqui
  }

  // Getters para configurações específicas
  get(path) {
    const keys = path.split('.');
    let value = this.loadedConfig;
    
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Setters para configurações específicas
  async set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.loadedConfig;
    
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
    await this.saveConfig();
    
    if (globalThis.logger) {
      globalThis.logger.info('CONFIG', `Configuration updated: ${path}`, { newValue: value });
    }
  }

  // Métodos de conveniência
  isEnabled(feature) {
    return this.get(`features.${feature}`) === true;
  }

  isExperimentalEnabled(feature) {
    return this.get(`features.experimental.${feature}`) === true;
  }

  getExtractionConfig() {
    return this.get('extraction');
  }

  getSchedulingConfig() {
    return this.get('scheduling');
  }

  getAntiDetectionConfig() {
    return this.get('antiDetection');
  }

  getApiConfig() {
    return this.get('api');
  }

  getStorageConfig() {
    return this.get('storage');
  }

  // Reset para configurações padrão
  async resetToDefaults() {
    this.loadedConfig = { ...this.defaultConfig };
    await this.saveConfig();
    
    if (globalThis.logger) {
      globalThis.logger.info('CONFIG', 'Configuration reset to defaults');
    }
  }

  // Export/Import de configurações
  exportConfig() {
    return {
      version: this.configVersion,
      config: this.loadedConfig,
      exportedAt: new Date().toISOString()
    };
  }

  async importConfig(configData) {
    try {
      if (configData.version !== this.configVersion) {
        if (globalThis.logger) {
          globalThis.logger.warn('CONFIG', 'Version mismatch during import', {
            expected: this.configVersion,
            received: configData.version
          });
        }
      }

      this.loadedConfig = this.mergeConfig(this.defaultConfig, configData.config);
      await this.validateConfig();
      await this.saveConfig();
      
      if (globalThis.logger) {
        globalThis.logger.info('CONFIG', 'Configuration imported successfully');
      }
    } catch (error) {
      if (globalThis.logger) {
        globalThis.logger.error('CONFIG', 'Failed to import configuration', null, error);
      }
      throw error;
    }
  }

  // Status da configuração
  getStatus() {
    return {
      version: this.configVersion,
      initialized: this.loadedConfig !== null,
      lastUpdated: this.get('lastUpdated'),
      featuresEnabled: this.countEnabledFeatures(),
      configSize: JSON.stringify(this.loadedConfig || {}).length
    };
  }

  countEnabledFeatures() {
    const features = this.get('features') || {};
    let count = 0;
    
    const countInObject = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'boolean' && value === true) {
          count++;
        } else if (typeof value === 'object' && value !== null) {
          countInObject(value);
        }
      }
    };
    
    countInObject(features);
    return count;
  }
}

// Singleton instance
const config = new ExtensionConfig();

// Export para uso global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = config;
} else if (typeof window !== 'undefined') {
  window.VendaBoostConfig = config;
}

// Para uso em background scripts
if (typeof chrome !== 'undefined' && chrome.runtime) {
  globalThis.config = config;
}