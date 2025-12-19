import NodeCache from 'node-cache'
/**
 * Maneja el cache en memoria para queries, reduce el tiempo de respuesta
 */
class CacheManager {
  constructor(config = {}) {
    // TTL = Time To Live (tiempo de vida del cache)
    // stdTTL: 300 = 5 minutos por defecto
    this.cache = new NodeCache({
      stdTTL: config.ttl || 300,      // 5 minutos por defecto
      checkperiod: config.checkperiod || 60, // revisar cada 60 segundos
      useClones: false                
    })

    this.enabled = config.enabled !== false // cache siempre habilitado por defecto
    this.stats = {
      hits: 0,      // veces que se encuentra datos en cache
      misses: 0,    // veces que no se encuentra datos en cache
      sets: 0,      // veces que se guarda cache
      deletes: 0    // veces que se elimino el cache
    }

    console.log('Cache Manager iniciado')
    console.log(`   TTL: ${config.ttl || 300}s`)
    console.log(`   Enabled: ${this.enabled}`)
  }


  /**
   * Genera una key unica para cada query
   * @param {string} table - nombre de la tabla
   * @param {Object} query - Objeto de query
   * @returns {string} - Key unica
   */
  generateKey(table, query = {}) {
    // Convertir query a un string ordenado 
    const queryString = JSON.stringify(query, Object.keys(query).sort())
    
    // formato: "table:query"
    const key = `${table}:${queryString}`
    
    return key
  }

  /**
   * Obtiene datos del cache
   * @param {string} key - Key del cache
   * @returns {*} - Datos cacheados o undefined
   */
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

  /**
   * Guarda datos en el cache
   * @param {string} key - Key del cache
   * @param {*} value - Valor a guardar
   * @param {number} ttl - Tiempo de vida 
   * @returns {boolean} - true si se guarda correctamente
   */
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


  /**
   * Elimina todas las keys relacionadas con una tabla
   * @param {string} table - Nombre de la tabla
   */
  invalidate(table) {
    if (!this.enabled) {
      return
    }

    // Obtener todas las keys del cache
    const keys = this.cache.keys()

    // Filtrar las que empiezan con el nombre de la tabla
    const keysToDelete = keys.filter(key => key.startsWith(`${table}:`))

    // Eliminar cada una
    keysToDelete.forEach(key => {
      this.cache.del(key)
      this.stats.deletes++
      console.log(`🗑️  Cache DELETE: ${key}`)
    })

    console.log(`Cache invalidado para tabla: ${table} (${keysToDelete.length} keys)`)
  }

  /**
   * Limpia todo el cache
   */
  invalidateAll() {
    if (!this.enabled) {
      return
    }

    const keyCount = this.cache.keys().length
    this.cache.flushAll()
    
    console.log(`Cache completamente limpiado (${keyCount} keys)`)
  }


}

export default CacheManager