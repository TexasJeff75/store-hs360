interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items in cache
}

class CacheService {
  private memoryCache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get item from cache (checks memory first, then localStorage)
   */
  get<T>(key: string): T | null {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && memoryItem.expiresAt > Date.now()) {
      return memoryItem.data;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        const item: CacheItem<T> = JSON.parse(stored);
        if (item.expiresAt > Date.now()) {
          // Restore to memory cache
          this.memoryCache.set(key, item);
          return item.data;
        } else {
          // Expired, remove from localStorage
          localStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (error) {
      console.warn('Cache localStorage read error:', error);
    }

    // Clean up expired memory cache item
    if (memoryItem) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  /**
   * Set item in cache (both memory and localStorage)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresAt
    };

    // Store in memory
    this.memoryCache.set(key, item);

    // Store in localStorage
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Cache localStorage write error:', error);
      // If localStorage is full, try to clear some space
      this.clearExpiredFromLocalStorage();
    }

    // Clean up memory cache if it gets too large
    if (this.memoryCache.size > 100) {
      this.cleanupMemoryCache();
    }
  }

  /**
   * Remove item from cache
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Cache localStorage delete error:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Cache localStorage clear error:', error);
    }
  }

  /**
   * Get or set with a factory function
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Check if item exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    
    try {
      const keys = Object.keys(localStorage);
      localStorageSize = keys.filter(key => key.startsWith('cache_')).length;
    } catch (error) {
      console.warn('Error getting localStorage stats:', error);
    }

    return {
      memorySize,
      localStorageSize,
      totalSize: memorySize + localStorageSize
    };
  }

  /**
   * Clean up expired items from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.memoryCache.forEach((item, key) => {
      if (item.expiresAt <= now) {
        toDelete.push(key);
      }
    });

    // If still too many items, remove oldest ones
    if (this.memoryCache.size - toDelete.length > 100) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const excess = this.memoryCache.size - toDelete.length - 100;
      for (let i = 0; i < excess; i++) {
        toDelete.push(entries[i][0]);
      }
    }

    toDelete.forEach(key => this.memoryCache.delete(key));
  }

  /**
   * Clean up expired items from localStorage
   */
  private clearExpiredFromLocalStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const item = JSON.parse(stored);
              if (item.expiresAt <= now) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Error cleaning localStorage cache:', error);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Cache key generators
export const CacheKeys = {
  products: () => 'products_all',
  categories: () => 'categories_all',
  contractPricing: (userId: string, productId: number) => `pricing_${userId}_${productId}`,
  userPricing: (userId: string) => `user_pricing_${userId}`,
  organizationPricing: (orgId: string) => `org_pricing_${orgId}`,
  locationPricing: (locationId: string) => `location_pricing_${locationId}`,
  effectivePrice: (userId: string, productId: number, quantity?: number) => 
    `effective_price_${userId}_${productId}_${quantity || 1}`,
} as const;

// Cache TTL constants (in milliseconds)
export const CacheTTL = {
  products: 10 * 60 * 1000,      // 10 minutes - products don't change often
  categories: 30 * 60 * 1000,    // 30 minutes - categories change rarely
  pricing: 5 * 60 * 1000,        // 5 minutes - pricing might change more frequently
  effectivePrice: 2 * 60 * 1000, // 2 minutes - effective pricing calculation
} as const;