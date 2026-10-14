import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '../src/index.js'
import CacheManager from '../src/core/Cache.js'

// conector falso con coreografia: registra llamadas y responde datos en memoria
function createFakeConnector() {
  const calls = []
  let records = [
    { id: '1', name: 'Laptop', price: '999', created_at: '2026-01-01T00:00:00.000Z' },
    { id: '2', name: 'Mouse', price: '25', created_at: '2026-01-01T00:00:00.000Z' }
  ]

  return {
    calls,
    getRecords: () => records,
    async readSheet(table) {
      calls.push(['readSheet', table])
      return records.map(r => ({ ...r }))
    },
    async appendRow(table, data) {
      calls.push(['appendRow', table, { ...data }])
      records.push({ ...data })
    },
    async appendRows(table, rows) {
      calls.push(['appendRows', table, rows.map(r => ({ ...r }))])
      rows.forEach(r => records.push({ ...r }))
    },
    async updateRow(table, rowNumber, data) {
      calls.push(['updateRow', table, rowNumber, { ...data }])
      records[rowNumber - 2] = { ...data }
    },
    async deleteRow(table, rowNumber) {
      calls.push(['deleteRow', table, rowNumber])
      records.splice(rowNumber - 2, 1)
    }
  }
}

function createDb() {
  const connector = createFakeConnector()
  const cache = new CacheManager({ ttl: 60 })
  const db = createClient({ connector, cacheManager: cache })
  return { db, connector, cache }
}

test('createClient exige configuracion', () => {
  assert.throws(() => createClient(), /configuracion/)
  assert.throws(() => createClient({}), /serviceAccount/)
  assert.throws(() => createClient({ spreadsheetId: 'x' }), /serviceAccount/)
})

test('createClient acepta un conector inyectado sin credenciales', () => {
  const db = createClient({ connector: createFakeConnector() })
  assert.ok(db.from('products'))
})

test('from() devuelve un QueryBuilder encadenable', async () => {
  const { db } = createDb()
  const result = await db.from('products').eq('name', 'Mouse').execute()
  assert.deepEqual(result.map(r => r.name), ['Mouse'])
})

test('insert genera id y created_at, y llama appendRow', async () => {
  const { db, connector } = createDb()
  const before = Date.now()

  const result = await db.insert('products', { name: 'Keyboard' })

  assert.equal(result.success, true)
  assert.ok(result.data.id)
  assert.equal(result.data.name, 'Keyboard')
  assert.ok(new Date(result.data.created_at).getTime() >= before)

  const [method, table, payload] = connector.calls.at(-1)
  assert.equal(method, 'appendRow')
  assert.equal(table, 'products')
  assert.equal(payload.name, 'Keyboard')
})

test('insert respeta un id provisto por el usuario', async () => {
  const { db, connector } = createDb()
  const result = await db.insert('products', { id: 'custom-1', name: 'Monitor' })
  assert.equal(result.data.id, 'custom-1')
  const [, , payload] = connector.calls.at(-1)
  assert.equal(payload.id, 'custom-1')
})

test('insert acepta idConfig con tipo short', async () => {
  const { db } = createDb()
  const result = await db.insert('products', { name: 'Cable' }, { idConfig: { type: 'short' } })
  assert.match(result.data.id, /^[a-z0-9]{16}$/)
})

test('insert sin ID no lee la hoja por defecto', async () => {
  const { db, connector } = createDb()
  await db.insert('products', { name: 'Auto' })

  const reads = connector.calls.filter(c => c[0] === 'readSheet')
  assert.equal(reads.length, 0, 'no debe leer la hoja si no se pide checkUniqueness')
})

test('insert con idConfig.checkUniqueness lee la hoja una vez', async () => {
  const { db, connector } = createDb()
  await db.insert('products', { name: 'Verified' }, { idConfig: { checkUniqueness: true } })

  const reads = connector.calls.filter(c => c[0] === 'readSheet')
  assert.equal(reads.length, 1)
})

test('insert de multiples registros usa un solo appendRows', async () => {
  const { db, connector } = createDb()
  const result = await db.insert('products', [
    { name: 'A' },
    { name: 'B' },
    { name: 'C' }
  ])

  assert.equal(result.count, 3)
  assert.equal(result.insertedIds.length, 3)

  const batches = connector.calls.filter(c => c[0] === 'appendRows')
  const appends = connector.calls.filter(c => c[0] === 'appendRow')
  assert.equal(batches.length, 1, 'una sola llamada batch')
  assert.equal(appends.length, 0, 'no debe usar insert individual')
  assert.equal(batches[0][2].length, 3)
  assert.deepEqual(batches[0][2].map(r => r.name), ['A', 'B', 'C'])
})

test('insert de multiples registros genera IDs unicos entre ellos', async () => {
  const { db } = createDb()
  const result = await db.insert('products', [
    { name: 'X' },
    { name: 'Y' }
  ], { idConfig: { type: 'readable', prefix: 'batch' } })

  assert.equal(new Set(result.insertedIds).size, 2)
  assert.ok(result.insertedIds.every(id => id.startsWith('batch-')))
})

test('insert de multiples registros preserva IDs explicitos', async () => {
  const { db, connector } = createDb()
  const result = await db.insert('products', [
    { id: 'given-1', name: 'Given' },
    { name: 'Generated' }
  ])

  assert.equal(result.insertedIds[0], 'given-1')
  assert.ok(result.insertedIds[1])
  const batch = connector.calls.find(c => c[0] === 'appendRows')
  assert.deepEqual(batch[2].map(r => r.name), ['Given', 'Generated'])
})

test('insert de multiples registros no muta los objetos del caller', async () => {
  const { db } = createDb()
  const original = [{ name: 'One' }, { name: 'Two' }]
  await db.insert('products', original)
  assert.deepEqual(original, [{ name: 'One' }, { name: 'Two' }])
})

test('delete acepta id numerico aunque Sheets guarde strings', async () => {
  const { db, connector } = createDb()
  const result = await db.delete('products', 1)
  assert.deepEqual(result, { success: true, id: 1 })

  const [method, table, rowNumber] = connector.calls.at(-1)
  assert.equal(method, 'deleteRow')
  assert.equal(table, 'products')
  assert.equal(rowNumber, 2)
})

test('insert no muta el objeto original del caller', async () => {
  const { db } = createDb()
  const original = { name: 'Clean' }
  await db.insert('products', original)
  assert.deepEqual(original, { name: 'Clean' })
})

test('update encuentra la fila por id y escribe con numero de fila correcto', async () => {
  const { db, connector } = createDb()
  const result = await db.update('products', '2', { price: '30' })

  assert.equal(result.success, true)
  assert.equal(result.data.price, '30')
  assert.ok(result.data.updated_at)

  const [method, table, rowNumber, payload] = connector.calls.at(-1)
  assert.equal(method, 'updateRow')
  assert.equal(table, 'products')
  assert.equal(rowNumber, 3) // id '2' es el segundo registro => fila 3
  assert.equal(payload.price, '30')
})

test('update lanza error si el id no existe', async () => {
  const { db } = createDb()
  await assert.rejects(() => db.update('products', '999', { price: '1' }), /999/)
})

test('update acepta id numerico aunque Sheets guarde strings', async () => {
  const { db, connector } = createDb()
  const result = await db.update('products', 2, { price: '30' })
  assert.equal(result.success, true)

  const [method, table, rowNumber] = connector.calls.at(-1)
  assert.equal(method, 'updateRow')
  assert.equal(table, 'products')
  assert.equal(rowNumber, 3)
})

test('delete elimina la fila del registro encontrado', async () => {
  const { db, connector } = createDb()
  const result = await db.delete('products', '1')

  assert.deepEqual(result, { success: true, id: '1' })

  const [method, table, rowNumber] = connector.calls.at(-1)
  assert.equal(method, 'deleteRow')
  assert.equal(table, 'products')
  assert.equal(rowNumber, 2)
})

test('delete lanza error si el id no existe', async () => {
  const { db } = createDb()
  await assert.rejects(() => db.delete('products', '999'), /999/)
})

test('las escrituras invalidan el cache de la tabla', async () => {
  const { db, cache } = createDb()

  await db.from('products').select('*').execute()
  assert.equal(cache.getStats().currentKeys, 1)

  await db.insert('products', { name: 'New' })

  assert.equal(cache.getStats().currentKeys, 0, 'la escritura debe invalidar el cache')
})

test('clearCache invalida por tabla o todo', async () => {
  const { db, cache } = createDb()

  await db.from('products').select('*').execute()
  await db.from('products').eq('name', 'Mouse').execute()
  assert.equal(cache.getStats().currentKeys, 2)

  db.clearCache()
  assert.equal(cache.getStats().currentKeys, 0)
})

test('getCacheStats devuelve estadisticas', async () => {
  const { db } = createDb()
  const stats = db.getCacheStats()
  assert.equal(typeof stats.hitRate, 'string')
  assert.equal(stats.totalRequests, 0)
})
