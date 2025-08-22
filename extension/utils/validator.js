/**
 * VendaBoost Extension - Data Validator
 * Sistema avançado de validação para dados extraídos
 */

class DataValidator {
  constructor() {
    this.validationRules = new Map();
    this.customValidators = new Map();
    this.validationHistory = [];
    
    // Configuration
    this.config = {
      strictMode: false,                    // Strict validation mode
      logValidationDetails: true,           // Log detailed validation info
      maxHistorySize: 100,                  // Max validation history entries
      enableSchemaValidation: true,         // Enable JSON schema validation
      enableBusinessRules: true,            // Enable business logic validation
      enableSecurityValidation: true,       // Enable security checks
      
      // Validation levels
      levels: {
        CRITICAL: 'critical',               // Must pass or data is rejected
        WARNING: 'warning',                 // Log warning but allow data
        INFO: 'info'                        // Informational only
      },
      
      // Auto-correction settings
      enableAutoCorrection: true,           // Try to fix minor issues
      maxCorrectionAttempts: 3,             // Max auto-correction attempts
      preserveOriginal: true                // Keep original data for reference
    };
    
    // Initialize default validation rules
    this.initializeDefaultRules();
    
    logger.info('VALIDATOR', 'DataValidator initialized', {
      strictMode: this.config.strictMode,
      rulesCount: this.validationRules.size
    });
  }

  /**
   * Initialize default validation rules for different data types
   */
  initializeDefaultRules() {
    // Session data validation rules
    this.addValidationRule('session', {
      schema: {
        required: ['userId', 'timestamp', 'cookies'],
        properties: {
          userId: { type: 'string', minLength: 1, maxLength: 50 },
          timestamp: { type: 'string', format: 'date-time' },
          cookies: { type: 'array', minItems: 1 },
          userAgent: { type: 'string', minLength: 10 },
          url: { type: 'string', format: 'uri' }
        }
      },
      businessRules: [
        { name: 'validUserId', rule: this.validateUserId },
        { name: 'recentTimestamp', rule: this.validateRecentTimestamp },
        { name: 'essentialCookies', rule: this.validateEssentialCookies },
        { name: 'facebookDomain', rule: this.validateFacebookDomain }
      ],
      securityChecks: [
        { name: 'noMaliciousData', rule: this.checkMaliciousData },
        { name: 'dataSizeLimit', rule: this.checkDataSizeLimit }
      ]
    });

    // Profile data validation rules
    this.addValidationRule('profile', {
      schema: {
        required: ['userId', 'timestamp'],
        properties: {
          userId: { type: 'string', minLength: 1 },
          timestamp: { type: 'string', format: 'date-time' },
          basicInfo: {
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 100 },
              profilePicture: { type: 'string', format: 'uri' }
            }
          }
        }
      },
      businessRules: [
        { name: 'validProfileName', rule: this.validateProfileName },
        { name: 'validProfilePicture', rule: this.validateProfilePicture },
        { name: 'dataCompleteness', rule: this.validateDataCompleteness }
      ],
      securityChecks: [
        { name: 'privacyCompliance', rule: this.checkPrivacyCompliance },
        { name: 'personalDataProtection', rule: this.checkPersonalDataProtection }
      ]
    });

    // Groups data validation rules
    this.addValidationRule('groups', {
      schema: {
        required: ['userId', 'timestamp', 'groups'],
        properties: {
          userId: { type: 'string', minLength: 1 },
          timestamp: { type: 'string', format: 'date-time' },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string', minLength: 1 },
                name: { type: 'string', minLength: 1, maxLength: 200 },
                memberCount: { type: 'number', minimum: 0 },
                privacy: { type: 'string', enum: ['public', 'private', 'closed', 'unknown'] }
              }
            }
          }
        }
      },
      businessRules: [
        { name: 'validGroupIds', rule: this.validateGroupIds },
        { name: 'reasonableGroupCount', rule: this.validateGroupCount },
        { name: 'validMemberCounts', rule: this.validateMemberCounts }
      ],
      securityChecks: [
        { name: 'publicGroupsOnly', rule: this.checkPublicGroupsOnly },
        { name: 'noSensitiveGroups', rule: this.checkSensitiveGroups }
      ]
    });
  }

  /**
   * Main validation method
   */
  async validate(data, type, options = {}) {
    const startTime = performance.now();
    logger.startTimer(`validation_${type}`);
    
    try {
      const validationId = this.generateValidationId();
      
      logger.debug('VALIDATOR', `Starting validation for ${type}`, {
        validationId,
        dataSize: this.calculateDataSize(data),
        strictMode: this.config.strictMode
      });

      // Get validation rules for this type
      const rules = this.validationRules.get(type);
      if (!rules) {
        throw new Error(`No validation rules found for type: ${type}`);
      }

      // Initialize validation result
      const result = {
        validationId,
        type,
        timestamp: new Date().toISOString(),
        isValid: true,
        score: 1.0,
        errors: [],
        warnings: [],
        info: [],
        correctedData: null,
        originalData: this.config.preserveOriginal ? data : null,
        metadata: {
          validationTime: 0,
          rulesChecked: 0,
          autoCorrections: 0,
          securityIssues: 0
        }
      };

      // Validate input data structure
      if (!this.validateInputStructure(data)) {
        result.errors.push({
          level: this.config.levels.CRITICAL,
          code: 'INVALID_INPUT',
          message: 'Input data structure is invalid',
          field: 'root'
        });
        result.isValid = false;
        return result;
      }

      // Schema validation
      if (this.config.enableSchemaValidation && rules.schema) {
        await this.validateSchema(data, rules.schema, result);
      }

      // Business rules validation
      if (this.config.enableBusinessRules && rules.businessRules) {
        await this.validateBusinessRules(data, rules.businessRules, result);
      }

      // Security validation
      if (this.config.enableSecurityValidation && rules.securityChecks) {
        await this.validateSecurity(data, rules.securityChecks, result);
      }

      // Custom validators
      if (options.customValidators) {
        await this.runCustomValidators(data, options.customValidators, result);
      }

      // Auto-correction
      if (this.config.enableAutoCorrection && result.errors.length > 0) {
        result.correctedData = await this.attemptAutoCorrection(data, result);
      }

      // Calculate final score and validity
      this.calculateFinalScore(result);
      
      // Log validation result
      const duration = logger.endTimer(`validation_${type}`, 'VALIDATOR');
      result.metadata.validationTime = duration;
      
      if (this.config.logValidationDetails) {
        this.logValidationResult(result);
      }
      
      // Store in history
      this.addToHistory(result);
      
      logger.debug('VALIDATOR', `Validation completed for ${type}`, {
        validationId,
        isValid: result.isValid,
        score: result.score,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length,
        duration: `${duration.toFixed(2)}ms`
      });

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('VALIDATOR', 'Validation failed', {
        type,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      }, error);

      return {
        validationId: this.generateValidationId(),
        type,
        timestamp: new Date().toISOString(),
        isValid: false,
        score: 0,
        errors: [{
          level: this.config.levels.CRITICAL,
          code: 'VALIDATION_ERROR',
          message: `Validation process failed: ${error.message}`,
          field: 'validator'
        }],
        warnings: [],
        info: [],
        correctedData: null,
        originalData: null,
        metadata: {
          validationTime: duration,
          rulesChecked: 0,
          autoCorrections: 0,
          securityIssues: 0
        }
      };
    }
  }

  /**
   * Schema validation
   */
  async validateSchema(data, schema, result) {
    try {
      // Check required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in data) || data[field] === null || data[field] === undefined) {
            result.errors.push({
              level: this.config.levels.CRITICAL,
              code: 'MISSING_REQUIRED_FIELD',
              message: `Required field '${field}' is missing`,
              field
            });
          }
        }
      }

      // Check field properties
      if (schema.properties) {
        for (const [field, rules] of Object.entries(schema.properties)) {
          if (field in data) {
            await this.validateField(data[field], field, rules, result);
          }
        }
      }

      result.metadata.rulesChecked += Object.keys(schema.properties || {}).length;

    } catch (error) {
      result.errors.push({
        level: this.config.levels.CRITICAL,
        code: 'SCHEMA_VALIDATION_ERROR',
        message: `Schema validation failed: ${error.message}`,
        field: 'schema'
      });
    }
  }

  /**
   * Field validation
   */
  async validateField(value, fieldName, rules, result) {
    // Type validation
    if (rules.type) {
      if (!this.validateFieldType(value, rules.type)) {
        result.errors.push({
          level: this.config.levels.CRITICAL,
          code: 'INVALID_TYPE',
          message: `Field '${fieldName}' should be of type '${rules.type}'`,
          field: fieldName,
          expected: rules.type,
          actual: typeof value
        });
        return;
      }
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'MIN_LENGTH_VIOLATION',
          message: `Field '${fieldName}' is too short (min: ${rules.minLength})`,
          field: fieldName
        });
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'MAX_LENGTH_VIOLATION',
          message: `Field '${fieldName}' is too long (max: ${rules.maxLength})`,
          field: fieldName
        });
      }

      if (rules.format) {
        if (!this.validateFormat(value, rules.format)) {
          result.errors.push({
            level: this.config.levels.WARNING,
            code: 'INVALID_FORMAT',
            message: `Field '${fieldName}' has invalid format '${rules.format}'`,
            field: fieldName
          });
        }
      }

      if (rules.enum && !rules.enum.includes(value)) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'INVALID_ENUM_VALUE',
          message: `Field '${fieldName}' has invalid value. Allowed: ${rules.enum.join(', ')}`,
          field: fieldName
        });
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.minimum !== undefined && value < rules.minimum) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'BELOW_MINIMUM',
          message: `Field '${fieldName}' is below minimum (min: ${rules.minimum})`,
          field: fieldName
        });
      }

      if (rules.maximum !== undefined && value > rules.maximum) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'ABOVE_MAXIMUM',
          message: `Field '${fieldName}' is above maximum (max: ${rules.maximum})`,
          field: fieldName
        });
      }
    }

    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.minItems && value.length < rules.minItems) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'TOO_FEW_ITEMS',
          message: `Field '${fieldName}' has too few items (min: ${rules.minItems})`,
          field: fieldName
        });
      }

      if (rules.maxItems && value.length > rules.maxItems) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'TOO_MANY_ITEMS',
          message: `Field '${fieldName}' has too many items (max: ${rules.maxItems})`,
          field: fieldName
        });
      }

      // Validate array items
      if (rules.items) {
        for (let i = 0; i < value.length; i++) {
          await this.validateField(value[i], `${fieldName}[${i}]`, rules.items, result);
        }
      }
    }
  }

  /**
   * Business rules validation
   */
  async validateBusinessRules(data, businessRules, result) {
    for (const rule of businessRules) {
      try {
        const ruleResult = await rule.rule.call(this, data);
        
        if (!ruleResult.isValid) {
          result[ruleResult.level === this.config.levels.CRITICAL ? 'errors' : 'warnings'].push({
            level: ruleResult.level || this.config.levels.WARNING,
            code: `BUSINESS_RULE_${rule.name.toUpperCase()}`,
            message: ruleResult.message,
            field: ruleResult.field || 'business_rule',
            details: ruleResult.details
          });
        }

        result.metadata.rulesChecked++;

      } catch (error) {
        result.errors.push({
          level: this.config.levels.WARNING,
          code: 'BUSINESS_RULE_ERROR',
          message: `Business rule '${rule.name}' failed: ${error.message}`,
          field: 'business_rule'
        });
      }
    }
  }

  /**
   * Security validation
   */
  async validateSecurity(data, securityChecks, result) {
    for (const check of securityChecks) {
      try {
        const checkResult = await check.rule.call(this, data);
        
        if (!checkResult.isValid) {
          result.errors.push({
            level: this.config.levels.CRITICAL,
            code: `SECURITY_${check.name.toUpperCase()}`,
            message: checkResult.message,
            field: checkResult.field || 'security',
            details: checkResult.details
          });
          
          result.metadata.securityIssues++;
        }

        result.metadata.rulesChecked++;

      } catch (error) {
        result.errors.push({
          level: this.config.levels.CRITICAL,
          code: 'SECURITY_CHECK_ERROR',
          message: `Security check '${check.name}' failed: ${error.message}`,
          field: 'security'
        });
      }
    }
  }

  // Business rule implementations
  async validateUserId(data) {
    const userId = data.userId;
    
    if (!userId || typeof userId !== 'string') {
      return {
        isValid: false,
        level: this.config.levels.CRITICAL,
        message: 'User ID is required and must be a string',
        field: 'userId'
      };
    }
    
    if (!/^\d+$/.test(userId)) {
      return {
        isValid: false,
        level: this.config.levels.WARNING,
        message: 'User ID should contain only digits',
        field: 'userId'
      };
    }
    
    return { isValid: true };
  }

  async validateRecentTimestamp(data) {
    const timestamp = data.timestamp;
    
    if (!timestamp) {
      return {
        isValid: false,
        level: this.config.levels.CRITICAL,
        message: 'Timestamp is required',
        field: 'timestamp'
      };
    }
    
    const age = Date.now() - new Date(timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) {
      return {
        isValid: false,
        level: this.config.levels.WARNING,
        message: 'Data is older than 24 hours',
        field: 'timestamp',
        details: { age: `${Math.round(age / (60 * 60 * 1000))} hours` }
      };
    }
    
    return { isValid: true };
  }

  async validateEssentialCookies(data) {
    const cookies = data.cookies || [];
    const essentialCookies = ['c_user', 'xs'];
    const missingCookies = [];
    
    for (const essential of essentialCookies) {
      if (!cookies.find(c => c.name === essential)) {
        missingCookies.push(essential);
      }
    }
    
    if (missingCookies.length > 0) {
      return {
        isValid: false,
        level: this.config.levels.CRITICAL,
        message: `Missing essential cookies: ${missingCookies.join(', ')}`,
        field: 'cookies',
        details: { missingCookies }
      };
    }
    
    return { isValid: true };
  }

  async validateFacebookDomain(data) {
    const url = data.url;
    
    if (!url) {
      return {
        isValid: false,
        level: this.config.levels.WARNING,
        message: 'URL is missing',
        field: 'url'
      };
    }
    
    if (!url.includes('facebook.com')) {
      return {
        isValid: false,
        level: this.config.levels.CRITICAL,
        message: 'Data should be from Facebook domain',
        field: 'url'
      };
    }
    
    return { isValid: true };
  }

  // Security check implementations
  async checkMaliciousData(data) {
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /document\.cookie/gi
    ];
    
    const dataString = JSON.stringify(data);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(dataString)) {
        return {
          isValid: false,
          message: 'Potentially malicious data detected',
          field: 'data',
          details: { pattern: pattern.toString() }
        };
      }
    }
    
    return { isValid: true };
  }

  async checkDataSizeLimit(data) {
    const dataSize = this.calculateDataSize(data);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (dataSize > maxSize) {
      return {
        isValid: false,
        message: `Data size exceeds limit (${this.formatBytes(dataSize)} > ${this.formatBytes(maxSize)})`,
        field: 'data',
        details: { size: dataSize, limit: maxSize }
      };
    }
    
    return { isValid: true };
  }

  // Utility methods
  validateInputStructure(data) {
    return data !== null && data !== undefined && typeof data === 'object';
  }

  validateFieldType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  validateFormat(value, format) {
    switch (format) {
      case 'date-time':
        return !isNaN(Date.parse(value));
      case 'uri':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      default:
        return true;
    }
  }

  calculateDataSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  calculateFinalScore(result) {
    let score = 1.0;
    
    // Deduct for errors
    result.errors.forEach(error => {
      switch (error.level) {
        case this.config.levels.CRITICAL:
          score -= 0.3;
          break;
        case this.config.levels.WARNING:
          score -= 0.1;
          break;
      }
    });
    
    // Bonus for completeness
    if (result.warnings.length === 0 && result.errors.length === 0) {
      score += 0.1;
    }
    
    result.score = Math.max(0, Math.min(1, score));
    result.isValid = this.config.strictMode 
      ? result.errors.length === 0
      : !result.errors.some(e => e.level === this.config.levels.CRITICAL);
  }

  generateValidationId() {
    return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logValidationResult(result) {
    if (result.isValid) {
      logger.info('VALIDATOR', 'Validation passed', {
        type: result.type,
        score: result.score,
        warnings: result.warnings.length
      });
    } else {
      logger.warn('VALIDATOR', 'Validation failed', {
        type: result.type,
        score: result.score,
        errors: result.errors.length,
        warnings: result.warnings.length
      });
    }
  }

  addToHistory(result) {
    this.validationHistory.push(result);
    
    if (this.validationHistory.length > this.config.maxHistorySize) {
      this.validationHistory.shift();
    }
  }

  /**
   * Public interface methods
   */
  addValidationRule(type, rules) {
    this.validationRules.set(type, rules);
    logger.debug('VALIDATOR', `Added validation rules for type: ${type}`);
  }

  addCustomValidator(name, validator) {
    this.customValidators.set(name, validator);
    logger.debug('VALIDATOR', `Added custom validator: ${name}`);
  }

  getValidationHistory(type = null) {
    if (type) {
      return this.validationHistory.filter(result => result.type === type);
    }
    return [...this.validationHistory];
  }

  getValidationStats() {
    const history = this.validationHistory;
    const total = history.length;
    
    if (total === 0) {
      return { total: 0, passed: 0, failed: 0, averageScore: 0 };
    }
    
    const passed = history.filter(r => r.isValid).length;
    const failed = total - passed;
    const averageScore = history.reduce((sum, r) => sum + r.score, 0) / total;
    
    return {
      total,
      passed,
      failed,
      passRate: `${((passed / total) * 100).toFixed(2)}%`,
      averageScore: averageScore.toFixed(3)
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('VALIDATOR', 'Configuration updated', newConfig);
  }

  clearHistory() {
    this.validationHistory = [];
    logger.info('VALIDATOR', 'Validation history cleared');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataValidator;
} else {
  globalThis.DataValidator = DataValidator;
}