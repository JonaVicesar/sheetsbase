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
  assert.equal(stats.hitRate, '50.00%')
})

test('a disabled cache neither stores nor returns', () => {
  const cache = new CacheManager({ enabled: false })
  assert.equal(cache.set('key', [1]), false)
  assert.equal(cache.get('key'), undefined)
})
