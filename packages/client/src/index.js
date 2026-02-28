/**
 * SheetsBase Client SDK
 * Google Sheets como base de datos con una API estilo Supabase
 */

import { SheetsBaseClient } from './SheetsBaseClient.js'
import { QueryBuilder } from './QueryBuilder.js'

/**
 * Crea una nueva instancia del cliente SheetsBase
 * @param {Object} config - Configuracion
 * @param {string} config.apiUrl - URL del servidor SheetsBase
 * @param {string} [config.apiKey] - API key opcional para autenticacion
 * @returns {SheetsBaseClient}
 */
export function createClient(config) {
  return new SheetsBaseClient(config)
}

export { SheetsBaseClient } from './SheetsBaseClient.js'
export { QueryBuilder } from './QueryBuilder.js'