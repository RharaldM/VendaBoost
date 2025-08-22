/**
 * VendaBoost Extension - Intelligent Cache Manager
 * Sistema de cache avançado para otimizar extrações e performance
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.metadata = new Map();
    this.listeners = new Map();
    
    // Configuration
    this.config = {
      // Cache TTL (Time To Live) for different data types
      ttl: {
        session: 24 * 60 * 60 * 1000,      // 24 horas
        profile: 2 * 60 * 60 * 1000,       // 2 horas
        groups: 60 * 60 * 1000,             // 1 hora
        friends: 4 * 60 * 60 * 1000,       // 4 horas
        posts: 30 * 60 * 1000,              // 30 minutos
        default: 60 * 60 * 1000             // 1 hora default
      },
      
      // Cache size limits
      maxSize: {
        total: 100 * 1024 * 1024,           // 100MB total
        perType: {
          session: 10 * 1024 * 1024,        // 10MB
          profile: 20 * 1024 * 1024,        // 20MB
          groups: 30 * 1024 * 1024,         // 30MB
          friends: 20 * 1024 * 1024,        // 20MB
          posts: 20 * 1024 * 1024           // 20MB
        }
      },
      
      // Cleanup settings
      cleanupInterval: 15 * 60 * 1000,      // 15 minutos
      maxEntries: 1000,                     // Máximo 1000 entradas
      compressionThreshold: 1024,           // Comprime se > 1KB
      
      // Performance settings
      enableCompression: true,
      enableEncryption: false,              // Para dados sensíveis
      enableMetrics: true,
      enablePersistence: true,
      
      // Strategy settings
      evictionStrategy: 'lru',              // LRU, LFU, FIFO
      preloadStrategy: 'predictive',        // predictive, eager, lazy
      syncStrategy: 'eventual'              // immediate, eventual, manual
    };
    
    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      totalSize: 0,
      avgAccessTime: 0
    };
    
    // Initialize
    this.initialize();
    
    logger.info('CACHE_MANAGER', 'CacheManager initialized', {
      maxSize: this.formatBytes(this.config.maxSize.total),
      strategy: this.config.evictionStrategy
    });
  }

  async initialize() {
    try {
      // Load persisted cache
      if (this.config.enablePersistence) {
        await this.loadPersistedCache();
      }
      
      // Setup cleanup interval
      this.setupCleanupScheduler();
      
      // Setup performance monitoring
      if (this.config.enableMetrics) {
        this.setupMetricsCollection();
      }
      
      logger.info('CACHE_MANAGER', 'Cache system initialized successfully');
      
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Failed to initialize cache system', null, error);
    }
  }

  /**
   * Get item from cache
   */
  async get(key, type = 'default') {
    const startTime = performance.now();
    
    try {
      const cacheKey = this.buildCacheKey(key, type);
      const entry = this.cache.get(cacheKey);
      
      if (!entry) {
        this.stats.misses++;
        logger.debug('CACHE_MANAGER', 'Cache miss', { key, type });
        return null;
      }
      
      // Check if expired
      if (this.isExpired(entry, type)) {
        await this.delete(key, type);
        this.stats.misses++;
        logger.debug('CACHE_MANAGER', 'Cache expired', { key, type, age: Date.now() - entry.timestamp });
        return null;
      }
      
      // Update access metadata
      this.updateAccessMetadata(cacheKey);
      
      // Decompress if needed
      const data = await this.decompress(entry.data, entry.compressed);
      
      this.stats.hits++;
      const accessTime = performance.now() - startTime;
      this.updateAvgAccessTime(accessTime);
      
      logger.debug('CACHE_MANAGER', 'Cache hit', { 
        key, 
        type, 
        age: Date.now() - entry.timestamp,
        accessTime: `${accessTime.toFixed(2)}ms`
      });
      
      return data;
      
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Error getting cache item', { key, type }, error);
      return null;
    }
  }

  /**
   * Set item in cache
   */
  async set(key, data, type = 'default', options = {}) {
    const startTime = performance.now();
    
    try {
      const cacheKey = this.buildCacheKey(key, type);
      
      // Validate data
      if (!this.validateData(data)) {
        throw new Error('Invalid data provided to cache');
      }
      
      // Check size limits before adding
      const dataSize = this.calculateSize(data);
      if (!this.canAccommodate(dataSize, type)) {
        await this.makeSpace(dataSize, type);
      }
      
      // Compress if needed
      const { compressedData, compressed } = await this.compress(data);
      
      // Create cache entry
      const entry = {
        data: compressedData,
        compressed,
        timestamp: Date.now(),
        size: this.calculateSize(compressedData),
        type,
        version: options.version || '1.0',
        metadata: {
          originalSize: dataSize,
          compressed,
          accessCount: 0,
          lastAccess: Date.now(),
          tags: options.tags || [],
          priority: options.priority || 'normal'
        }
      };
      
      // Store in cache
      this.cache.set(cacheKey, entry);
      this.metadata.set(cacheKey, entry.metadata);
      
      // Update statistics
      this.stats.writes++;
      this.stats.totalSize += entry.size;
      if (compressed) this.stats.compressions++;
      
      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persistCacheEntry(cacheKey, entry);
      }
      
      const writeTime = performance.now() - startTime;
      
      logger.debug('CACHE_MANAGER', 'Cache set', {
        key,
        type,
        size: this.formatBytes(entry.size),
        compressed,
        writeTime: `${writeTime.toFixed(2)}ms`
      });
      
      return true;
      
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Error setting cache item', { key, type }, error);
      return false;
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key, type = 'default') {
    try {
      const cacheKey = this.buildCacheKey(key, type);
      const entry = this.cache.get(cacheKey);
      
      if (entry) {
        this.cache.delete(cacheKey);
        this.metadata.delete(cacheKey);
        this.stats.totalSize -= entry.size;
        this.stats.deletes++;
        
        // Remove from persistence
        if (this.config.enablePersistence) {
          await this.removePersistedEntry(cacheKey);
        }
        
        logger.debug('CACHE_MANAGER', 'Cache delete', { key, type });
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Error deleting cache item', { key, type }, error);
      return false;
    }
  }

  /**
   * Check if item exists in cache
   */
  has(key, type = 'default') {
    const cacheKey = this.buildCacheKey(key, type);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return false;
    
    return !this.isExpired(entry, type);
  }

  /**
   * Clear cache by type or all
   */
  async clear(type = null) {
    try {
      if (type) {
        // Clear specific type
        const keysToDelete = [];
        
        for (const [cacheKey, entry] of this.cache.entries()) {
          if (entry.type === type) {
            keysToDelete.push(cacheKey);
          }
        }
        
        for (const cacheKey of keysToDelete) {
          const entry = this.cache.get(cacheKey);
          this.cache.delete(cacheKey);
          this.metadata.delete(cacheKey);
          this.stats.totalSize -= entry.size;
        }
        
        logger.info('CACHE_MANAGER', `Cleared cache for type: ${type}`, {
          itemsCleared: keysToDelete.length
        });
        
      } else {
        // Clear all cache
        const totalItems = this.cache.size;
        this.cache.clear();
        this.metadata.clear();
        this.stats.totalSize = 0;
        
        // Clear persistence
        if (this.config.enablePersistence) {
          await this.clearPersistedCache();
        }
        
        logger.info('CACHE_MANAGER', 'Cleared all cache', {
          itemsCleared: totalItems
        });
      }
      
      return true;
      
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Error clearing cache', { type }, error);
      return false;
    }
  }

  /**
   * Get multiple items from cache
   */
  async getMultiple(keys, type = 'default') {
    const results = new Map();
    
    for (const key of keys) {
      const data = await this.get(key, type);
      if (data !== null) {
        results.set(key, data);
      }
    }
    
    return results;
  }

  /**
   * Set multiple items in cache
   */
  async setMultiple(items, type = 'default', options = {}) {
    const results = new Map();
    
    for (const [key, data] of items.entries()) {
      const success = await this.set(key, data, type, options);
      results.set(key, success);
    }
    
    return results;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalSizeFormatted: this.formatBytes(this.stats.totalSize),
      cacheEntries: this.cache.size,
      compressionRatio: this.stats.compressions > 0 
        ? (this.stats.compressions / this.stats.writes * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Get cache size by type
   */
  getSizeByType() {
    const sizeByType = {};
    
    for (const [cacheKey, entry] of this.cache.entries()) {
      const type = entry.type;
      sizeByType[type] = (sizeByType[type] || 0) + entry.size;
    }
    
    return sizeByType;
  }

  /**
   * Cleanup expired entries
   */
  async cleanup() {
    logger.info('CACHE_MANAGER', 'Starting cache cleanup');
    
    const startTime = performance.now();
    let expiredCount = 0;
    let evictedCount = 0;
    
    // Remove expired entries
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (this.isExpired(entry, entry.type)) {
        await this.delete(this.extractKeyFromCacheKey(cacheKey), entry.type);
        expiredCount++;
      }
    }
    
    // Evict entries if over size limit
    while (this.stats.totalSize > this.config.maxSize.total) {
      const evicted = await this.evictLeastUsed();
      if (!evicted) break;
      evictedCount++;
    }
    
    const duration = performance.now() - startTime;
    
    logger.info('CACHE_MANAGER', 'Cache cleanup completed', {
      duration: `${duration.toFixed(2)}ms`,
      expiredCount,
      evictedCount,
      remainingEntries: this.cache.size,
      totalSize: this.formatBytes(this.stats.totalSize)
    });
  }

  /**
   * Preload cache with predicted data
   */
  async preload(predictions) {
    if (this.config.preloadStrategy === 'lazy') return;
    
    logger.info('CACHE_MANAGER', 'Starting cache preload', {
      predictions: predictions.length
    });
    
    for (const prediction of predictions) {
      try {
        // Check if already cached
        if (!this.has(prediction.key, prediction.type)) {
          // Preload data (would need extractor integration)
          logger.debug('CACHE_MANAGER', 'Preloading data', prediction);
        }
      } catch (error) {
        logger.debug('CACHE_MANAGER', 'Preload failed for item', prediction, error);
      }
    }
  }

  // Private methods
  buildCacheKey(key, type) {
    return `${type}:${key}`;
  }

  extractKeyFromCacheKey(cacheKey) {
    return cacheKey.split(':').slice(1).join(':');
  }

  isExpired(entry, type) {
    const ttl = this.config.ttl[type] || this.config.ttl.default;
    return Date.now() - entry.timestamp > ttl;
  }

  validateData(data) {
    if (data === null || data === undefined) return false;
    
    try {
      JSON.stringify(data);
      return true;
    } catch (error) {
      return false;
    }
  }

  calculateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      return JSON.stringify(data).length * 2; // Rough estimate
    }
  }

  canAccommodate(size, type) {
    const currentTypeSize = this.getSizeByType()[type] || 0;
    const maxTypeSize = this.config.maxSize.perType[type] || this.config.maxSize.total;
    
    return (currentTypeSize + size) <= maxTypeSize && 
           (this.stats.totalSize + size) <= this.config.maxSize.total;
  }

  async makeSpace(requiredSize, type) {
    logger.debug('CACHE_MANAGER', 'Making space in cache', {
      requiredSize: this.formatBytes(requiredSize),
      currentSize: this.formatBytes(this.stats.totalSize)
    });
    
    let freedSize = 0;
    const targetSize = requiredSize * 1.2; // Free 20% extra
    
    while (freedSize < targetSize && this.cache.size > 0) {
      const evicted = await this.evictLeastUsed();
      if (!evicted) break;
      freedSize += evicted.size;
    }
    
    return freedSize >= requiredSize;
  }

  async evictLeastUsed() {
    let leastUsedKey = null;
    let leastUsedEntry = null;
    let minScore = Infinity;
    
    for (const [cacheKey, entry] of this.cache.entries()) {
      const metadata = this.metadata.get(cacheKey);
      if (!metadata) continue;
      
      // Calculate usage score (lower = less used)
      const score = this.calculateUsageScore(metadata);
      
      if (score < minScore) {
        minScore = score;
        leastUsedKey = cacheKey;
        leastUsedEntry = entry;
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.metadata.delete(leastUsedKey);
      this.stats.totalSize -= leastUsedEntry.size;
      this.stats.evictions++;
      
      logger.debug('CACHE_MANAGER', 'Evicted cache entry', {
        key: leastUsedKey,
        size: this.formatBytes(leastUsedEntry.size),
        score: minScore
      });
      
      return leastUsedEntry;
    }
    
    return null;
  }

  calculateUsageScore(metadata) {
    const now = Date.now();
    const timeSinceLastAccess = now - metadata.lastAccess;
    const accessFrequency = metadata.accessCount / Math.max(1, timeSinceLastAccess / (60 * 1000)); // per minute
    
    // Lower score = less used
    const priorityMultiplier = metadata.priority === 'high' ? 2 : metadata.priority === 'low' ? 0.5 : 1;
    
    return (timeSinceLastAccess / accessFrequency) / priorityMultiplier;
  }

  updateAccessMetadata(cacheKey) {
    const metadata = this.metadata.get(cacheKey);
    if (metadata) {
      metadata.accessCount++;
      metadata.lastAccess = Date.now();
    }
  }

  updateAvgAccessTime(accessTime) {
    const totalAccesses = this.stats.hits + this.stats.misses;
    this.stats.avgAccessTime = ((this.stats.avgAccessTime * (totalAccesses - 1)) + accessTime) / totalAccesses;
  }

  async compress(data) {
    if (!this.config.enableCompression) {
      return { compressedData: data, compressed: false };
    }
    
    const dataString = JSON.stringify(data);
    
    if (dataString.length < this.config.compressionThreshold) {
      return { compressedData: data, compressed: false };
    }
    
    try {
      // Simple compression using JSON minification (can be enhanced with real compression)
      const compressedData = JSON.parse(dataString); // Already minified by stringify
      return { compressedData, compressed: true };
    } catch (error) {
      return { compressedData: data, compressed: false };
    }
  }

  async decompress(data, isCompressed) {
    if (!isCompressed) return data;
    
    try {
      // Simple decompression (would use real decompression in production)
      this.stats.decompressions++;
      return data;
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Decompression failed', null, error);
      return data;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setupCleanupScheduler() {
    setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('CACHE_MANAGER', 'Scheduled cleanup failed', null, error);
      });
    }, this.config.cleanupInterval);
  }

  setupMetricsCollection() {
    // Collect metrics every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      logger.info('CACHE_MANAGER', 'Cache metrics', stats);
    }, 5 * 60 * 1000);
  }

  async loadPersistedCache() {
    try {
      const result = await chrome.storage.local.get(['vendaboost_cache']);
      if (result.vendaboost_cache) {
        // Load persisted cache entries
        logger.info('CACHE_MANAGER', 'Loading persisted cache');
        // Implementation would restore cache from storage
      }
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Failed to load persisted cache', null, error);
    }
  }

  async persistCacheEntry(cacheKey, entry) {
    // Implementation for persisting important cache entries
    // Would selectively persist based on importance and size
  }

  async removePersistedEntry(cacheKey) {
    // Implementation for removing persisted entries
  }

  async clearPersistedCache() {
    try {
      await chrome.storage.local.remove(['vendaboost_cache']);
    } catch (error) {
      logger.error('CACHE_MANAGER', 'Failed to clear persisted cache', null, error);
    }
  }

  /**
   * Public interface methods
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('CACHE_MANAGER', 'Configuration updated', newConfig);
  }

  async optimize() {
    logger.info('CACHE_MANAGER', 'Starting cache optimization');
    
    await this.cleanup();
    
    // Additional optimization logic
    // - Compress uncompressed entries
    // - Consolidate fragmented data
    // - Update access patterns
    
    logger.info('CACHE_MANAGER', 'Cache optimization completed');
  }

  exportCache() {
    const exportData = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      entries: {},
      metadata: {}
    };
    
    for (const [cacheKey, entry] of this.cache.entries()) {
      exportData.entries[cacheKey] = entry;
      exportData.metadata[cacheKey] = this.metadata.get(cacheKey);
    }
    
    return exportData;
  }

  async importCache(importData) {
    if (importData.version !== '2.0.0') {
      logger.warn('CACHE_MANAGER', 'Import version mismatch', {
        expected: '2.0.0',
        received: importData.version
      });
    }
    
    // Clear current cache
    await this.clear();
    
    // Import entries
    for (const [cacheKey, entry] of Object.entries(importData.entries)) {
      this.cache.set(cacheKey, entry);
      this.metadata.set(cacheKey, importData.metadata[cacheKey]);
      this.stats.totalSize += entry.size;
    }
    
    logger.info('CACHE_MANAGER', 'Cache imported successfully', {
      entriesImported: Object.keys(importData.entries).length
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheManager;
} else {
  globalThis.CacheManager = CacheManager;
}