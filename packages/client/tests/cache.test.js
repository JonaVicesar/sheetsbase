import { test } from 'node:test'
import assert from 'node:assert/strict'
import CacheManager from '../src/core/Cache.js'

function createCache() {
  return new CacheManager({ ttl: 60 })
}

test('get returns a copy: mutating the result cannot corrupt the cache', () => {
  const cache = createCache()
  const original = [{ id: '1', name: 'Laptop' }]

  cache.set('key', original)

  const first = cache.get('key')
  first[0].name = 'MUTADO'
  first.push({ id: '2', name: 'Extra' })

  const second = cache.get('key')
  assert.deepEqual(second, [{ id: '1', name: 'Laptop' }])
})

test('set stores a copy: mutating the input afterwards cannot change the cache', () => {
  const cache = createCache()
  const data = [{ id: '1', name: 'Laptop' }]

  cache.set('key', data)
  data[0].name = 'MUTADO'
  data.push({ id: '2', name: 'Extra' })

  assert.deepEqual(cache.get('key'), [{ id: '1', name: 'Laptop' }])
})

test('invalidate removes only the keys of the table', () => {
  const cache = createCache()
  cache.set('orders:a', [1])
  cache.set('orders:b', [2])
  cache.set('products:c', [3])

  cache.invalidate('orders')

  assert.equal(cache.get('orders:a'), undefined)
  assert.equal(cache.get('orders:b'), undefined)
  assert.deepEqual(cache.get('products:c'), [3])
})

test('getStats counts hits and misses', () => {
  const cache = createCache()
  cache.set('key', [1])

  cache.get('key')     // hit
  cache.get('missing') // miss

  const stats = cache.getStats()
  assert.equal(stats.hits, 1)
  assert.equal(stats.misses, 1)
  assert.equal(stats.sets, 1)
  assert.equal(stats.totalRequests, 2)
  assert.equal(stats.hitRate, 50)
})

test('a disabled cache neither stores nor returns', () => {
  const cache = new CacheManager({ enabled: false })
  assert.equal(cache.set('key', [1]), false)
  assert.equal(cache.get('key'), undefined)
})

test('generateKey produces canonical, order-independent keys', () => {
  const cache = createCache()

  const a = cache.generateKey('orders', {
    table: 'orders',
    columns: ['*'],
    filters: [
      { field: 'status', operator: 'eq', value: 'open' },
      { field: 'total', operator: 'gt', value: 100 }
    ],
    orderBy: null,
    orderDirection: 'asc',
    limitValue: null
  })

  const b = cache.generateKey('orders', {
    table: 'orders',
    columns: ['*'],
    filters: [
      { field: 'total', operator: 'gt', value: 100 },
      { field: 'status', operator: 'eq', value: 'open' }
    ],
    orderBy: null,
    orderDirection: 'asc',
    limitValue: null
  })

  assert.equal(a, b, 'filter order must not change the key')
  assert.ok(a.startsWith('orders:'), 'keys keep the table prefix used by invalidate()')
})

test('generateKey separates different queries', () => {
  const cache = createCache()
  const base = {
    table: 'orders',
    columns: ['*'],
    filters: [{ field: 'status', operator: 'eq', value: 'open' }],
    orderBy: null,
    orderDirection: 'asc',
    limitValue: null
  }

  const keys = new Set([
    cache.generateKey('orders', base),
    cache.generateKey('orders', { ...base, columns: ['id'] }),
    cache.generateKey('orders', { ...base, filters: [] }),
    cache.generateKey('orders', { ...base, filters: [{ field: 'status', operator: 'eq', value: 'closed' }] }),
    cache.generateKey('orders', { ...base, orderBy: 'total', orderDirection: 'desc' }),
    cache.generateKey('orders', { ...base, limitValue: 10 }),
    cache.generateKey('other', base)
  ])

  assert.equal(keys.size, 7)
})

test('generateKey does not merge different filters that stringify alike', () => {
  const cache = createCache()
  const a = cache.generateKey('t', { filters: [{ field: 'price', operator: 'gt', value: 'e10' }] })
  const b = cache.generateKey('t', { filters: [{ field: 'priceg', operator: 'te', value: '10' }] })
  assert.notEqual(a, b)
})
