/**
 * Builds and executes queries with a Supabase-like chainable API.
 * All filtering, ordering and projection happen in memory.
 */
class QueryBuilder {
  constructor(sheetsConnector, cacheManager = null) {
    this.connector = sheetsConnector
    this.cache = cacheManager

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
   * Sets the table (sheet) to query.
   * @returns {QueryBuilder}
   */
  from(tableName) {
    this.query.table = tableName
    return this
  }

  /**
   * Columns to return: '*' or a comma-separated list.
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

  eq(field, value) {
    this.query.filters.push({ field, operator: 'eq', value })
    return this
  }

  neq(field, value) {
    this.query.filters.push({ field, operator: 'neq', value })
    return this
  }

  gt(field, value) {
    this.query.filters.push({ field, operator: 'gt', value })
    return this
  }

  gte(field, value) {
    this.query.filters.push({ field, operator: 'gte', value })
    return this
  }

  lt(field, value) {
    this.query.filters.push({ field, operator: 'lt', value })
    return this
  }

  lte(field, value) {
    this.query.filters.push({ field, operator: 'lte', value })
    return this
  }

  // case-insensitive substring match
  like(field, pattern) {
    this.query.filters.push({ field, operator: 'like', value: pattern })
    return this
  }

  /**
   * Sorts by a field, 'asc' or 'desc'. Null/empty values always sort last.
   * @returns {QueryBuilder}
   */
  order(field, direction = 'asc') {
    this.query.orderBy = field
    this.query.orderDirection = direction.toLowerCase()
    return this
  }

  /**
   * Caps the number of results.
   * @returns {QueryBuilder}
   */
  limit(count) {
    this.query.limitValue = count
    return this
  }

  /**
   * Runs the query against Google Sheets.
   * @returns {Promise<Array>} records
   */
  async execute() {
    if (!this.query.table) {
      throw new Error('You must specify a table with .from()')
    }

    if (this.cache) {
      const cacheKey = this.cache.generateKey(this.query.table, this.query)
      const cachedData = this.cache.get(cacheKey)
      if (cachedData !== undefined) {
        console.log(`Query served from cache: ${cachedData.length} results`)
        return cachedData
      }
    }

    let data = await this.connector.readSheet(this.query.table)

    data = this.applyFilters(data)
    data = this.applySelect(data)
    data = this.applyOrder(data)
    data = this.applyLimit(data)

    if (this.cache) {
      const cacheKey = this.cache.generateKey(this.query.table, this.query)
      this.cache.set(cacheKey, data)
    }

    console.log(`Query executed: ${data.length} results`)
    return data
  }

  /**
   * Makes the builder awaitable, so `await db.from('users').eq(...)` works without .execute().
   */
  then(resolve, reject) {
    return this.execute().then(resolve, reject)
  }

  // ─── internals ────────────────────────────────────────────────────────────

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
            console.warn(`Unknown operator: ${filter.operator}`)
            return true
        }
      })
    })
  }

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

  // numbers as Number, other values as string, null/empty/undefined as null
  normalizeForSort(record, field) {
    const value = record[field]
    if (value === null || value === undefined || value === '') {
      return null
    }
    const numeric = Number(value)
    return isNaN(numeric) ? String(value) : numeric
  }

  applyOrder(data) {
    if (!this.query.orderBy) return data

    const field = this.query.orderBy
    const direction = this.query.orderDirection

    return [...data].sort((a, b) => {
      const aVal = this.normalizeForSort(a, field)
      const bVal = this.normalizeForSort(b, field)

      // nulls always last, in both directions
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      let comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return direction === 'desc' ? -comparison : comparison
    })
  }

  applyLimit(data) {
    if (!this.query.limitValue) return data
    return data.slice(0, this.query.limitValue)
  }
}

export default QueryBuilder
