/**
 * Safe localStorage wrapper with error handling and fallbacks
 * Prevents crashes when localStorage is not available or quota is exceeded
 */

type StorageValue = string | number | boolean | object | null;

class SafeStorage {
  private memoryStore: Map<string, string> = new Map();
  private isStorageAvailable: boolean;

  constructor() {
    this.isStorageAvailable = this.checkStorageAvailability();
  }

  private checkStorageAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('[SafeStorage] localStorage is not available, using memory fallback');
      return false;
    }
  }

  /**
   * Safely get an item from storage
   */
  getItem<T = string>(key: string, defaultValue?: T): T | null {
    try {
      let value: string | null;

      if (this.isStorageAvailable) {
        value = localStorage.getItem(key);
      } else {
        value = this.memoryStore.get(key) || null;
      }

      if (value === null) {
        return defaultValue !== undefined ? defaultValue : null;
      }

      // Try to parse JSON, fallback to raw value
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`[SafeStorage] Error getting item "${key}":`, error);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * Safely set an item in storage
   */
  setItem(key: string, value: StorageValue): boolean {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.isStorageAvailable) {
        try {
          localStorage.setItem(key, stringValue);
        } catch (e) {
          // Handle quota exceeded error
          if (e instanceof DOMException && (
            e.name === 'QuotaExceededError' ||
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
          )) {
            console.warn('[SafeStorage] Storage quota exceeded, clearing old data...');
            this.clearOldData();
            
            // Try again after clearing
            try {
              localStorage.setItem(key, stringValue);
            } catch (retryError) {
              console.error('[SafeStorage] Still failed after clearing:', retryError);
              this.memoryStore.set(key, stringValue);
              return false;
            }
          } else {
            throw e;
          }
        }
      } else {
        this.memoryStore.set(key, stringValue);
      }

      return true;
    } catch (error) {
      console.error(`[SafeStorage] Error setting item "${key}":`, error);
      return false;
    }
  }

  /**
   * Safely remove an item from storage
   */
  removeItem(key: string): boolean {
    try {
      if (this.isStorageAvailable) {
        localStorage.removeItem(key);
      } else {
        this.memoryStore.delete(key);
      }
      return true;
    } catch (error) {
      console.error(`[SafeStorage] Error removing item "${key}":`, error);
      return false;
    }
  }

  /**
   * Clear all storage
   */
  clear(): boolean {
    try {
      if (this.isStorageAvailable) {
        localStorage.clear();
      } else {
        this.memoryStore.clear();
      }
      return true;
    } catch (error) {
      console.error('[SafeStorage] Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Check if a key exists in storage
   */
  hasItem(key: string): boolean {
    try {
      if (this.isStorageAvailable) {
        return localStorage.getItem(key) !== null;
      } else {
        return this.memoryStore.has(key);
      }
    } catch (error) {
      console.error(`[SafeStorage] Error checking item "${key}":`, error);
      return false;
    }
  }

  /**
   * Get all keys from storage
   */
  keys(): string[] {
    try {
      if (this.isStorageAvailable) {
        return Object.keys(localStorage);
      } else {
        return Array.from(this.memoryStore.keys());
      }
    } catch (error) {
      console.error('[SafeStorage] Error getting keys:', error);
      return [];
    }
  }

  /**
   * Clear old data when quota is exceeded
   * Remove items that haven't been accessed recently
   */
  private clearOldData(): void {
    try {
      const keys = this.keys();
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      keys.forEach(key => {
        try {
          // Try to get timestamp from value
          const value = this.getItem(key);
          if (value && typeof value === 'object' && 'timestamp' in value) {
            const timestamp = (value as any).timestamp;
            if (now - timestamp > maxAge) {
              this.removeItem(key);
            }
          }
        } catch (error) {
          // If we can't read it, remove it
          this.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[SafeStorage] Error clearing old data:', error);
    }
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; available: boolean; keys: number } {
    try {
      let used = 0;
      const keys = this.keys();

      keys.forEach(key => {
        const value = this.getItem(key);
        if (value !== null) {
          used += JSON.stringify(value).length;
        }
      });

      return {
        used,
        available: this.isStorageAvailable,
        keys: keys.length
      };
    } catch (error) {
      console.error('[SafeStorage] Error getting storage info:', error);
      return { used: 0, available: false, keys: 0 };
    }
  }
}

// Export singleton instance
export const safeStorage = new SafeStorage();

// Convenience functions for common operations
export const getStorageItem = <T = string>(key: string, defaultValue?: T): T | null => 
  safeStorage.getItem(key, defaultValue);

export const setStorageItem = (key: string, value: StorageValue): boolean => 
  safeStorage.setItem(key, value);

export const removeStorageItem = (key: string): boolean => 
  safeStorage.removeItem(key);

export const clearStorage = (): boolean => 
  safeStorage.clear();

export const hasStorageItem = (key: string): boolean => 
  safeStorage.hasItem(key);

