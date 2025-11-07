import { google } from 'googleapis'
import fs from 'fs'


/**
 * Conecta con Google Sheets
 * Esta clase es para manejar todo la comunciacion con Google Sheets
 */
class SheetsConnector {
  constructor(serviceAccountPath, spreadsheetId) {
    console.log('Constructor recibio:')
    console.log('  serviceAccountPath:', serviceAccountPath)
    console.log('  spreadsheetId:', spreadsheetId)

    this.spreadsheetId = spreadsheetId //guarda la configuracion
    
    if (!serviceAccountPath) { //verifica que el path no sea null 
      throw new Error('serviceAccountPath es undefined o null')
    }
    
    console.log('leyendo el archivo:', serviceAccountPath)
    const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) //leer el archivo con las credenciales
    
    
    const auth = new google.auth.GoogleAuth({ //crea cliente de autenticacion
       credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Permiso para leer Y escribir
    })
    
    // crear cliente de sheets
    this.sheets = google.sheets({
      version: 'v4',
      auth: auth
    })
    
    console.log('inicializado con el Service Account')
  }

  /**
   * Lee todos los datos de una hoja especifica
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Promise<Array>} Array de objetos con los datos
   */
  async readSheet(sheetName) {
    try {
      console.log(`leyendo hoja: ${sheetName}`)

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`, //lee todas las columnas
      })

      // obtener los datos
      const rows = response.data.values
      
      if (!rows || rows.length === 0) {
        console.log(`⚠️  Hoja '${sheetName}' está vacía`)
        return []
      }

      
      const headers = rows[0] // la primera fila son para los header
      const data = rows.slice(1)
      
      // convertir a array de objetos
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
   * Escribe datos en la hoja, grega una nueva fila al final de la hoja
   * @param {string} sheetName - Nombre de la hoja
   * @param {Object} data - Objeto con los datos a insertar
   */
  async appendRow(sheetName, data) {
    try {
      console.log(` Agregando fila '${sheetName}':`, data)

      const headers = await this.getHeaders(sheetName)
      const values = headers.map(header => data[header] || '')

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        resource: {
          values: [values]
        }
      })

      console.log(`fila agregada correctamente '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error agregando fila '${sheetName}':`, error.message)
      throw error
    }
  }
  /**
   * Actualiza una fila basándose en el número de fila
   * @param {string} sheetName - Nombre de la hoja
   * @param {number} rowNumber - Número de fila (2, 3, 4, etc.)
   * @param {Object} data - Datos a actualizar
   */
  async updateRow(sheetName, rowNumber, data) {
    try {
      console.log(`actualizando fila ${rowNumber} en '${sheetName}'`)
      const headers = await this.getHeaders(sheetName)
      const values = headers.map(header => data[header] !== undefined ? data[header] : '')

      const response = await this.sheets.spreadsheets.values.update({ //actualizar la fila
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
        valueInputOption: 'RAW',
        resource: {
          values: [values]
        }
      })

      console.log(`Fila ${rowNumber} actualizada '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error actualizando  la fila:`, error.message)
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
        range: `${sheetName}!1:1`, // solo la primera fila
      })

      const headers = response.data.values ? response.data.values[0] : []
      return headers

    } catch (error) {
      console.error(`❌ Error obteniendo headers:`, error.message)
      throw error
    }
  }

  /**
   * Elimina una fila 
   * @param {string} sheetName - Nombre de la hoja
   * @param {number} rowNumber - Número de fila a vaciar
   */
  async deleteRow(sheetName, rowNumber) {
    try {
      console.log(`Eliminando fila ${rowNumber} de '${sheetName}'`)

      const headers = await this.getHeaders(sheetName)
      const emptyValues = headers.map(() => '')

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
        valueInputOption: 'RAW',
        resource: {
          values: [emptyValues]
        }
      })

      console.log(`Fila ${rowNumber} eliminada de '${sheetName}'`)

    } catch (error) {
      console.error(`Error eliminando fila:`, error.message)
      throw error
    }
  }
}

export default SheetsConnector