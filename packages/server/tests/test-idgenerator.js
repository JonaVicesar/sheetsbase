import dotenv from 'dotenv'
import IdGenerator from '../src/core/IdGenerator.js'
import SheetsConnector from '../src/core/SheetsConnector.js'

dotenv.config()

async function testIdGenerator() {
  console.log('Iniciando pruebas del IdGenerator\n')

  // Primera Prueba: UUID v4
  console.log('\nPrimera Prueba: UUID v4')
  for (let i = 0; i < 5; i++) {
    const uuid = IdGenerator.generateUUID()
    console.log(`UUID ${i + 1}: ${uuid}`)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const isValid = uuidRegex.test(uuid)
    console.log(`  Formato valido: ${isValid}`)
  }

  // Segunda Prueba: Short ID
  console.log('\nSegunda Prueba: Short ID (16 caracteres)')
  for (let i = 0; i < 5; i++) {
    const shortId = IdGenerator.generateShortId()
    console.log(`Short ID ${i + 1}: ${shortId} (length: ${shortId.length})`)
  }

  // Tercera Prueba: Timestamp ID
  console.log('\nTercera Prueba: Timestamp ID (ordenable)')
  const timestampIds = []
  for (let i = 0; i < 5; i++) {
    const timestampId = IdGenerator.generateTimestampId()
    timestampIds.push(timestampId)
    console.log(`Timestamp ID ${i + 1}: ${timestampId}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  console.log('\nOrdenados alfabeticamente:')
  const sorted = [...timestampIds].sort()
  sorted.forEach((id, i) => console.log(`  ${i + 1}. ${id}`))

  // Cuarta Prueba: Readable ID
  console.log('\nCuarta Prueba: Readable ID (legible)')
  const prefixes = ['flower', 'batch', 'package', 'order', 'client']
  prefixes.forEach(prefix => {
    const readableId = IdGenerator.generateReadableId(prefix)
    console.log(`${prefix.padEnd(10)} → ${readableId}`)
  })

  // Quinta Prueba: Unicidad
  console.log('\nQuinta Prueba: Verificar unicidad')
  const existingRecords = [
    { id: 'flower-2024-01-01-abc1' },
    { id: 'flower-2024-01-01-abc2' },
    { id: 'flower-2024-01-01-abc3' }
  ]
  console.log('Registros existentes:')
  existingRecords.forEach(r => console.log(`  - ${r.id}`))
  console.log('\nGenerando IDs unicos...')
  for (let i = 0; i < 5; i++) {
    const uniqueId = IdGenerator.generateUniqueId(existingRecords, 'readable', 'flower')
    const exists = IdGenerator.checkIdExists(existingRecords, uniqueId)
    console.log(`  ${uniqueId} → ${exists ? 'YA EXISTE' : 'UNICO'}`)
    existingRecords.push({ id: uniqueId })
  }

  // Sexta Prueba: Stress test (1000 IDs)
  console.log('\nSexta Prueba: Stress test (1000 IDs)')
  const types = ['uuid', 'short', 'timestamp', 'readable']
  for (const type of types) {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      let id
      if (type === 'uuid') {
        id = IdGenerator.generateUUID()
      } else if (type === 'short') {
        id = IdGenerator.generateShortId()
      } else if (type === 'timestamp') {
        id = IdGenerator.generateTimestampId()
      } else {
        id = IdGenerator.generateReadableId('item')
      }
      ids.add(id)
    }
    const collisions = 1000 - ids.size
    console.log(`${type.padEnd(12)} → ${ids.size}/1000 unicos (${collisions} colisiones)`)
  }

  // Septima Prueba: Insertar registros reales en Google Sheets
  console.log('\nSeptima Prueba: Insertar registros en Google Sheets')
  const connector = new SheetsConnector(
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
    process.env.SPREADSHEET_ID
  )

  const beforeRecords = await connector.readSheet('flowers')
  console.log(`Registros antes: ${beforeRecords.length}`)

  const newRecords = [
    { id: IdGenerator.generateUUID(), name: 'Flor Test UUID', country: 'test', type: 'id-test', created_at: new Date().toISOString() },
    { id: IdGenerator.generateShortId(), name: 'Flor Test Short', country: 'test', type: 'id-test', created_at: new Date().toISOString() },
    { id: IdGenerator.generateTimestampId(), name: 'Flor Test Timestamp', country: 'test', type: 'id-test', created_at: new Date().toISOString() },
  ]

  for (const record of newRecords) {
    await connector.appendRow('flowers', record)
    console.log(`  Insertado: ${record.id}`)
  }

  const afterRecords = await connector.readSheet('flowers')
  console.log(`Registros despues: ${afterRecords.length}`)
  console.log(`Nuevos registros agregados: ${afterRecords.length - beforeRecords.length}`)

  console.log('\nTODAS LAS PRUEBAS COMPLETADAS!')
}

testIdGenerator()