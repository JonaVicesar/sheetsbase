// clase principal del cliente sheetsbase
class SheetsBaseClient {
  constructor(config) {
    // validar configuracion
    if (!config || !config.apiUrl) {
      throw new Error('Se requiere config.apiUrl')
    }

    this.apiUrl = config.apiUrl.replace(/\/$/, '') // quitar / al final
    this.apiKey = config.apiKey || null // para autenticacion futura
    
    console.log('SheetsBase Client inicializado')
    console.log(' API URL:', this.apiUrl)
  }

  // inicia una query especificando la tabla
  from(table) {
    return new QueryBuilder(this, table)
  }

  // inserta un nuevo registro en una tabla
  async insert(table, data, options = {}) {
    console.log(`Insertando en '${table}':`, data)

    // si es un array, insertar cada uno
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
      return { success: true, count: results.length, insertedIds: results.map(r => r.id) }
    }

    // si es un objeto, insertar uno
    const result = await this.request('/api/insert', {
      method: 'POST',
      body: JSON.stringify({ 
        table, 
        data,
        idConfig: options.idConfig
      })
    })

    console.log(`Registro insertado con ID: ${result.id}`)
    return result
  }

  // actualiza un registro por ID
  async update(table, id, data) {
    console.log(`Actualizando registro ${id} en '${table}':`, data)

    const result = await this.request('/api/update', {
      method: 'PUT',
      body: JSON.stringify({ table, id, data })
    })

    console.log('Registro actualizado')
    return result
  }

  // elimina un registro por ID
  async delete(table, id) {
    console.log(`Eliminando registro ${id} de '${table}'`)

    const result = await this.request('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({ table, id })
    })

    console.log('Registro eliminado')
    return result
  }

  // metodo interno para hacer requests HTTP
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`
    
    // headers por defecto
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    // agregar api key si existe
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      })

      const data = await response.json()

      // si el servidor respondio con error
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error en la peticion')
      }

      return data

    } catch (error) {
      console.error(' Error en request:', error.message)
      throw error
    }
  }
}

// constructor de queries en el cliente
class QueryBuilder {
  constructor(client, table) {
    this.client = client
    this.query = {
      table: table,
      select: '*',
      filters: [],
      order: null,
      limit: null
    }
  }

  // especifica que columnas seleccionar
  select(columns) {
    this.query.select = columns
    return this
  }

  // metodos de filtros
  eq(field, value) {
    this.query.filters.push({ field, op: 'eq', value })
    return this
  }

  neq(field, value) {
    this.query.filters.push({ field, op: 'neq', value })
    return this
  }

  gt(field, value) {
    this.query.filters.push({ field, op: 'gt', value })
    return this
  }

  gte(field, value) {
    this.query.filters.push({ field, op: 'gte', value })
    return this
  }

  lt(field, value) {
    this.query.filters.push({ field, op: 'lt', value })
    return this
  }

  lte(field, value) {
    this.query.filters.push({ field, op: 'lte', value })
    return this
  }

  like(field, pattern) {
    this.query.filters.push({ field, op: 'like', value: pattern })
    return this
  }

  // ordena los resultados
  order(field, direction = 'asc') {
    this.query.order = { field, direction }
    return this
  }

  // limita la cantidad de resultados
  limit(count) {
    this.query.limit = count
    return this
  }

  // ejecuta la query y devuelve resultados
  async execute() {
    console.log('Ejecutando query:', this.query)

    const response = await this.client.request('/api/query', {
      method: 'POST',
      body: JSON.stringify(this.query)
    })

    console.log(`Query ejecutada: ${response.count} resultados`)
    return response.data
  }

  // alias then() para poder usar await directamente
  then(resolve, reject) {
    return this.execute().then(resolve, reject)
  }
}

// operaciones crud directas (sin query builder)
class TableOperations {
  constructor(client, table) {
    this.client = client
    this.tableName = table
  }

  // insertar registro
  async insert(data) {
    console.log(`Insertando en '${this.tableName}':`, data)

    const response = await this.client.request('/api/insert', {
      method: 'POST',
      body: JSON.stringify({
        table: this.tableName,
        data: data
      })
    })

    console.log('Registro insertado')
    return response
  }

  // actualizar registro
  async update(id, data) {
    console.log(`Actualizando registro ${id} en '${this.tableName}':`, data)

    const response = await this.client.request('/api/update', {
      method: 'PUT',
      body: JSON.stringify({
        table: this.tableName,
        id: id,
        data: data
      })
    })

    console.log('Registro actualizado')
    return response
  }

  // eliminar registro
  async delete(id) {
    console.log(`Eliminando registro ${id} de '${this.tableName}'`)

    const response = await this.client.request('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({
        table: this.tableName,
        id: id
      })
    })

    console.log('Registro eliminado')
    return response
  }
}

// crea una instancia del cliente sheetsbase
export function createClient(config) {
  return new SheetsBaseClient(config)
}

// exportar clase (para import directo)
export { SheetsBaseClient }
export default createClient