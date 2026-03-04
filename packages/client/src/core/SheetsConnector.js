import { google } from 'googleapis'
import fs from 'fs'

/**
 * Conecta con Google Sheets
 * Esta clase es para manejar toda la comunicacion con Google Sheets
 */
class SheetsConnector {
  constructor(serviceAccountPath, spreadsheetId) {
    this.spreadsheetId = spreadsheetId

    if (!serviceAccountPath) {
      throw new Error('serviceAccountPath es undefined o null')
    }

    if (!spreadsheetId) {
      throw new Error('spreadsheetId es undefined o null')
    }

    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    this.sheets = google.sheets({ version: 'v4', auth })

    console.log('SheetsConnector inicializado')
  }

  /**
   * Lee todos los datos de una hoja especifica
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Promise<Array>} Array de objetos con los datos
   */
  async readSheet(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
      })

      const rows = response.data.values

      if (!rows || rows.length === 0) {
        return []
      }

      const headers = rows[0]
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
      const values = headers.map(header => data[header] || '')

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
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
   * Actualiza una fila por numero de fila
   * @param {string} sheetName - Nombre de la hoja
   * @param {number} rowNumber - Numero de fila (2, 3, 4...)
   * @param {Object} data - Datos a actualizar
   */
  async updateRow(sheetName, rowNumber, data) {
    try {
      const headers = await this.getHeaders(sheetName)
      const values = headers.map(header => data[header] !== undefined ? data[header] : '')

      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
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
   * Vacia una fila (eliminar registro)
   * @param {string} sheetName - Nombre de la hoja
   * @param {number} rowNumber - Numero de fila a vaciar
   */
  async deleteRow(sheetName, rowNumber) {
    try {
      const headers = await this.getHeaders(sheetName)
      const emptyValues = headers.map(() => '')

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
        valueInputOption: 'RAW',
        resource: { values: [emptyValues] }
      })

      console.log(`Fila ${rowNumber} eliminada de '${sheetName}'`)

    } catch (error) {
      console.error(`Error eliminando fila:`, error.message)
      throw error
    }
  }

  /**
   * Obtiene los headers de una hoja
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Promise<Array>} Array con los nombres de las columnas
   */
  async getHeaders(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!1:1`,
      })

      return response.data.values ? response.data.values[0] : []

    } catch (error) {
      console.error(`Error obteniendo headers:`, error.message)
      throw error
    }
  }
}

export default SheetsConnector