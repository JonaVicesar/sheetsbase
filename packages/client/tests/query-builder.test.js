import { test } from 'node:test'
import assert from 'node:assert/strict'
import QueryBuilder from '../src/QueryBuilder.js'

// conector falso: devuelve datos en memoria sin tocar Google Sheets
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

test('eq filtra por igualdad', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').eq('category', 'tech')
  const result = await q.execute()
  assert.equal(result.length, 3)
})

test('neq filtra por diferencia', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').neq('category', 'tech')
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Desk', 'Flor'])
})

test('gt y lte comparan numericamente', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').gt('price', 100).lte('price', 1000)
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Laptop', 'Desk'])
})

test('gte y lt comparan numericamente', async () => {
  // ojo: celdas vacias vienen como null y Number(null) es 0 -> pasan gte 0
  const all = await new QueryBuilder(createFakeConnector()).from('products').gte('price', 0).execute()
  assert.equal(all.length, 5)

  const some = await new QueryBuilder(createFakeConnector()).from('products').lt('price', 30).execute()
  assert.deepEqual(some.map(r => r.name), ['Mouse', 'Flor'])
})

test('like es case-insensitive y busca substring', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').like('name', 'lap')
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Laptop'])
})

test('multiples filtros se combinan con AND', async () => {
  const q = new QueryBuilder(createFakeConnector())
    .from('products')
    .eq('category', 'tech')
    .gt('stock', 0)
  const result = await q.execute()
  assert.deepEqual(result.map(r => r.name), ['Laptop', 'Mouse'])
})

test('select devuelve solo las columnas pedidas', async () => {
  const q = new QueryBuilder(createFakeConnector()).from('products').select('name, price')
  const [first] = await q.execute()
  assert.deepEqual(Object.keys(first), ['name', 'price'])
})

test('select * devuelve todas las columnas', async () => {
  const [first] = await new QueryBuilder(createFakeConnector()).from('products').select('*').execute()
  assert.deepEqual(Object.keys(first), ['id', 'name', 'price', 'stock', 'category'])
})

test('order ordena numericamente asc y desc', async () => {
  const asc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'asc').execute()
  const desc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'desc').execute()
  assert.equal(asc[0].name, 'Mouse') // 25 es el precio minimo numerico
  assert.equal(desc[0].name, 'iPhone') // 1200 es el precio maximo
})

test('order manda los valores nulos al final en ambas direcciones', async () => {
  const asc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'asc').execute()
  const desc = await new QueryBuilder(createFakeConnector()).from('products').order('price', 'desc').execute()
  assert.equal(asc.at(-1).name, 'Flor') // price 'null'
  assert.equal(desc.at(-1).name, 'Flor')
})

test('order ordena strings', async () => {
  const result = await new QueryBuilder(createFakeConnector()).from('products').order('name', 'asc').execute()
  assert.equal(result[0].name, 'Desk')
  assert.equal(result[result.length - 1].name, 'Mouse')
})

test('limit recorta los resultados', async () => {
  const result = await new QueryBuilder(createFakeConnector()).from('products').limit(2).execute()
  assert.equal(result.length, 2)
})

test('execute sin from() lanza error', async () => {
  await assert.rejects(() => new QueryBuilder(createFakeConnector()).execute())
})

test('se puede awaitear la query sin execute()', async () => {
  const result = await new QueryBuilder(createFakeConnector()).from('products').eq('category', 'tech')
  assert.equal(result.length, 3)
})

test('la cache evita la segunda llamada al conector', async () => {
  const calls = []
  const cache = createFakeCache()
  const builder = () => new QueryBuilder(createFakeConnector(calls), cache).from('products').eq('category', 'tech')

  const first = await builder().execute()
  const second = await builder().execute()

  assert.equal(first.length, 3)
  assert.deepEqual(second, first)
  assert.equal(calls.length, 1, 'el conector solo debe leerse una vez')
})
