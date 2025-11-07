/*
 * Permite hacer queries encadenadas como
 * db.from('flowers').select('*').eq('type', 'roses').order('name')
 */
class QueryBuilder {
  constructor(sheetsConnector) {
    this.connector = sheetsConnector
    
    // Estado inicial de la query
    this.query = {
      table: null,           // Nombre de la tabla
      columns: ['*'],        // Columnas a seleccionar
      filters: [],           // Filtros WHERE
      orderBy: null,         // Ordenamiento
      orderDirection: 'asc', // Dirección del orden
      limitValue: null       // Límite de resultados
    }
  }

  /**
   * Especifica la tabla (hoja) a consultar
   * @param {string} tableName - Nombre de la tabla
   * @returns {QueryBuilder} - Retorna this para encadenamiento
   */
  from(tableName) {
    this.query.table = tableName
    return this // ← Permite encadenar: .from('x').select('y')
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
        .split(',') //dividir columns 
        .map(col => col.trim())
    }
    return this
  }

  /**
   * Filtro, campo igual a valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  eq(field, value) {
    this.query.filters.push({
      field,
      operator: 'eq',
      value
    })
    return this
  }

  /**
   * Filtro, campo diferente a valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  neq(field, value) {
    this.query.filters.push({
      field,
      operator: 'neq',
      value
    })
    return this
  }


  /**
   * gt: greater than
   * Filtro, campo mayor que valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  gt(field, value) {
    this.query.filters.push({
      field,
      operator: 'gt',
      value
    })
    return this
  }


  /**
   * gte: greater than or equal
   * Filtro, campo mayor o igual que valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  gte(field, value) {
    this.query.filters.push({
      field,
      operator: 'gte',
      value
    })
    return this
  }


  /**
   * lt: less than
   * Filtro, campo menor que valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  lt(field, value) {
    this.query.filters.push({
      field,
      operator: 'lt',
      value
    })
    return this
  }


  /**
   * lte: less than or equal
   * Filtro, campo menor o igual que valor
   * @param {string} field - Nombre del campo
   * @param {*} value - Valor a comparar
   * @returns {QueryBuilder}
   */
  lte(field, value) {
    this.query.filters.push({
      field,
      operator: 'lte',
      value
    })
    return this
  }


  /**
   * Filtro, campo contiene texto
   * @param {string} field - Nombre del campo
   * @param {string} pattern - Patrón a buscar
   * @returns {QueryBuilder}
   */
  like(field, pattern) {
    this.query.filters.push({
      field,
      operator: 'like',
      value: pattern
    })
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
   * @param {number} count - Cantidad máxima de resultados
   * @returns {QueryBuilder}
   */
  limit(count) {
    this.query.limitValue = count
    return this
  }

  /**
   * Ejecuta la query y devuelve los resultados
   * @returns {Promise<Array>} - Array de registros
   */
  async execute() {
    console.log('🔍 Ejecutando query:', JSON.stringify(this.query, null, 2))

    //validar que se especificó una tabla
    if (!this.query.table) {
      throw new Error('Debes especificar una tabla con .from()')
    }
    let data = await this.connector.readSheet(this.query.table) //obtener los datos de la tabla

    data = this.applyFilters(data)
    data = this.applySelect(data)
    data = this.applyOrder(data)
    data = this.applyLimit(data)

    console.log(`Se ejecuto correctamente: ${data.length} resultados`)
    return data
  }

  /**
   * Aplica todos los filtros al dataset
   * @param {Array} data - Datos originales
   * @returns {Array} - Datos filtrados
   */
  applyFilters(data) {
    if (this.query.filters.length === 0) {
      return data
    }

    return data.filter(record => {
      return this.query.filters.every(filter => {
        const fieldValue = record[filter.field]
        const filterValue = filter.value

        switch (filter.operator) {
          case 'eq':
            return fieldValue == filterValue // == permite '1' == 1

          case 'neq':
            return fieldValue != filterValue

          case 'gt':
            return Number(fieldValue) > Number(filterValue)

          case 'gte':
            return Number(fieldValue) >= Number(filterValue)

          case 'lt':
            return Number(fieldValue) < Number(filterValue)

          case 'lte':
            return Number(fieldValue) <= Number(filterValue)

          case 'like':
            const field = String(fieldValue).toLowerCase()
            const pattern = String(filterValue).toLowerCase()
            return field.includes(pattern)

          default:
            console.warn(`⚠️  Operador desconocido: ${filter.operator}`)
            return true
        }
      })
    })
  }

  /**
   * Selecciona solo las columnas especificadas
   * @param {Array} data - Datos filtrados
   * @returns {Array} - Datos con columnas seleccionadas
   */
  applySelect(data) {
    if (this.query.columns.includes('*')) {
      return data
    }

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
   * @param {Array} data - Datos a ordenar
   * @returns {Array} - Datos ordenados
   */
  applyOrder(data) {
    if (!this.query.orderBy) {
      return data
    }

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
   * @param {Array} data - Datos a limitar
   * @returns {Array} - Datos limitados
   */
  applyLimit(data) {
    if (!this.query.limitValue) {
      return data
    }

    return data.slice(0, this.query.limitValue)
  }
}

export default QueryBuilder