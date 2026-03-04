/**
 * SheetsBase Client
 * Google Sheets como base de datos con una API estilo Supabase
 *
 * @example
 * import { createClient } from '@sheetsbase/client'
 *
 * const db = createClient({
 *   serviceAccount: './credentials.json',
 *   spreadsheetId: 'abc123'
 * })
 *
 * const products = await db
 *   .from('products')
 *   .eq('status', 'active')
 *   .order('name')
 *   .limit(10)
 *   .execute()
 */

import { SheetsBaseClient } from './SheetsBaseClient.js'

/**
 * Crea una nueva instancia del cliente SheetsBase
 * @param {Object} config - configuracion
 * @param {string} config.serviceAccount - path al archivo credentials.json
 * @param {string} config.spreadsheetId - ID del spreadsheet de Google
 * @param {number} [config.cacheTtl=300] - TTL del cache en segundos
 * @param {boolean} [config.cache=true] - habilitar o deshabilitar el cache
 * @returns {SheetsBaseClient}
 */
export function createClient(config) {
  return new SheetsBaseClient(config)
}

export { SheetsBaseClient } from './SheetsBaseClient.js'