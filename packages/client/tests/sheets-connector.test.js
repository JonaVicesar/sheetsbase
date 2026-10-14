import { test } from 'node:test'
import assert from 'node:assert/strict'
import SheetsConnector from '../src/core/SheetsConnector.js'

// fake Google Sheets client: records calls and returns programmed responses
function createFakeGoogleSheets() {
  const calls = {
    valuesGet: [],
    valuesAppend: [],
    valuesUpdate: [],
    batchUpdate: [],
    spreadsheetsGet: []
  }
  const state = {
    headers: ['id', 'name', 'price'],
    values: [
      ['id', 'name', 'price'],
      ['1', 'Laptop', '999'],
      ['2', 'Mouse', ''] // celda vacia
    ],
    sheetsMeta: [{ properties: { title: 'products', sheetId: 42 } }]
  }

  const fake = {
    spreadsheets: {
      values: {
        get: async (params) => {
          calls.valuesGet.push(params)
          if (params.range.endsWith('1:1')) {
            return { data: { values: state.headers.length ? [state.headers] : undefined } }
          }
          return { data: { values: state.values } }
        },
        append: async (params) => {
          calls.valuesAppend.push(params)
          return { data: { updates: { updatedRange: 'products!A4:C4' } } }
        },
        update: async (params) => {
          calls.valuesUpdate.push(params)
          return { data: { updatedRange: params.range } }
        }
      },
      get: async (params) => {
        calls.spreadsheetsGet.push(params)
        return { data: { sheets: state.sheetsMeta } }
      },
      batchUpdate: async (params) => {
        calls.batchUpdate.push(params)
        return { data: { replies: [{}] } }
      }
    }
  }

  return {
    fake,
    calls,
    state,
    setHeaders: (headers) => { state.headers = headers },
    setValues: (values) => { state.values = values },
    setSheetsMeta: (meta) => { state.sheetsMeta = meta }
  }
}

function createConnector(fakeSheets) {
  // the fake client is injected; no credentials file is read
  return new SheetsConnector(null, 'spreadsheet-123', { sheets: fakeSheets })
}

test('the constructor requires spreadsheetId', () => {
  assert.throws(() => new SheetsConnector(null, null, { sheets: {} }), /spreadsheetId/)
})

test('the constructor requires serviceAccountPath when no client is injected', () => {
  assert.throws(() => new SheetsConnector(null, 'spreadsheet-123'), /serviceAccountPath/)
})

test('readSheet maps rows to objects and uses null for empty cells', async () => {
  const { fake } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  const records = await connector.readSheet('products')

  assert.deepEqual(records, [
    { id: '1', name: 'Laptop', price: '999' },
    { id: '2', name: 'Mouse', price: null }
  ])
})

test('readSheet returns an empty array when the sheet has no data', async () => {
  const { fake, setValues } = createFakeGoogleSheets()
  setValues([])
  const connector = createConnector(fake)

  assert.deepEqual(await connector.readSheet('products'), [])
})

test('readSheet uses a range based on the real column count', async () => {
  const { fake, calls, setHeaders, setValues } = createFakeGoogleSheets()
  setHeaders(Array.from({ length: 30 }, (_, i) => `col${i}`))
  setValues([Array.from({ length: 30 }, (_, i) => `col${i}`), Array.from({ length: 30 }, (_, i) => String(i))])
  const connector = createConnector(fake)

  const records = await connector.readSheet('products')

  // 30 columns => range A:AD (no longer capped at Z); the headers call comes first
  assert.equal(calls.valuesGet[1].range, 'products!A:AD')
  assert.equal(Object.keys(records[0]).length, 30)
  assert.equal(records[0].col29, '29')
})

test('getHeaders is cached: two calls = one request', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.getHeaders('products')
  await connector.getHeaders('products')

  assert.equal(calls.valuesGet.length, 1)
})

test('clearCache drops the headers cache', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.getHeaders('products')
  connector.clearCache()
  await connector.getHeaders('products')

  assert.equal(calls.valuesGet.length, 2)
})

test('appendRow respects header order and uses the right range', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.appendRow('products', { name: 'Keyboard', price: 75 })

  assert.equal(calls.valuesAppend[0].range, 'products!A:C')
  assert.deepEqual(calls.valuesAppend[0].resource.values, [['', 'Keyboard', 75]])
  assert.equal(calls.valuesAppend[0].valueInputOption, 'RAW')
})

test('appendRows sends every row in a single call', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.appendRows('products', [
    { id: '10', name: 'A', price: '1' },
    { id: '11', name: 'B' },
    { id: '12', name: 'C', price: '3' }
  ])

  assert.equal(calls.valuesAppend.length, 1, 'a single API call')
  assert.deepEqual(calls.valuesAppend[0].resource.values, [
    ['10', 'A', '1'],
    ['11', 'B', ''],
    ['12', 'C', '3']
  ])
})

test('updateRow writes the given row with mapped values', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.updateRow('products', 3, { id: '2', price: '30' })

  assert.equal(calls.valuesUpdate[0].range, 'products!A3:C3')
  assert.deepEqual(calls.valuesUpdate[0].resource.values, [['2', '', '30']])
})

test('deleteRow removes the row via batchUpdate deleteDimension', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.deleteRow('products', 2)

  assert.equal(calls.batchUpdate.length, 1)
  const request = calls.batchUpdate[0].requestBody.requests[0]
  assert.deepEqual(request.deleteDimension.range, {
    sheetId: 42,
    dimension: 'ROWS',
    startIndex: 1, // fila 2 => indice 1 (0-based)
    endIndex: 2
  })
})

test('getSheetId looks up the id by name and caches it', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  assert.equal(await connector.getSheetId('products'), 42)
  await connector.getSheetId('products') // second time comes from cache

  assert.equal(calls.spreadsheetsGet.length, 1)
})

test('getSheetId throws when the sheet does not exist', async () => {
  const { fake } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await assert.rejects(() => connector.getSheetId('no-existe'), /no-existe/)
})
