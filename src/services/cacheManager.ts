interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private cleanupTimer: number | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 500,
      defaultTTL: 10 * 60 * 1000, // 10 minutes default
      cleanupInterval: 5 * 60 * 1000, // 5 minutes cleanup
      ...config
    };

    this.startCleanupTimer();
  }

  /**
   * Set cache entry with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    
    // If cache is full, remove least recently used items
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 0,
      lastAccessed: now
    });
  }

  /**
   * Get cache entry if valid
   */
  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const effectiveTTL = ttl || this.config.defaultTTL;

    // Check if expired
    if (now - entry.timestamp > effectiveTTL) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string, ttl?: number): boolean {
    return this.get(key, ttl) !== null;
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching pattern
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete = Array.from(this.cache.keys())
      .filter(key => key.includes(pattern));
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: string;
  } {
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);
    
    const hits = Array.from(this.cache.values())
      .filter(entry => entry.accessCount > 0).length;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: totalAccess > 0 ? hits / totalAccess : 0,
      memoryUsage: `${Math.round(this.cache.size * 0.001)}KB (estimated)`
    };
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.config.defaultTTL) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = window.setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// Single unified cache instance
export const appCache = new CacheManager({
  maxSize: 1000,
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  cleanupInterval: 5 * 60 * 1000
});

// Utility functions for cache operations
export const cacheUtils = {
  /**
   * Generate consistent cache keys
   */
  generateKey: (prefix: string, ...parts: (string | number | boolean)[]): string => {
    return `${prefix}:${parts.map(p => String(p)).join(':')}`;
  },

  /**
   * Clear all caches
   */
  clearAll: (): void => {
    appCache.invalidate();
  },

  // Specific cache operations
  search: {
    set: (query: string, center: any, results: any[]) => {
      const key = cacheUtils.generateKey('search', query, center?.lat || 0, center?.lng || 0);
      appCache.set(key, results, 5 * 60 * 1000); // 5 minutes for search
    },
    get: (query: string, center: any) => {
      const key = cacheUtils.generateKey('search', query, center?.lat || 0, center?.lng || 0);
      return appCache.get(key, 5 * 60 * 1000);
    }
  },

  lists: {
    set: (lists: any[]) => {
      appCache.set('archived_lists', lists, 15 * 60 * 1000); // 15 minutes for lists
    },
    get: () => {
      return appCache.get('archived_lists', 15 * 60 * 1000);
    },
    invalidate: () => {
      appCache.delete('archived_lists');
    }
  }
};

export default CacheManager; 