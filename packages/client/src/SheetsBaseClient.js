/**
 * Maneja la comunicacion HTTP con el servidor SheetsBase
 * Esta clase es para manejar todo el CRUD y crear instancias del QueryBuilder
 */

import { QueryBuilder } from './QueryBuilder.js'

export class SheetsBaseClient {
  /**
   * Crea una nueva instancia del cliente
   * @param {Object} config - Configuracion
   * @param {string} config.apiUrl - URL base del servidor SheetsBase
   * @param {string} [config.apiKey] - API key opcional para autenticacion
   */
  constructor(config) {
    if (!config || !config.apiUrl) {
      throw new Error('Se requiere config.apiUrl')
    }

    this.apiUrl = config.apiUrl.replace(/\/$/, '') // eliminar slash final
    this.apiKey = config.apiKey || null

    console.log(' SheetsBase Client inicializado')
    console.log('   API URL:', this.apiUrl)
  }

  /**
   * Inicia una query sobre una tabla especifica
   * @param {string} table - Nombre de la tabla
   * @returns {QueryBuilder} instancia para encadenar metodos
   */
  from(table) {
    return new QueryBuilder(this, table)
  }

  /**
   * Inserta uno o varios registros en una tabla
   * @param {string} table - Nombre de la tabla
   * @param {Object|Object[]} data - Registro o array de registros a insertar
   * @param {Object} [options] - Opciones adicionales
   * @param {Object} [options.idConfig] - Configuracion para la generacion del ID
   * @returns {Promise<Object>} Respuesta del servidor con el registro insertado
   */
  async insert(table, data, options = {}) {
    console.log(`Insertando en '${table}':`, data)

    // si data es un array, insertar cada registro por separado
    if (Array.isArray(data)) {
      const results = []
      for (const record of data) {
        const result = await this.request('/api/insert', {
          method: 'POST',
          body: JSON.stringify({
            table,
            data: record,
            idConfig: options.idConfig
          })
        })
        results.push(result)
      }
      return {
        success: true,
        count: results.length,
        insertedIds: results.map(r => r.data?.id)
      }
    }

    // insertar registro unico
    const result = await this.request('/api/insert', {
      method: 'POST',
      body: JSON.stringify({
        table,
        data,
        idConfig: options.idConfig
      })
    })

    console.log(`Registro insertado con ID: ${result.data?.id}`)
    return result
  }

  /**
   * Actualiza un registro por ID
   * @param {string} table - Nombre de la tabla
   * @param {string} id - ID del registro
   * @param {Object} data - Campos a actualizar
   * @returns {Promise<Object>} Respuesta del servidor
   */
  async update(table, id, data) {
    console.log(`Actualizando registro ${id} en '${table}':`, data)

    const result = await this.request('/api/update', {
      method: 'PUT',
      body: JSON.stringify({ table, id, data })
    })

    console.log('Registro actualizado')
    return result
  }

  /**
   * Elimina un registro por ID
   * @param {string} table - Nombre de la tabla
   * @param {string} id - ID del registro
   * @returns {Promise<Object>} Respuesta del servidor
   */
  async delete(table, id) {
    console.log(`🗑️ Eliminando registro ${id} de '${table}'`)

    const result = await this.request('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({ table, id })
    })

    console.log('Registro eliminado')
    return result
  }

  /**
   * Realiza una peticion HTTP al servidor
   * @param {string} endpoint - Ruta del endpoint
   * @param {Object} [options] - Opciones de fetch
   * @returns {Promise<Object>} Respuesta parseada como JSON
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    // agregar api key si esta configurada
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      })

      const data = await response.json()

      // verificar errores en la respuesta
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error: ${response.statusText}`)
      }

      return data

    } catch (error) {
      console.error('Error en request:', error.message)
      throw error
    }
  }
}