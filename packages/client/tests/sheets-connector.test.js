import { test } from 'node:test'
import assert from 'node:assert/strict'
import SheetsConnector from '../src/core/SheetsConnector.js'

// cliente falso de google sheets: registra las llamadas y devuelve respuestas programadas
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
  // se inyecta el cliente falso; no se lee ningun archivo de credenciales
  return new SheetsConnector(null, 'spreadsheet-123', { sheets: fakeSheets })
}

test('el constructor exige spreadsheetId', () => {
  assert.throws(() => new SheetsConnector(null, null, { sheets: {} }), /spreadsheetId/)
})

test('el constructor exige serviceAccountPath si no se inyecta un cliente', () => {
  assert.throws(() => new SheetsConnector(null, 'spreadsheet-123'), /serviceAccountPath/)
})

test('readSheet mapea filas a objetos y usa null para celdas vacias', async () => {
  const { fake } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  const records = await connector.readSheet('products')

  assert.deepEqual(records, [
    { id: '1', name: 'Laptop', price: '999' },
    { id: '2', name: 'Mouse', price: null }
  ])
})

test('readSheet devuelve array vacio si la hoja no tiene datos', async () => {
  const { fake, setValues } = createFakeGoogleSheets()
  setValues([])
  const connector = createConnector(fake)

  assert.deepEqual(await connector.readSheet('products'), [])
})

test('readSheet usa el rango segun la cantidad real de columnas', async () => {
  const { fake, calls, setHeaders, setValues } = createFakeGoogleSheets()
  setHeaders(Array.from({ length: 30 }, (_, i) => `col${i}`))
  setValues([Array.from({ length: 30 }, (_, i) => `col${i}`), Array.from({ length: 30 }, (_, i) => String(i))])
  const connector = createConnector(fake)

  const records = await connector.readSheet('products')

  // 30 columnas => rango A:AD (ya no se limita a Z); la llamada de headers va primero
  assert.equal(calls.valuesGet[1].range, 'products!A:AD')
  assert.equal(Object.keys(records[0]).length, 30)
  assert.equal(records[0].col29, '29')
})

test('getHeaders se cachea: dos llamadas = una sola request', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.getHeaders('products')
  await connector.getHeaders('products')

  assert.equal(calls.valuesGet.length, 1)
})

test('clearCache limpia el cache de headers', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.getHeaders('products')
  connector.clearCache()
  await connector.getHeaders('products')

  assert.equal(calls.valuesGet.length, 2)
})

test('appendRow respeta el orden de los headers y usa el rango correcto', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.appendRow('products', { name: 'Keyboard', price: 75 })

  assert.equal(calls.valuesAppend[0].range, 'products!A:C')
  assert.deepEqual(calls.valuesAppend[0].resource.values, [['', 'Keyboard', 75]])
  assert.equal(calls.valuesAppend[0].valueInputOption, 'RAW')
})

test('appendRows envia todas las filas en una sola llamada', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.appendRows('products', [
    { id: '10', name: 'A', price: '1' },
    { id: '11', name: 'B' },
    { id: '12', name: 'C', price: '3' }
  ])

  assert.equal(calls.valuesAppend.length, 1, 'una sola llamada a la API')
  assert.deepEqual(calls.valuesAppend[0].resource.values, [
    ['10', 'A', '1'],
    ['11', 'B', ''],
    ['12', 'C', '3']
  ])
})

test('updateRow escribe la fila indicada con los valores mapeados', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await connector.updateRow('products', 3, { id: '2', price: '30' })

  assert.equal(calls.valuesUpdate[0].range, 'products!A3:C3')
  assert.deepEqual(calls.valuesUpdate[0].resource.values, [['2', '', '30']])
})

test('deleteRow borra la fila con batchUpdate deleteDimension', async () => {
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

test('getSheetId busca el ID por nombre y lo cachea', async () => {
  const { fake, calls } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  assert.equal(await connector.getSheetId('products'), 42)
  await connector.getSheetId('products') // segunda vez desde cache

  assert.equal(calls.spreadsheetsGet.length, 1)
})

test('getSheetId lanza error si la hoja no existe', async () => {
  const { fake } = createFakeGoogleSheets()
  const connector = createConnector(fake)

  await assert.rejects(() => connector.getSheetId('no-existe'), /no-existe/)
})
