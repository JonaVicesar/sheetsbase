import express from 'express'
import QueryBuilder from '../core/QueryBuilder.js'
import IdGenerator from '../core/IdGenerator.js'

const router = express.Router()

// construir query desde request body
function buildQuery(queryBuilder, body) {
  const { table, select, filters, order, limit } = body

  if (!table) {
    throw new Error('El campo "table" es obligatorio')
  }
  queryBuilder.from(table)

  if (select) {
    queryBuilder.select(select)
  }

  if (filters && Array.isArray(filters)) {
    filters.forEach(filter => {
      const { field, op, value } = filter

      if (!field || !op || value === undefined) {
        throw new Error('Filtro inválido: debe tener field, op y value')
      }

      switch (op) {
        case 'eq':
          queryBuilder.eq(field, value)
          break
        case 'neq':
          queryBuilder.neq(field, value)
          break
        case 'gt':
          queryBuilder.gt(field, value)
          break
        case 'gte':
          queryBuilder.gte(field, value)
          break
        case 'lt':
          queryBuilder.lt(field, value)
          break
        case 'lte':
          queryBuilder.lte(field, value)
          break
        case 'like':
          queryBuilder.like(field, value)
          break
        default:
          throw new Error(`Operador desconocido: ${op}`)
      }
    })
  }

  if (order) {
    const { field, direction } = order
    if (field) {
      queryBuilder.order(field, direction || 'asc')
    }
  }

  if (limit) {
    queryBuilder.limit(parseInt(limit))
  }

  return queryBuilder
}

// ruta para consultar datos
router.post('/query', async (req, res) => {
  try {
    console.log('POST /api/query')
    console.log('Body:', JSON.stringify(req.body, null, 2))

    const connector = req.app.locals.sheetsConnector

    if (!connector) {
      throw new Error('SheetsConnector no está inicializado')
    }

    const queryBuilder = new QueryBuilder(connector)
    buildQuery(queryBuilder, req.body)
    const data = await queryBuilder.execute()

    res.json({
      success: true,
      data: data,
      count: data.length
    })

  } catch (error) {
    console.error('Error en /api/query:', error.message)
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
})

// ruta para insertar nuevos registros
router.post('/insert', async (req, res) => {
  try {
    console.log('POST /api/insert')
    console.log('Body:', JSON.stringify(req.body, null, 2))

    const { table, data, idConfig } = req.body

    if (!table || !data) {
      throw new Error('Se requieren los campos "table" y "data"')
    }

    const connector = req.app.locals.sheetsConnector

    // generar id automaticamente si no existe
    if (!data.id) {
      // obtener registros existentes para verificar unicidad
      const existingRecords = await connector.readSheet(table)
      
      // configuracion de id (valores por defecto)
      const type = idConfig?.type || 'uuid'
      const prefix = idConfig?.prefix || 'item'
      
      // generar id unico
      data.id = IdGenerator.generateUniqueId(existingRecords, type, prefix)
      
      console.log(`ID generado automticamente: ${data.id} (tipo: ${type})`)
    }

    // agregar timestamp automáticamente
    if (!data.created_at) {
      data.created_at = new Date().toISOString()
    }

    // insertar registro
    await connector.appendRow(table, data)

    res.json({
      success: true,
      message: 'Registro insertado exitosamente',
      id: data.id,  // devolver el id generado
      data: data
    })

  } catch (error) {
    console.error('Error en /api/insert:', error.message)
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
})

// ruta para actualizar registros
router.put('/update', async (req, res) => {
  try {
    console.log('PUT /api/update')
    console.log('Body:', JSON.stringify(req.body, null, 2))

    const { table, id, data } = req.body

    if (!table || !id || !data) {
      throw new Error('Se requieren los campos "table", "id" y "data"')
    }

    const connector = req.app.locals.sheetsConnector

    // buscar el registro por id
    const allRecords = await connector.readSheet(table)
    const recordIndex = allRecords.findIndex(record => record.id == id)

    if (recordIndex === -1) {
      throw new Error(`No se encontró un registro con id=${id}`)
    }

    // calcular el numero de fila en google sheets
    const rowNumber = recordIndex + 2

    // agregar updated_at
    data.updated_at = new Date().toISOString()

    // actualizar(combina con los datos que ya existen)
    const updatedData = { ...allRecords[recordIndex], ...data }

    await connector.updateRow(table, rowNumber, updatedData)

    res.json({
      success: true,
      message: 'Registro actualizado exitosamente',
      rowNumber: rowNumber,
      data: updatedData
    })

  } catch (error) {
    console.error('Error en /api/update:', error.message)
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
})

// ruta para eliminar registros
router.delete('/delete', async (req, res) => {
  try {
    console.log('DELETE /api/delete')
    console.log('Body:', JSON.stringify(req.body, null, 2))

    const { table, id } = req.body

    if (!table || !id) {
      throw new Error('Se requieren los campos "table" e "id"')
    }

    const connector = req.app.locals.sheetsConnector

    // buscar el registro
    const allRecords = await connector.readSheet(table)
    const recordIndex = allRecords.findIndex(record => record.id == id)

    if (recordIndex === -1) {
      throw new Error(`No se encontró un registro con id=${id}`)
    }

    // calcular numero de fila
    const rowNumber = recordIndex + 2

    // eliminar (vacia la fila)
    await connector.deleteRow(table, rowNumber)

    res.json({
      success: true,
      message: 'Registro eliminado exitosamente',
      rowNumber: rowNumber
    })

  } catch (error) {
    console.error('Error en /api/delete:', error.message)
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
})

// ruta para obtener estadísticas del cache
router.get('/cache/stats', (req, res) => {
  try {
    const cacheManager = req.app.locals.cacheManager
    if (!cacheManager) {
      return res.status(503).json({ error: 'Cache no disponible' })
    }
    const stats = cacheManager.getStats()
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Error obteniendo stats:', error)
    res.status(500).json({ error: 'Error obteniendo estadísticas', message: error.message })
  }
})

// ruta para limpiar el cache
router.post('/cache/clear', (req, res) => {
  try {
    const cacheManager = req.app.locals.cacheManager
    if (!cacheManager) {
      return res.status(503).json({ error: 'Cache no disponible' })
    }
    const { table } = req.body
    if (table) {
      cacheManager.invalidate(table)
    } else {
      cacheManager.invalidateAll()
    }
    res.json({ success: true, message: table ? `Cache limpiado para: ${table}` : 'Cache completamente limpiado' })
  } catch (error) {
    console.error('Error limpiando cache:', error)
    res.status(500).json({ error: 'Error limpiando cache', message: error.message })
  }
})

export default router