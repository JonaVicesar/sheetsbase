import QueryBuilder from './QueryBuilder.js'
import SheetsConnector from './core/SheetsConnector.js'
import CacheManager from './core/Cache.js'
import IdGenerator from './core/IdGenerator.js'

/**
 * Query client for Google Sheets. Talks to the Sheets API directly — no server needed.
 */
export class SheetsBaseClient {
  /**
   * @param {Object} config
   * @param {Object|string} [config.serviceAccount] - credentials object, path to the service-account JSON,
   *   env-var name holding the JSON, or the JSON string itself
   *   (not required when config.connector is injected)
   * @param {string} [config.spreadsheetId] - Google spreadsheet ID
   * @param {Object} [config.connector] - pre-built connector (tests or custom transports)
   * @param {Object} [config.cacheManager] - pre-built CacheManager (share a cache between clients)
   * @param {number} [config.cacheTtl=300] - cache TTL in seconds
   * @param {boolean} [config.cache=true] - enable or disable the cache
   */
  constructor(config) {
    if (!config) {
      throw new Error('A config object is required')
    }

    if (config.connector) {
      this.connector = config.connector
    } else {
      if (!config.serviceAccount) {
        throw new Error('config.serviceAccount is required (or config.connector)')
      }
      if (!config.spreadsheetId) {
        throw new Error('config.spreadsheetId is required')
      }

      this.connector = new SheetsConnector(config.serviceAccount, config.spreadsheetId)
    }

    this.cache = config.cacheManager || new CacheManager({
      ttl: config.cacheTtl || 300,
      enabled: config.cache !== false
    })

    console.log('SheetsBase client initialized')
  }

  /**
   * Starts a chainable query on a table.
   * @param {string} table - sheet name
   * @returns {QueryBuilder}
   */
  from(table) {
    return new QueryBuilder(this.connector, this.cache).from(table)
  }

  /**
   * Inserts one record, or an array of records batched into a single call.
   * @param {string} table
   * @param {Object|Object[]} data
   * @param {Object} [options]
   * @param {Object} [options.idConfig] - { type: 'uuid'|'short'|'timestamp'|'readable', prefix: 'item', checkUniqueness: false }
   * @returns {Promise<Object>} the inserted record, or { count, insertedIds } for arrays
   */
  async insert(table, data, options = {}) {
    console.log(`Inserting into '${table}'`)

    if (Array.isArray(data)) {
      return this._insertMany(table, data, options)
    }

    return this._insertOne(table, data, options)
  }

  /**
   * Updates a record by ID (merges fields, sets updated_at).
   * @returns {Promise<Object>} { success, data }
   */
  async update(table, id, data) {
    console.log(`Updating record ${id} in '${table}'`)

    const allRecords = await this.connector.readSheet(table)
    const recordIndex = allRecords.findIndex(record => String(record.id) === String(id))

    if (recordIndex === -1) {
      throw new Error(`No record found with id=${id}`)
    }

    const rowNumber = recordIndex + 2 // +2: header row and 0-based index

    const updatedData = {
      ...allRecords[recordIndex],
      ...data,
      updated_at: new Date().toISOString()
    }

    await this.connector.updateRow(table, rowNumber, updatedData)
    this.cache.invalidate(table)

    console.log(`Record ${id} updated`)
    return { success: true, data: updatedData }
  }

  /**
   * Deletes a record by ID (the row is removed).
   * @returns {Promise<Object>} { success, id }
   */
  async delete(table, id) {
    console.log(`Deleting record ${id} from '${table}'`)

    const allRecords = await this.connector.readSheet(table)
    const recordIndex = allRecords.findIndex(record => String(record.id) === String(id))

    if (recordIndex === -1) {
      throw new Error(`No record found with id=${id}`)
    }

    const rowNumber = recordIndex + 2

    await this.connector.deleteRow(table, rowNumber)
    this.cache.invalidate(table)

    console.log(`Record ${id} deleted`)
    return { success: true, id }
  }

  getCacheStats() {
    return this.cache.getStats()
  }

  clearCache(table) {
    if (table) {
      this.cache.invalidate(table)
    } else {
      this.cache.invalidateAll()
    }
  }

  // ─── internals ────────────────────────────────────────────────────────────

  _idOptions(options = {}) {
    return {
      type: options.idConfig?.type || 'uuid',
      prefix: options.idConfig?.prefix || 'item',
      // skipped by default: generated IDs are collision-safe without reading the sheet
      checkUniqueness: options.idConfig?.checkUniqueness === true
    }
  }

  async _insertOne(table, data, options = {}) {
    const { type, prefix, checkUniqueness } = this._idOptions(options)
    const row = { ...data } // never mutate the caller's object

    if (!row.id) {
      const existingRecords = checkUniqueness ? await this.connector.readSheet(table) : []
      row.id = IdGenerator.generateUniqueId(existingRecords, type, prefix)
    }

    if (!row.created_at) {
      row.created_at = new Date().toISOString()
    }

    await this.connector.appendRow(table, row)
    this.cache.invalidate(table)

    return { success: true, data: row }
  }

  async _insertMany(table, records, options = {}) {
    const { type, prefix, checkUniqueness } = this._idOptions(options)

    // at most one sheet read, and only when a generated ID needs verification
    const needsGeneratedId = records.some(record => !record.id)
    const existingRecords = (checkUniqueness && needsGeneratedId)
      ? await this.connector.readSheet(table)
      : []

    const rows = []
    for (const record of records) {
      const row = { ...record }

      if (!row.id) {
        row.id = IdGenerator.generateUniqueId(existingRecords, type, prefix)
        existingRecords.push(row) // dedupe within the batch
      }

      if (!row.created_at) {
        row.created_at = new Date().toISOString()
      }

      rows.push(row)
    }

    await this.connector.appendRows(table, rows)
    this.cache.invalidate(table)

    return {
      success: true,
      count: rows.length,
      insertedIds: rows.map(r => r.id)
    }
  }
}
