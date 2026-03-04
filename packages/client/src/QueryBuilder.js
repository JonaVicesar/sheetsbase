/**
 * Construye y ejecuta queries con una API encadenable estilo Supabase
 * Contiene toda la logica de filtrado, ordenamiento y seleccion de columnas
 */
class QueryBuilder {
  constructor(sheetsConnector, cacheManager = null) {
    this.connector = sheetsConnector
    this.cache = cacheManager

    // estado inicial de la query
    this.query = {
      table: null,
      columns: ['*'],
      filters: [],
      orderBy: null,
      orderDirection: 'asc',
      limitValue: null
    }
  }

  /**
   * Especifica la tabla a consultar
   * @param {string} tableName - nombre de la tabla
   * @returns {QueryBuilder}
   */
  from(tableName) {
    this.query.table = tableName
    return this
  }

  /**
   * Especifica que columnas seleccionar
   * @param {string} columns - columnas separadas por coma o '*'
   * @returns {QueryBuilder}
   */
  select(columns = '*') {
    if (columns === '*') {
      this.query.columns = ['*']
    } else {
      this.query.columns = columns.split(',').map(col => col.trim())
    }
    return this
  }

  // filtro: campo igual a valor
  eq(field, value) {
    this.query.filters.push({ field, operator: 'eq', value })
    return this
  }

  // filtro: campo diferente a valor
  neq(field, value) {
    this.query.filters.push({ field, operator: 'neq', value })
    return this
  }

  // filtro: campo mayor que valor (gt: greater than)
  gt(field, value) {
    this.query.filters.push({ field, operator: 'gt', value })
    return this
  }

  // filtro: campo mayor o igual que valor (gte: greater than or equal)
  gte(field, value) {
    this.query.filters.push({ field, operator: 'gte', value })
    return this
  }

  // filtro: campo menor que valor (lt: less than)
  lt(field, value) {
    this.query.filters.push({ field, operator: 'lt', value })
    return this
  }

  // filtro: campo menor o igual que valor (lte: less than or equal)
  lte(field, value) {
    this.query.filters.push({ field, operator: 'lte', value })
    return this
  }

  // filtro: campo contiene el patron de texto
  like(field, pattern) {
    this.query.filters.push({ field, operator: 'like', value: pattern })
    return this
  }

  /**
   * Ordena los resultados
   * @param {string} field - campo por el cual ordenar
   * @param {string} direction - 'asc' o 'desc'
   * @returns {QueryBuilder}
   */
  order(field, direction = 'asc') {
    this.query.orderBy = field
    this.query.orderDirection = direction.toLowerCase()
    return this
  }

  /**
   * Limita la cantidad de resultados
   * @param {number} count - cantidad maxima de resultados
   * @returns {QueryBuilder}
   */
  limit(count) {
    this.query.limitValue = count
    return this
  }

  /**
   * Ejecuta la query contra Google Sheets
   * @returns {Promise<Array>} array de registros
   */
  async execute() {
    if (!this.query.table) {
      throw new Error('Debes especificar una tabla con .from()')
    }

    // intentar obtener del cache
    if (this.cache) {
      const cacheKey = this.cache.generateKey(this.query.table, this.query)
      const cachedData = this.cache.get(cacheKey)
      if (cachedData !== undefined) {
        console.log(`Query ejecutada desde cache: ${cachedData.length} resultados`)
        return cachedData
      }
    }

    // leer datos de Google Sheets
    let data = await this.connector.readSheet(this.query.table)

    // aplicar logica de query
    data = this.applyFilters(data)
    data = this.applySelect(data)
    data = this.applyOrder(data)
    data = this.applyLimit(data)

    // guardar en cache
    if (this.cache) {
      const cacheKey = this.cache.generateKey(this.query.table, this.query)
      this.cache.set(cacheKey, data)
    }

    console.log(`Query ejecutada: ${data.length} resultados`)
    return data
  }

  /**
   * Permite usar await directamente sin llamar .execute()
   * Ejemplo: const result = await db.from('users').eq('status', 'active')
   */
  then(resolve, reject) {
    return this.execute().then(resolve, reject)
  }

  // ─── metodos internos de la query ────────────────────────────────────────

  /**
   * Aplica todos los filtros al dataset
   * @param {Array} data - datos originales
   * @returns {Array} datos filtrados
   */
  applyFilters(data) {
    if (this.query.filters.length === 0) return data

    return data.filter(record => {
      return this.query.filters.every(filter => {
        const fieldValue = record[filter.field]
        const filterValue = filter.value

        switch (filter.operator) {
          case 'eq':   return fieldValue == filterValue
          case 'neq':  return fieldValue != filterValue
          case 'gt':   return Number(fieldValue) > Number(filterValue)
          case 'gte':  return Number(fieldValue) >= Number(filterValue)
          case 'lt':   return Number(fieldValue) < Number(filterValue)
          case 'lte':  return Number(fieldValue) <= Number(filterValue)
          case 'like':
            return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase())
          default:
            console.warn(`Operador desconocido: ${filter.operator}`)
            return true
        }
      })
    })
  }

  /**
   * Selecciona solo las columnas especificadas
   * @param {Array} data - datos filtrados
   * @returns {Array} datos con columnas seleccionadas
   */
  applySelect(data) {
    if (this.query.columns.includes('*')) return data

    return data.map(record => {
      const selected = {}
      this.query.columns.forEach(col => {
        selected[col] = record[col]
      })
      return selected
    })
  }

  /**
   * Ordena los resultados
   * @param {Array} data - datos a ordenar
   * @returns {Array} datos ordenados
   */
  applyOrder(data) {
    if (!this.query.orderBy) return data

    const field = this.query.orderBy
    const direction = this.query.orderDirection

    return [...data].sort((a, b) => {
      const aVal = a[field]
      const bVal = b[field]
      const aNum = Number(aVal)
      const bNum = Number(bVal)

      let comparison = 0
      if (!isNaN(aNum) && !isNaN(bNum)) {
        comparison = aNum - bNum
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return direction === 'desc' ? -comparison : comparison
    })
  }

  /**
   * Limita la cantidad de resultados
   * @param {Array} data - datos a limitar
   * @returns {Array} datos limitados
   */
  applyLimit(data) {
    if (!this.query.limitValue) return data
    return data.slice(0, this.query.limitValue)
  }
}

export default QueryBuilder