/**
 * SheetsBase — use Google Sheets as a database with a Supabase-like API.
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
 * Creates a SheetsBase client. Config options: see `SheetsBaseClient`.
 * @param {Object} config
 * @returns {SheetsBaseClient}
 */
export function createClient(config) {
  return new SheetsBaseClient(config)
}

export { SheetsBaseClient } from './SheetsBaseClient.js'