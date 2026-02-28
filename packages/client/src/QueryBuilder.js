/**
 * Construye queries con una API encadenable estilo Supabase
 * Esta clase es solo para armar el objeto query y mandarlo al servidor,
 * la logica real de filtrado corre en packages/server/src/core/QueryBuilder.js
 */

export class QueryBuilder {
  /**
   * Crea una nueva instancia del QueryBuilder
   * @param {SheetsBaseClient} client - Instancia del cliente
   * @param {string} table - Nombre de la tabla a consultar
   */
  constructor(client, table) {
    this.client = client

    // estado inicial de la query
    this.query = {
      table: table,
      columns: ['*'],        // columnas a seleccionar
      filters: [],           // filtros WHERE
      orderBy: null,         // campo para ordenar
      orderDirection: 'asc', // direccion del orden
      limitValue: null       // limite de resultados
    }
  }

  /**
   * Especifica que columnas seleccionar
   * @param {string} columns - columnas separadas por coma: 'name, country' o '*'
   * @returns {QueryBuilder}
   */
  select(columns = '*') {
    if (columns === '*') {
      this.query.columns = ['*']
    } else {
      this.query.columns = columns
        .split(',')
        .map(col => col.trim())
    }
    return this
  }

  /**
   * Filtro: campo igual a valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  eq(field, value) {
    this.query.filters.push({ field, op: 'eq', value })
    return this
  }

  /**
   * Filtro: campo diferente a valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  neq(field, value) {
    this.query.filters.push({ field, op: 'neq', value })
    return this
  }

  /**
   * Filtro: campo mayor que valor (gt: greater than)
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  gt(field, value) {
    this.query.filters.push({ field, op: 'gt', value })
    return this
  }

  /**
   * Filtro: campo mayor o igual que valor (gte: greater than or equal)
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  gte(field, value) {
    this.query.filters.push({ field, op: 'gte', value })
    return this
  }

  /**
   * Filtro: campo menor que valor (lt: less than)
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  lt(field, value) {
    this.query.filters.push({ field, op: 'lt', value })
    return this
  }

  /**
   * Filtro: campo menor o igual que valor (lte: less than or equal)
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  lte(field, value) {
    this.query.filters.push({ field, op: 'lte', value })
    return this
  }

  /**
   * Filtro: campo contiene el patron de texto
   * @param {string} field - Nombre del campo
   * @param {string} pattern - Patron a buscar
   * @returns {QueryBuilder}
   */
  like(field, pattern) {
    this.query.filters.push({ field, op: 'like', value: pattern })
    return this
  }

  /**
   * Ordena los resultados
   * @param {string} field - Campo por el cual ordenar
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
   * @param {number} count - Cantidad maxima de resultados
   * @returns {QueryBuilder}
   */
  limit(count) {
    this.query.limitValue = count
    return this
  }

  /**
   * Ejecuta la query y devuelve los resultados
   * Transforma el objeto query al formato que espera el servidor antes de mandarlo
   * @returns {Promise<Array>} Array de registros
   */
  async execute() {
    if (!this.query.table) {
      throw new Error('Debes especificar una tabla con .from()')
    }

    // transformar al formato que espera el servidor
    const payload = {
      table: this.query.table,
      select: this.query.columns.join(', '),   // array → string
      filters: this.query.filters,
      order: this.query.orderBy
        ? { field: this.query.orderBy, direction: this.query.orderDirection }
        : null,                                 // objeto { field, direction }
      limit: this.query.limitValue             // limitValue => limit
    }

    console.log(' Ejecutando query:', JSON.stringify(payload, null, 2))

    const response = await this.client.request('/api/query', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    console.log(` Query ejecutada: ${response.data?.length || 0} resultados`)
    return response.data || []
  }

  /**
   * Permite usar await directamente sobre la instancia sin llamar .execute()
   * Ejemplo: const result = await db.from('users')
   */
  then(resolve, reject) {
    return this.execute().then(resolve, reject)
  }
}