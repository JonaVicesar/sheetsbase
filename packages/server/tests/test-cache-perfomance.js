import dotenv from 'dotenv'
import SheetsConnector from '../src/core/SheetsConnector.js'
import QueryBuilder from '../src/core/QueryBuilder.js'
import CacheManager from '../src/core/Cache.js'

dotenv.config()

async function testCachePerformance() {
  console.log('Iniciando pruebas de performance del cache\n')

  const connector = new SheetsConnector(
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
    process.env.SPREADSHEET_ID
  )

  const cache = new CacheManager({
    ttl: 300,
    enabled: true
  })

  // Primera Prueba: Sin cache
  console.log('Primera Prueba: Sin cache (3 queries)\n')

  const times = []

  for (let i = 1; i <= 3; i++) {
    const start = Date.now()
    
    const qb = new QueryBuilder(connector, null)
    await qb.from('flowers').select('*').execute()
    
    const elapsed = Date.now() - start
    times.push(elapsed)
    console.log(`Query ${i}: ${elapsed}ms`)
  }

  const avgNoCacheFirst = times[0]
  const avgNoCacheRest = (times[1] + times[2]) / 2

  console.log(`\nPrimera query: ${avgNoCacheFirst}ms`)
  console.log(`Promedio 2da y 3ra: ${avgNoCacheRest.toFixed(0)}ms`)

  // Segunda Prueba: Con cache
  console.log('\nSegunda Prueba: Con cache (3 queries)\n')

  const timesCached = []

  for (let i = 1; i <= 3; i++) {
    const start = Date.now()
    
    const qb = new QueryBuilder(connector, cache)
    await qb.from('flowers').select('*').execute()
    
    const elapsed = Date.now() - start
    timesCached.push(elapsed)
    console.log(`Query ${i}: ${elapsed}ms ${i > 1 ? '(desde cache)' : ''}`)
  }

  const avgCacheFirst = timesCached[0]
  const avgCacheHits = (timesCached[1] + timesCached[2]) / 2

  console.log(`\nPrimera query (MISS): ${avgCacheFirst}ms`)
  console.log(`Promedio cache HITs: ${avgCacheHits.toFixed(0)}ms`)

  // Tercera Prueba: Queries complejas con filtros
  console.log('\nTercera Prueba: Query compleja (con filtros)\n')

  const startComplex1 = Date.now()
  const qb1 = new QueryBuilder(connector, null)
  await qb1
    .from('flowers')
    .select('name, country')
    .eq('type', 'test')
    .order('name', 'asc')
    .execute()
  const timeComplex1 = Date.now() - startComplex1

  const startComplex2 = Date.now()
  const qb2 = new QueryBuilder(connector, cache)
  await qb2
    .from('flowers')
    .select('name, country')
    .eq('type', 'test')
    .order('name', 'asc')
    .execute()
  const timeComplex2 = Date.now() - startComplex2

  const startComplex3 = Date.now()
  const qb3 = new QueryBuilder(connector, cache)
  await qb3
    .from('flowers')
    .select('name, country')
    .eq('type', 'test')
    .order('name', 'asc')
    .execute()
  const timeComplex3 = Date.now() - startComplex3

  console.log(`Sin cache:           ${timeComplex1}ms`)
  console.log(`Con cache (MISS):    ${timeComplex2}ms`)
  console.log(`Con cache (HIT):     ${timeComplex3}ms`)

  // Cuarta Prueba: Invalidacion de cache
  console.log('\nCuarta Prueba: Invalidacion de cache\n')

  const qb4 = new QueryBuilder(connector, cache)
  await qb4.from('flowers').select('*').execute()
  console.log('Query cacheada')

  console.log(`\nKeys en cache antes de invalidar: ${cache.cache.keys().length}`)
  
  cache.invalidate('flowers')
  console.log('Cache invalidado para tabla "flowers"')
  
  console.log(`Keys en cache despues: ${cache.cache.keys().length}`)

  const startAfterInvalidate = Date.now()
  const qb5 = new QueryBuilder(connector, cache)
  await qb5.from('flowers').select('*').execute()
  const timeAfterInvalidate = Date.now() - startAfterInvalidate
  console.log(`\nQuery despues de invalidar: ${timeAfterInvalidate}ms (MISS)`)

  // Resumen
  const improvement = ((avgNoCacheRest - avgCacheHits) / avgNoCacheRest * 100).toFixed(0)
  const speedup = (avgNoCacheRest / avgCacheHits).toFixed(1)

  console.log('\nRESUMEN COMPARATIVO\n')
  console.log('┌─────────────────────────┬──────────────┐')
  console.log('│ Escenario               │ Tiempo       │')
  console.log('├─────────────────────────┼──────────────┤')
  console.log(`│ Sin cache               │ ${avgNoCacheRest.toFixed(0).padStart(7)}ms    │`)
  console.log(`│ Con cache (HIT)         │ ${avgCacheHits.toFixed(0).padStart(7)}ms     │`)
  console.log('└─────────────────────────┴──────────────┘')

  console.log(`\nMejora: ${improvement}% mas rapido`)
  console.log(`Speedup: ${speedup}x mas rapido\n`)

  
  if (avgCacheHits < 50) {
    console.log('Cache funcionando EXCELENTE')
  } else if (avgCacheHits < 100) {
    console.log('Cache funcionando BIEN')
  } else {
    console.log('Cache funcionando pero con overhead')
  }

  console.log('\nTODAS LAS PRUEBAS COMPLETADAS!')
}

testCachePerformance().catch(console.error)