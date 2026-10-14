import { google } from 'googleapis'
import fs from 'fs'

/**
 * Convierte un indice de columna (1-based) a letra: 1 -> 'A', 27 -> 'AA'
 * @param {number} index
 * @returns {string}
 */
function columnLetter(index) {
  let letter = ''
  let n = index
  while (n > 0) {
    const remainder = (n - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

/**
 * Conecta con Google Sheets
 * Esta clase es para manejar toda la comunicacion con Google Sheets
 */
class SheetsConnector {
  /**
   * @param {string} [serviceAccountPath] - path al archivo credentials.json
   *   (no requerido si se inyecta un cliente `sheets`)
   * @param {string} spreadsheetId - ID del spreadsheet de Google
   * @param {Object} [options] - opciones
   * @param {Object} [options.sheets] - cliente de sheets ya construido (para tests)
   */
  constructor(serviceAccountPath, spreadsheetId, options = {}) {
    this.spreadsheetId = spreadsheetId

    if (!spreadsheetId) {
      throw new Error('spreadsheetId es undefined o null')
    }

    // permitir inyectar un cliente ya construido (tests)
    if (options && options.sheets) {
      this.sheets = options.sheets
    } else {
      if (!serviceAccountPath) {
        throw new Error('serviceAccountPath es undefined o null')
      }

      const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })

      this.sheets = google.sheets({ version: 'v4', auth })
    }

    // cache en memoria de headers y sheetIds (evitan llamadas repetidas a la API)
    this._headersCache = new Map()
    this._sheetIdCache = new Map()

    console.log('SheetsConnector inicializado')
  }

  /**
   * Lee todos los datos de una hoja especifica
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Promise<Array>} Array de objetos con los datos
   */
  async readSheet(sheetName) {
    try {
      const headers = await this.getHeaders(sheetName)
      const lastColumn = headers.length > 0 ? columnLetter(headers.length) : 'Z'
      const range = `${sheetName}!A:${lastColumn}`

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      })

      const rows = response.data.values

      if (!rows || rows.length === 0) {
        return []
      }

      const data = rows.slice(1)

      const records = data.map(row => {
        const record = {}
        headers.forEach((header, index) => {
          record[header] = row[index] || null
        })
        return record
      })

      console.log(`${records.length} registros leidos de '${sheetName}'`)
      return records

    } catch (error) {
      console.error(`Error leyendo la hoja '${sheetName}':`, error.message)
      throw error
    }
  }

  /**
   * Agrega una nueva fila al final de la hoja
   * @param {string} sheetName - Nombre de la hoja
   * @param {Object} data - Objeto con los datos a insertar
   */
  async appendRow(sheetName, data) {
    try {
      const headers = await this.getHeaders(sheetName)
      const lastColumn = headers.length > 0 ? columnLetter(headers.length) : 'Z'
      const values = headers.map(header => (data[header] === undefined ? '' : data[header]))

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:${lastColumn}`,
        valueInputOption: 'RAW',
        resource: { values: [values] }
      })

      console.log(`Fila agregada en '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error agregando fila en '${sheetName}':`, error.message)
      throw error
    }
  }

  /**
   * Agrega varias filas nuevas al final de la hoja en una sola llamada
   * @param {string} sheetName - Nombre de la hoja
   * @param {Object[]} rows - Array de objetos con los datos a insertar
   */
  async appendRows(sheetName, rows) {
    try {
      const headers = await this.getHeaders(sheetName)
      const lastColumn = headers.length > 0 ? columnLetter(headers.length) : 'Z'
      const values = rows.map(row => headers.map(header => (row[header] === undefined ? '' : row[header])))

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:${lastColumn}`,
        valueInputOption: 'RAW',
        resource: { values: values }
      })

      console.log(`${values.length} filas agregadas en '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error agregando filas en '${sheetName}':`, error.message)
      throw error
    }
  }

  /**
   * Actualiza una fila por numero de fila
   * @param {string} sheetName - Nombre de la hoja
   * @param {number} rowNumber - Numero de fila (2, 3, 4...)
   * @param {Object} data - Datos a actualizar
   */
  async updateRow(sheetName, rowNumber, data) {
    try {
      const headers = await this.getHeaders(sheetName)
      const lastColumn = headers.length > 0 ? columnLetter(headers.length) : 'Z'
      const values = headers.map(header => data[header] !== undefined ? data[header] : '')

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`,
        valueInputOption: 'RAW',
        resource: { values: [values] }
      })

      console.log(`Fila ${rowNumber} actualizada en '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error actualizando fila:`, error.message)
      throw error
    }
  }

  /**
   * Elimina una fila completa de la hoja (la fila se borra, no se vacia)
   * @param {string} sheetName - Nombre de la hoja
   * @param {number} rowNumber - Numero de fila (2, 3, 4...)
   */
  async deleteRow(sheetName, rowNumber) {
    try {
      const sheetId = await this.getSheetId(sheetName)

      // deleteDimension usa indices 0-based: fila 2 => startIndex 1
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber
                }
              }
            }
          ]
        }
      })

      console.log(`Fila ${rowNumber} eliminada de '${sheetName}'`)

    } catch (error) {
      console.error(`Error eliminando fila:`, error.message)
      throw error
    }
  }

  /**
   * Obtiene el ID numerico de la hoja (necesario para batchUpdate)
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Promise<number>} ID de la hoja
   */
  async getSheetId(sheetName) {
    const cached = this._sheetIdCache.get(sheetName)
    if (cached !== undefined) {
      return cached
    }

    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties'
    })

    const sheet = (response.data.sheets || []).find(
      s => s.properties && s.properties.title === sheetName
    )

    if (!sheet) {
      throw new Error(`No se encontro la hoja '${sheetName}'`)
    }

    const sheetId = sheet.properties.sheetId
    this._sheetIdCache.set(sheetName, sheetId)
    return sheetId
  }

  /**
   * Obtiene los headers de una hoja (con cache en memoria)
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Promise<Array>} Array con los nombres de las columnas
   */
  async getHeaders(sheetName) {
    const cached = this._headersCache.get(sheetName)
    if (cached !== undefined) {
      return cached
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!1:1`,
      })

      const headers = response.data.values ? response.data.values[0] : []
      this._headersCache.set(sheetName, headers)
      return headers

    } catch (error) {
      console.error(`Error obteniendo headers:`, error.message)
      throw error
    }
  }

  /**
   * Limpia el cache de headers y sheetIds (util si se modifican las columnas)
   */
  clearCache() {
    this._headersCache.clear()
    this._sheetIdCache.clear()
    console.log('Cache de headers limpiado')
  }
}

export default SheetsConnector
