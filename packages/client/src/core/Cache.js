import NodeCache from 'node-cache'

/**
 * In-memory cache for query results, keyed by `table:query`.
 */
class CacheManager {
  constructor(config = {}) {
    this.cache = new NodeCache({
      stdTTL: config.ttl || 300,      // 5 minutes by default
      checkperiod: config.checkperiod || 60, // sweep interval in seconds
      useClones: true                 // get/set return copies: callers cannot mutate the cache
    })

    this.enabled = config.enabled !== false // enabled by default
    this.stats = {
      hits: 0,     // reads served from cache
      misses: 0,   // reads that fell through
      sets: 0,     // entries stored
      deletes: 0   // entries removed
    }

    console.log('Cache manager initialized')
    console.log(`   TTL: ${config.ttl || 300}s`)
    console.log(`   Enabled: ${this.enabled}`)
  }

  /**
   * Canonical cache key from query semantics: filter order cannot change it,
   * so equivalent queries share entries. Keeps the `table:` prefix used by invalidate().
   */
  generateKey(table, query = {}) {
    const cols = (query.columns || ['*']).join(',')
    const filters = (query.filters || [])
      .map(f => JSON.stringify([f.field, f.operator, f.value]))
      .sort()
      .join(';')
    const order = query.orderBy ? `${query.orderBy}:${query.orderDirection}` : ''

    return `${table}:${cols}|${filters}|${order}|${query.limitValue ?? ''}`
  }

  get(key) {
    if (!this.enabled) {
      return undefined
    }

    const value = this.cache.get(key)

    if (value !== undefined) {
      this.stats.hits++
      console.log(`Cache HIT: ${key}`)
    } else {
      this.stats.misses++
      console.log(`Cache MISS: ${key}`)
    }

    return value
  }

  set(key, value, ttl) {
    if (!this.enabled) {
      return false
    }

    const success = this.cache.set(key, value, ttl)

    if (success) {
      this.stats.sets++
      console.log(`Cache SET: ${key} (TTL: ${ttl || 'default'}s)`)
    }

    return success
  }

  invalidate(table) {
    if (!this.enabled) {
      return
    }

    const keysToDelete = this.cache.keys().filter(key => key.startsWith(`${table}:`))

    keysToDelete.forEach(key => {
      this.cache.del(key)
      this.stats.deletes++
      console.log(`Cache DELETE: ${key}`)
    })

    console.log(`Cache invalidated for table: ${table} (${keysToDelete.length} keys)`)
  }

  invalidateAll() {
    if (!this.enabled) {
      return
    }

    const keyCount = this.cache.keys().length
    this.cache.flushAll()

    console.log(`Cache fully cleared (${keyCount} keys)`)
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? Number(((this.stats.hits / total) * 100).toFixed(2)) : 0

    return {
      ...this.stats,
      totalRequests: total,
      hitRate,
      currentKeys: this.cache.keys().length,
      keys: this.cache.keys()
    }
  }
}

export default CacheManager
