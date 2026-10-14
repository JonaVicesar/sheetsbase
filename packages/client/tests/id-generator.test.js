import { test } from 'node:test'
import assert from 'node:assert/strict'
import IdGenerator from '../src/core/IdGenerator.js'

test('generateUUID devuelve un UUID v4 valido', () => {
  const uuid = IdGenerator.generateUUID()
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('generateUUID genera valores distintos', () => {
  const ids = new Set(Array.from({ length: 100 }, () => IdGenerator.generateUUID()))
  assert.equal(ids.size, 100)
})

test('generateShortId devuelve 16 caracteres alfanumericos', () => {
  const id = IdGenerator.generateShortId()
  assert.match(id, /^[a-z0-9]{16}$/)
})

test('generateTimestampId tiene formato timestamp_random', () => {
  const before = Date.now()
  const id = IdGenerator.generateTimestampId()
  const after = Date.now()
  const [timestamp, random] = id.split('_')
  assert.ok(Number(timestamp) >= before && Number(timestamp) <= after)
  assert.match(random, /^[a-z0-9]+$/)
})

test('generateReadableId incluye prefijo y fecha', () => {
  const id = IdGenerator.generateReadableId('order')
  const now = new Date()
  const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  assert.match(id, new RegExp(`^order-${expectedDate}-[a-z0-9]+$`))
})

test('generateReadableId usa prefijo por defecto', () => {
  const id = IdGenerator.generateReadableId()
  assert.match(id, /^item-/)
})

test('checkIdExists detecta IDs existentes', () => {
  const records = [{ id: 'abc' }, { id: 'def' }]
  assert.equal(IdGenerator.checkIdExists(records, 'abc'), true)
  assert.equal(IdGenerator.checkIdExists(records, 'xyz'), false)
})

test('generateUniqueId evita colisiones con registros existentes', () => {
  const existing = [{ id: 'aaaaaaaaaaaaaaaa' }]
  for (const type of ['uuid', 'short', 'timestamp', 'readable']) {
    const id = IdGenerator.generateUniqueId(existing, type, 'item')
    assert.ok(!IdGenerator.checkIdExists(existing, id), `colision para tipo ${type}`)
  }
})

test('generateUniqueId cae a UUID con un tipo desconocido', () => {
  const id = IdGenerator.generateUniqueId([], 'tipo-inexistente')
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
