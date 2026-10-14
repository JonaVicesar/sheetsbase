import QueryBuilder from './QueryBuilder.js'
import SheetsConnector from './core/SheetsConnector.js'
import CacheManager from './core/Cache.js'
import IdGenerator from './core/IdGenerator.js'

/**
 * Cliente principal de SheetsBase
 * Conecta directamente con Google Sheets, sin servidor intermedio
 */
export class SheetsBaseClient {
  /**
   * Crea una nueva instancia del cliente
   * @param {Object} config - configuracion
   * @param {string} [config.serviceAccount] - path al archivo credentials.json
   *   (no requerido si se inyecta config.connector)
   * @param {string} [config.spreadsheetId] - ID del spreadsheet de Google
   * @param {Object} [config.connector] - conector ya construido (para tests o conectores custom)
   * @param {Object} [config.cacheManager] - CacheManager ya construido (compartir cache entre clientes)
   * @param {number} [config.cacheTtl=300] - TTL del cache en segundos
   * @param {boolean} [config.cache=true] - habilitar o deshabilitar el cache
   */
  constructor(config) {
    if (!config) {
      throw new Error('Se requiere un objeto de configuracion')
    }

    // permitir inyectar un conector ya construido (tests)
    if (config.connector) {
      this.connector = config.connector
    } else {
      if (!config.serviceAccount) {
        throw new Error('Se requiere config.serviceAccount (o config.connector)')
      }
      if (!config.spreadsheetId) {
        throw new Error('Se requiere config.spreadsheetId')
      }

      // inicializar conector con Google Sheets
      this.connector = new SheetsConnector(config.serviceAccount, config.spreadsheetId)
    }

    // inicializar cache (o usar uno inyectado)
    if (config.cacheManager) {
      this.cache = config.cacheManager
    } else {
      this.cache = new CacheManager({
        ttl: config.cacheTtl || 300,
        enabled: config.cache !== false
      })
    }

    console.log('SheetsBase Client inicializado')
  }

  /**
   * Inicia una query sobre una tabla especifica
   * @param {string} table - nombre de la tabla (hoja del spreadsheet)
   * @returns {QueryBuilder} instancia para encadenar metodos
   */
  from(table) {
    return new QueryBuilder(this.connector, this.cache).from(table)
  }

  /**
   * Inserta uno o varios registros en una tabla
   * @param {string} table - nombre de la tabla
   * @param {Object|Object[]} data - registro o array de registros
   * @param {Object} [options] - opciones adicionales
   * @param {Object} [options.idConfig] - configuracion del ID:
   *   { type: 'uuid'|'short'|'timestamp'|'readable', prefix: 'item', checkUniqueness: false }
   * @returns {Promise<Object>} registro insertado (o resumen con insertedIds si es array)
   */
  async insert(table, data, options = {}) {
    console.log(`Insertando en '${table}'`)

    // si es un array, insertar todos los registros en una sola llamada
    if (Array.isArray(data)) {
      return this._insertMany(table, data, options)
    }

    return this._insertOne(table, data, options)
  }

  /**
   * Actualiza un registro por ID
   * @param {string} table - nombre de la tabla
   * @param {string} id - ID del registro
   * @param {Object} data - campos a actualizar
   * @returns {Promise<Object>} registro actualizado
   */
  async update(table, id, data) {
    console.log(`Actualizando registro ${id} en '${table}'`)

    // buscar el registro
    const allRecords = await this.connector.readSheet(table)
    const recordIndex = allRecords.findIndex(record => String(record.id) === String(id))

    if (recordIndex === -1) {
      throw new Error(`No se encontro un registro con id=${id}`)
    }

    const rowNumber = recordIndex + 2 // +2 por el header y el indice base 0

    // combinar datos existentes con los nuevos
    const updatedData = {
      ...allRecords[recordIndex],
      ...data,
      updated_at: new Date().toISOString()
    }

    await this.connector.updateRow(table, rowNumber, updatedData)
    this.cache.invalidate(table)

    console.log(`Registro ${id} actualizado`)
    return { success: true, data: updatedData }
  }

  /**
   * Elimina un registro por ID
   * @param {string} table - nombre de la tabla
   * @param {string} id - ID del registro
   * @returns {Promise<Object>} confirmacion de eliminacion
   */
  async delete(table, id) {
    console.log(`Eliminando registro ${id} de '${table}'`)

    // buscar el registro
    const allRecords = await this.connector.readSheet(table)
    const recordIndex = allRecords.findIndex(record => String(record.id) === String(id))

    if (recordIndex === -1) {
      throw new Error(`No se encontro un registro con id=${id}`)
    }

    const rowNumber = recordIndex + 2

    await this.connector.deleteRow(table, rowNumber)
    this.cache.invalidate(table)

    console.log(`Registro ${id} eliminado`)
    return { success: true, id }
  }

  /**
   * Devuelve estadisticas del cache
   * @returns {Object} estadisticas
   */
  getCacheStats() {
    return this.cache.getStats()
  }

  /**
   * Limpia el cache de una tabla o de todo
   * @param {string} [table] - nombre de la tabla, si no se pasa limpia todo
   */
  clearCache(table) {
    if (table) {
      this.cache.invalidate(table)
    } else {
      this.cache.invalidateAll()
    }
  }

  // ─── metodos internos ────────────────────────────────────────────────────

  /**
   * Normaliza las opciones de ID
   * @param {Object} options - opciones pasadas a insert()
   * @returns {{type: string, prefix: string, checkUniqueness: boolean}}
   */
  _idOptions(options = {}) {
    return {
      type: options.idConfig?.type || 'uuid',
      prefix: options.idConfig?.prefix || 'item',
      // por defecto no se lee la hoja para verificar unicidad (los IDs son seguros sin eso)
      checkUniqueness: options.idConfig?.checkUniqueness === true
    }
  }

  /**
   * Inserta un unico registro en una tabla
   * @param {string} table - nombre de la tabla
   * @param {Object} data - datos a insertar
   * @param {Object} options - opciones
   * @returns {Promise<Object>} registro insertado
   */
  async _insertOne(table, data, options = {}) {
    const { type, prefix, checkUniqueness } = this._idOptions(options)

    // copia para no mutar el objeto del caller
    const row = { ...data }

    // generar ID si no tiene
    if (!row.id) {
      const existingRecords = checkUniqueness
        ? await this.connector.readSheet(table)
        : []
      row.id = IdGenerator.generateUniqueId(existingRecords, type, prefix)
    }

    // agregar timestamp
    if (!row.created_at) {
      row.created_at = new Date().toISOString()
    }

    await this.connector.appendRow(table, row)
    this.cache.invalidate(table)

    return { success: true, data: row }
  }

  /**
   * Inserta varios registros en una sola llamada al conector
   * @param {string} table - nombre de la tabla
   * @param {Object[]} records - registros a insertar
   * @param {Object} options - opciones
   * @returns {Promise<Object>} resumen con los IDs insertados
   */
  async _insertMany(table, records, options = {}) {
    const { type, prefix, checkUniqueness } = this._idOptions(options)

    // una sola lectura de la hoja, y solo si algun registro necesita ID verificado
    const needsGeneratedId = records.some(record => !record.id)
    const existingRecords = (checkUniqueness && needsGeneratedId)
      ? await this.connector.readSheet(table)
      : []

    const rows = []
    for (const record of records) {
      const row = { ...record }

      if (!row.id) {
        row.id = IdGenerator.generateUniqueId(existingRecords, type, prefix)
        // evita colisiones entre los registros del mismo batch
        existingRecords.push(row)
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