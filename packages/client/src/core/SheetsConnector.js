import { google } from 'googleapis'
import fs from 'fs'

/**
 * Converts a 1-based column index to a letter: 1 -> 'A', 27 -> 'AA'
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
 * Resolves service-account credentials from an object, an inline JSON string,
 * a file path, or the name of an env var holding the JSON.
 * @param {Object|string} serviceAccount
 * @returns {Object} parsed credentials
 */
function resolveCredentials(serviceAccount) {
  if (serviceAccount && typeof serviceAccount === 'object') {
    return serviceAccount
  }

  if (typeof serviceAccount !== 'string' || serviceAccount.length === 0) {
    throw new Error('serviceAccount must be a credentials object, a file path, an env-var name, or a JSON string')
  }

  if (serviceAccount.trim().startsWith('{')) {
    return JSON.parse(serviceAccount)
  }

  if (fs.existsSync(serviceAccount)) {
    return JSON.parse(fs.readFileSync(serviceAccount, 'utf8'))
  }

  const fromEnv = process.env[serviceAccount]
  if (fromEnv) {
    return JSON.parse(fromEnv)
  }

  throw new Error(`serviceAccount could not be resolved: '${serviceAccount}' is not a credentials object, JSON, existing file, or env var`)
}

/**
 * Handles all communication with Google Sheets.
 */
class SheetsConnector {
  /**
   * @param {Object|string} [serviceAccount] - credentials object, path to the service-account JSON,
   *   env-var name holding the JSON, or the JSON string itself (not required when a `sheets` client is injected)
   * @param {string} spreadsheetId - Google spreadsheet ID
   * @param {Object} [options]
   * @param {Object} [options.sheets] - pre-built sheets client (tests)
   */
  constructor(serviceAccountPath, spreadsheetId, options = {}) {
    this.spreadsheetId = spreadsheetId

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is undefined or null')
    }

    if (options && options.sheets) {
      this.sheets = options.sheets
    } else {
      if (!serviceAccountPath) {
        throw new Error('serviceAccountPath is undefined or null')
      }

      this.credentials = resolveCredentials(serviceAccountPath)

      const auth = new google.auth.GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })

      this.sheets = google.sheets({ version: 'v4', auth })
    }

    // memoized lookups, avoid repeated API calls
    this._headersCache = new Map()
    this._sheetIdCache = new Map()

    console.log('SheetsConnector initialized')
  }

  /**
   * Reads every row of a sheet as objects. Empty cells become null.
   * @param {string} sheetName
   * @returns {Promise<Array>}
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

      console.log(`${records.length} records read from '${sheetName}'`)
      return records

    } catch (error) {
      console.error(`Error reading sheet '${sheetName}':`, error.message)
      throw error
    }
  }

  /**
   * Appends one row at the end of the sheet.
   * @param {string} sheetName
   * @param {Object} data
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

      console.log(`Row appended to '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error appending row to '${sheetName}':`, error.message)
      throw error
    }
  }

  /**
   * Appends several rows in a single API call.
   * @param {string} sheetName
   * @param {Object[]} rows
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

      console.log(`${values.length} rows appended to '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error appending rows to '${sheetName}':`, error.message)
      throw error
    }
  }

  /**
   * Rewrites one row by its row number.
   * @param {string} sheetName
   * @param {number} rowNumber - 2, 3, 4...
   * @param {Object} data
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

      console.log(`Row ${rowNumber} updated in '${sheetName}'`)
      return response.data

    } catch (error) {
      console.error(`Error updating row:`, error.message)
      throw error
    }
  }

  /**
   * Removes a row from the sheet entirely (rows below shift up).
   * @param {string} sheetName
   * @param {number} rowNumber - 2, 3, 4...
   */
  async deleteRow(sheetName, rowNumber) {
    try {
      const sheetId = await this.getSheetId(sheetName)

      // deleteDimension is 0-based: row 2 => startIndex 1
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

      console.log(`Row ${rowNumber} deleted from '${sheetName}'`)

    } catch (error) {
      console.error(`Error deleting row:`, error.message)
      throw error
    }
  }

  /**
   * Numeric sheet ID, needed for batchUpdate.
   * @param {string} sheetName
   * @returns {Promise<number>}
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
      throw new Error(`Sheet '${sheetName}' not found`)
    }

    const sheetId = sheet.properties.sheetId
    this._sheetIdCache.set(sheetName, sheetId)
    return sheetId
  }

  /**
   * Row 1 of the sheet (memoized).
   * @param {string} sheetName
   * @returns {Promise<Array>} column names
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
      console.error(`Error reading headers:`, error.message)
      throw error
    }
  }

  /**
   * Drops the memoized headers and sheetIds (use when columns change).
   */
  clearCache() {
    this._headersCache.clear()
    this._sheetIdCache.clear()
    console.log('Headers cache cleared')
  }
}

export default SheetsConnector
