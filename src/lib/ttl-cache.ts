type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>()

  set(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)

    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }
}
