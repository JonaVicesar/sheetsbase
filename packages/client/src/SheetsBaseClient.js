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
   * @param {string} config.serviceAccount - path al archivo credentials.json
   * @param {string} config.spreadsheetId - ID del spreadsheet de Google
   * @param {number} [config.cacheTtl=300] - TTL del cache en segundos
   * @param {boolean} [config.cache=true] - habilitar o deshabilitar el cache
   */
  constructor(config) {
    if (!config || !config.serviceAccount) {
      throw new Error('Se requiere config.serviceAccount')
    }
    if (!config.spreadsheetId) {
      throw new Error('Se requiere config.spreadsheetId')
    }

    // inicializar conector con Google Sheets
    this.connector = new SheetsConnector(config.serviceAccount, config.spreadsheetId)

    // inicializar cache
    this.cache = new CacheManager({
      ttl: config.cacheTtl || 300,
      enabled: config.cache !== false
    })

    console.log('SheetsBase Client inicializado')
    console.log(`   Spreadsheet: ${config.spreadsheetId}`)
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
   * @param {Object} [options.idConfig] - configuracion del ID: { type: 'uuid'|'short'|'timestamp'|'readable', prefix: 'item' }
   * @returns {Promise<Object>} registro insertado con ID generado
   */
  async insert(table, data, options = {}) {
    console.log(`Insertando en '${table}'`)

    // si es un array, insertar cada registro por separado
    if (Array.isArray(data)) {
      const results = []
      for (const record of data) {
        const result = await this._insertOne(table, record, options)
        results.push(result)
      }
      return {
        success: true,
        count: results.length,
        insertedIds: results.map(r => r.data.id)
      }
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
    const recordIndex = allRecords.findIndex(record => record.id == id)

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
    const recordIndex = allRecords.findIndex(record => record.id == id)

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
   * Inserta un unico registro en una tabla
   * @param {string} table - nombre de la tabla
   * @param {Object} data - datos a insertar
   * @param {Object} options - opciones
   * @returns {Promise<Object>} registro insertado
   */
  async _insertOne(table, data, options = {}) {
    // generar ID si no tiene
    if (!data.id) {
      const existingRecords = await this.connector.readSheet(table)
      const type = options.idConfig?.type || 'uuid'
      const prefix = options.idConfig?.prefix || 'item'
      data.id = IdGenerator.generateUniqueId(existingRecords, type, prefix)
    }

    // agregar timestamp
    if (!data.created_at) {
      data.created_at = new Date().toISOString()
    }

    await this.connector.appendRow(table, data)
    this.cache.invalidate(table)

    return { success: true, data }
  }
}