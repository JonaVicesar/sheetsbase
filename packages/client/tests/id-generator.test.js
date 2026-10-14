import { test } from 'node:test'
import assert from 'node:assert/strict'
import IdGenerator from '../src/core/IdGenerator.js'

test('generateUUID returns a valid v4 UUID', () => {
  const uuid = IdGenerator.generateUUID()
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('generateUUID generates distinct values', () => {
  const ids = new Set(Array.from({ length: 100 }, () => IdGenerator.generateUUID()))
  assert.equal(ids.size, 100)
})

test('generateShortId returns 16 alphanumeric characters', () => {
  const id = IdGenerator.generateShortId()
  assert.match(id, /^[a-z0-9]{16}$/)
})

test('generateTimestampId has a timestamp_random format', () => {
  const before = Date.now()
  const id = IdGenerator.generateTimestampId()
  const after = Date.now()
  const [timestamp, random] = id.split('_')
  assert.ok(Number(timestamp) >= before && Number(timestamp) <= after)
  assert.match(random, /^[a-z0-9]+$/)
})

test('generateReadableId includes prefix and date', () => {
  const id = IdGenerator.generateReadableId('order')
  const now = new Date()
  const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  assert.match(id, new RegExp(`^order-${expectedDate}-[a-z0-9]+$`))
})

test('generateReadableId uses the default prefix', () => {
  const id = IdGenerator.generateReadableId()
  assert.match(id, /^item-/)
})

test('checkIdExists detects existing ids', () => {
  const records = [{ id: 'abc' }, { id: 'def' }]
  assert.equal(IdGenerator.checkIdExists(records, 'abc'), true)
  assert.equal(IdGenerator.checkIdExists(records, 'xyz'), false)
})

test('generateUniqueId avoids collisions with existing records', () => {
  const existing = [{ id: 'aaaaaaaaaaaaaaaa' }]
  for (const type of ['uuid', 'short', 'timestamp', 'readable']) {
    const id = IdGenerator.generateUniqueId(existing, type, 'item')
    assert.ok(!IdGenerator.checkIdExists(existing, id), `collision for type ${type}`)
  }
})

test('generateUniqueId falls back to UUID for an unknown type', () => {
  const id = IdGenerator.generateUniqueId([], 'tipo-inexistente')
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
