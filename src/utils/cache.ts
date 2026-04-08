/**
 * LRU-ish TTL cache for API responses.
 * Prevents redundant requests within a session. Evicts oldest entries
 * when capacity is reached.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ResponseCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 200, ttlMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Evict a specific key. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /** Evict all entries. */
  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
