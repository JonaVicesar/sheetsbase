import { createClient } from '../src/index.js'

async function testClient() {
  console.log('Iniciando pruebas del Cliente SheetsBase\n')

  const db = createClient({
    apiUrl: 'http://localhost:3000'
  })

  try {
    // Primera Prueba: SELECT *
    console.log('\nPrimera Prueba: SELECT *')
    const flowers = await db
      .from('flowers')
      .select('*')
    console.table(flowers)

    // Segunda Prueba: WHERE type = "test"
    console.log('\nSegunda Prueba: WHERE type = "test"')
    const testFlowers = await db
      .from('flowers')
      .select('name, country, type')
      .eq('type', 'test')
    console.table(testFlowers)

    // Tercera Prueba: Query compleja
    console.log('\nTercera Prueba: Query compleja')
    const complexQuery = await db
      .from('flowers')
      .select('name, country')
      .like('name', 'Flor')
      .order('name', 'asc')
      .limit(3)
    console.table(complexQuery)

    // Cuarta Prueba: Multiples filtros (AND)
    console.log('\nCuarta Prueba: Multiples filtros (AND)')
    const multiFilter = await db
      .from('flowers')
      .select('*')
      .eq('type', 'test')
      .like('name', 'Flor')
    console.table(multiFilter)

    console.log('\nTODAS LAS PRUEBAS COMPLETADAS!')

  } catch (error) {
    console.error('\nERROR en las pruebas:', error.message)
    console.error('Asegurate de que el servidor este corriendo: cd packages/server && npm run dev')
  }
}

testClient()