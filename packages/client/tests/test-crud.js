import { createClient } from '../src/index.js'

async function testCRUD() {
  console.log('Iniciando pruebas CRUD\n')

  const db = createClient({
    apiUrl: 'http://localhost:3000'
  })

  try {
    // Primera Prueba: INSERT un registro
    console.log('\nPrimera Prueba: INSERT un registro')
    const insertResult = await db.insert('flowers', {
      id: `test-${Date.now()}`,
      name: 'Rosa de Prueba CRUD',
      country: 'Colombia',
      type: 'test-crud'
    })
    console.log('Resultado:', insertResult)

    // Segunda Prueba: INSERT multiples registros
    console.log('\nSegunda Prueba: INSERT multiples registros')
    const multiInsertResult = await db.insert('flowers', [
      {
        id: `multi-1-${Date.now()}`,
        name: 'Girasol CRUD',
        country: 'Ecuador',
        type: 'test-crud'
      },
      {
        id: `multi-2-${Date.now()}`,
        name: 'Lilium CRUD',
        country: 'Holanda',
        type: 'test-crud'
      }
    ])
    console.log('Resultado:', multiInsertResult)

    // Tercera Prueba: SELECT registros insertados
    console.log('\nTercera Prueba: SELECT registros insertados')
    const testRecords = await db
      .from('flowers')
      .select('*')
      .eq('type', 'test-crud')

    console.log('Registros encontrados:', testRecords.length)
    console.table(testRecords)

    if (testRecords.length === 0) {
      console.warn('No se encontraron registros. El insert fallo?')
      return
    }

    // Cuarta Prueba: UPDATE un registro
    console.log('\nCuarta Prueba: UPDATE un registro')
    const firstRecord = testRecords[0]
    console.log(`Actualizando registro con id: ${firstRecord.id}`)

    const updateResult = await db.update('flowers', firstRecord.id, {
      name: 'Rosa ACTUALIZADA',
      country: 'Paraguay'
    })
    console.log('Resultado:', updateResult)

    const updatedRecords = await db
      .from('flowers')
      .select('*')
      .eq('id', firstRecord.id)
    console.log('\nRegistro despues de actualizar:')
    console.table(updatedRecords)

    // Quinta Prueba: DELETE registros
    console.log('\nQuinta Prueba: DELETE registros')
    for (const record of testRecords) {
      console.log(`Eliminando: ${record.name} (id: ${record.id})`)
      await db.delete('flowers', record.id)
    }

    const remainingRecords = await db
      .from('flowers')
      .select('*')
      .eq('type', 'test-crud')

    console.log(`Registros restantes con type='test-crud': ${remainingRecords.length}`)

    if (remainingRecords.length === 0) {
      console.log('Todos los registros de prueba fueron eliminados correctamente')
    } else {
      console.warn('Algunos registros no se eliminaron:')
      console.table(remainingRecords)
    }

    console.log('\nTODAS LAS PRUEBAS CRUD COMPLETADAS!')

  } catch (error) {
    console.error('\nERROR en las pruebas CRUD:', error.message)
    console.error('Asegurate de que el servidor este corriendo y la tabla "flowers" exista')
  }
}

testCRUD()