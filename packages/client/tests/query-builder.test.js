import { test } from 'node:test'
import assert from 'node:assert/strict'
import QueryBuilder from '../src/QueryBuilder.js'

// fake connector: serves data from memory, never touches Google Sheets
const DATASET = [
  { id: '1', name: 'Laptop', price: '999', stock: '10', category: 'tech' },
  { id: '2', name: 'Mouse', price: '25', stock: '50', category: 'tech' },
  { id: '3', name: 'iPhone', price: '1200', stock: '0', category: 'tech' },
  { id: '4', name: 'Desk', price: '250', stock: '5', category: 'furniture' },
  { id: '5', name: 'Flor', price: null, stock: null, category: 'garden' }
]

function createFakeConnector(calls = []) {
  return {
    async readSheet(sheetName) {
      calls.push(sheetName)
      return DATASET.map(row => ({ ...row }))
    }
  }
}

function createFakeCache() {
  const store = new Map()
  return {
    store,
    generateKey: (table, query) => `${table}:${JSON.stringify(query)}`,
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value)
  }
}

test('eq filters by equality', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').eq('category', 'tech')
  const result = await q.execute()
  assert.equal(result.length, 3)
})

test('neq filters by inequality', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').neq('category', 'tech')
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Desk', 'Flor'])
})

test('gt and lte compare numerically', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').gt('price', 100).lte('price', 1000)
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Laptop', 'Desk'])
})

test('gte and lt compare numerically', async () => {
  // note: empty cells arrive as null and Number(null) is 0 -> they pass gte 0
  const all = await new QueryBuilder(createFakeConnector()).from('products').gte('price', 0).execute()
  assert.equal(all.length, 5)

  const some = await new QueryBuilder(createFakeConnector()).from('products').lt('price', 30).execute()
  assert.deepEqual(some.map(r => r.name), ['Mouse', 'Flor'])
})

test('like is case-insensitive substring match', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').like('name', 'lap')
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Laptop'])
})

test('multiple filters combine with AND', async () => {
  const q = new QueryBuilder(createFakeConnector())
    .from('products')
    .eq('category', 'tech')
    .gt('stock', 0)
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Laptop', 'Mouse'])
})

test('select returns only the requested columns', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').select('name, price')
  const [first] = await q.execute()
  assert.deepEqual(Object.keys(first), ['name', 'price'])
})

test('select * returns every column', async () => {
  const [first] = await new QueryBuilder(createFakeConnector()).from('products').select('*').execute()
  assert.deepEqual(Object.keys(first), ['id', 'name', 'price', 'stock', 'category'])
})

test('order sorts numerically asc and desc', async () => {
  const asc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'asc').execute()
  const desc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'desc').execute()
  assert.equal(asc[0].name, 'Mouse') // 25 is the lowest numeric price
  assert.equal(desc[0].name, 'iPhone') // 1200 is the highest price
})

test('order sends null values last in both directions', async () => {
  const asc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'asc').execute()
  const desc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'desc').execute()
  assert.equal(asc.at(-1).name, 'Flor') // price is null
  assert.equal(desc.at(-1).name, 'Flor')
})

test('order sorts strings', async () => {
  const result = await new QueryBuilder(createFakeConnector()).from('products').order('name', 'asc').execute()
  assert.equal(result[0].name, 'Desk')
  assert.equal(result[result.length - 1].name, 'Mouse')
})

test('limit caps the results', async () => {
  const result = await new QueryBuilder(createFakeConnector()).from('products').limit(2).execute()
  assert.equal(result.length, 2)
})

test('execute without from() throws', async () => {
  await assert.rejects(() => new QueryBuilder(createFakeConnector()).execute())
})

test('the query is awaitable without execute()', async () => {
  const result = await new QueryBuilder(createFakeConnector()).from('products').eq('category', 'tech')
  assert.equal(result.length, 3)
})

test('the cache avoids a second connector read', async () => {
  const calls = []
  const cache = createFakeCache()
  const builder = () => new QueryBuilder(createFakeConnector(calls), cache).from('products').eq('category', 'tech')

  const first = await builder().execute()
  const second = await builder().execute()

  assert.equal(first.length, 3)
  assert.deepEqual(second, first)
  assert.equal(calls.length, 1, 'the connector is only read once')
})
