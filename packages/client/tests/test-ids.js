import { createClient } from '../src/index.js'

async function testAutoIds() {
  console.log('Iniciando pruebas de IDs automaticos\n')

  const db = createClient({
    apiUrl: 'http://localhost:3000'
  })

  try {
    // Primera Prueba: INSERT sin ID (UUID automatico)
    console.log('\nPrimera Prueba: INSERT sin ID (UUID por defecto)')
    const result1 = await db.insert('flowers', {
      name: 'Rosa Automatica',
      country: 'Argentina',
      type: 'test-auto-id'
    })
    console.log('Resultado:', result1)
    console.log(`ID generado: ${result1.id}\n`)

    // Segunda Prueba: INSERT con ID tipo 'short'
    console.log('\nSegunda Prueba: INSERT con ID tipo "short"')
    const result2 = await db.insert('flowers', {
      name: 'Girasol Compacto',
      country: 'Ecuador',
      type: 'test-auto-id'
    }, {
      idConfig: { type: 'short' }
    })
    console.log('Resultado:', result2)
    console.log(`ID generado: ${result2.id} (${result2.id.length} caracteres)\n`)

    // Tercera Prueba: INSERT con ID tipo 'timestamp'
    console.log('\nTercera Prueba: INSERT con ID tipo "timestamp"')
    const result3 = await db.insert('flowers', {
      name: 'Lilium con Timestamp',
      country: 'Holanda',
      type: 'test-auto-id'
    }, {
      idConfig: { type: 'timestamp' }
    })
    console.log('Resultado:', result3)
    console.log(`ID generado: ${result3.id}\n`)

    // Cuarta Prueba: INSERT con ID tipo 'readable'
    console.log('\nCuarta Prueba: INSERT con ID tipo "readable"')
    const result4 = await db.insert('flowers', {
      name: 'Tulipan Legible',
      country: 'Holanda',
      type: 'test-auto-id'
    }, {
      idConfig: { type: 'readable', prefix: 'flower' }
    })
    console.log('Resultado:', result4)
    console.log(`ID generado: ${result4.id}\n`)

    // Quinta Prueba: INSERT multiple con IDs automaticos
    console.log('\nQuinta Prueba: INSERT multiple con IDs automaticos')
    const result5 = await db.insert('flowers', [
      { name: 'Orquidea 1', country: 'Colombia', type: 'test-auto-id' },
      { name: 'Orquidea 2', country: 'Ecuador', type: 'test-auto-id' },
      { name: 'Orquidea 3', country: 'Peru', type: 'test-auto-id' }
    ], {
      idConfig: { type: 'readable', prefix: 'orquidea' }
    })
    console.log('Resultado:', result5)
    console.log(`IDs generados:`, result5.insertedIds, '\n')

    // Sexta Prueba: Ver todos los registros insertados
    console.log('\nSexta Prueba: Ver registros insertados')
    const testRecords = await db
      .from('flowers')
      .select('*')
      .eq('type', 'test-auto-id')

    console.log(`Total de registros: ${testRecords.length}`)
    console.table(testRecords.map(r => ({
      id: r.id,
      name: r.name,
      country: r.country
    })))

    console.log('\nTODAS LAS PRUEBAS COMPLETADAS!')

  } catch (error) {
    console.error('\nERROR en las pruebas:', error.message)
  }
}

testAutoIds()