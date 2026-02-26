import dotenv from 'dotenv'
import SheetsConnector from '../src/core/SheetsConnector.js'
import QueryBuilder from '../src/core/QueryBuilder.js'

dotenv.config()

async function testQueryBuilder() {
  console.log('Iniciando pruebas del Query Builder\n')

  const connector = new SheetsConnector(
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
    process.env.SPREADSHEET_ID
  )

  // Primera Prueba: SELECT *
  console.log('\nPrimera Prueba: SELECT *')
  const result1 = await new QueryBuilder(connector)
    .from('flowers')
    .select('*')
    .execute()
  console.table(result1)

  // Segunda Prueba: SELECT columnas especificas
  console.log('\nSegunda Prueba: SELECT name, type')
  const result2 = await new QueryBuilder(connector)
    .from('flowers')
    .select('name, type')
    .execute()
  console.table(result2)

  // Tercera Prueba: Filtro .eq()
  console.log('\nTercera Prueba: WHERE type = "test"')
  const result3 = await new QueryBuilder(connector)
    .from('flowers')
    .select('*')
    .eq('type', 'test')
    .execute()
  console.table(result3)

  // Cuarta Prueba: Multiples filtros
  console.log('\nCuarta Prueba: WHERE type = "test" AND name LIKE "Flor"')
  const result4 = await new QueryBuilder(connector)
    .from('flowers')
    .select('*')
    .eq('type', 'test')
    .like('name', 'Flor')
    .execute()
  console.table(result4)

  // Quinta Prueba: ORDER BY
  console.log('\nQuinta Prueba: ORDER BY name DESC')
  const result5 = await new QueryBuilder(connector)
    .from('flowers')
    .select('name, type')
    .order('name', 'asc')
    .execute()
  console.table(result5)

  // Sexta Prueba: LIMIT
  console.log('\nSexta Prueba: LIMIT 2')
  const result6 = await new QueryBuilder(connector)
    .from('flowers')
    .select('*')
    .limit(2)
    .execute()
  console.table(result6)

  // Septima Prueba: Query compleja
  console.log('\nSeptima Prueba: SELECT name, type WHERE type = "test" ORDER BY name LIMIT 5')
  const result7 = await new QueryBuilder(connector)
    .from('flowers')
    .select('name, type')
    .eq('type', 'test')
    .order('name', 'asc')
    .limit(5)
    .execute()
  console.table(result7)

  console.log('\nTODAS LAS PRUEBAS COMPLETADAS!')
}

testQueryBuilder()