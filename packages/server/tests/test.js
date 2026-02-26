import dotenv from 'dotenv'
import SheetsConnector from '../src/core/SheetsConnector.js'

dotenv.config()

console.log('DEBUG - Variables de entorno:')
console.log('PORT:', process.env.PORT)
console.log('GOOGLE_SERVICE_ACCOUNT_FILE:', process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID)
console.log('')

async function testSheetsConnection() {
  console.log('Iniciando pruebas de conexion a Google Sheets\n')

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    console.error('ERROR: GOOGLE_SERVICE_ACCOUNT_FILE no esta definida en .env')
    process.exit(1)
  }

  if (!process.env.SPREADSHEET_ID) {
    console.error('ERROR: SPREADSHEET_ID no esta definida en .env')
    process.exit(1)
  }

  console.log('Variables de entorno encontradas')
  console.log(`Spreadsheet ID: ${process.env.SPREADSHEET_ID}`)
  console.log(`Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_FILE}\n`)

  // Primera Prueba: Crear SheetsConnector
  console.log('PRUEBA 1: Crear SheetsConnector')

  try {
    const connector = new SheetsConnector(
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  process.env.SPREADSHEET_ID
)
    console.log('SheetsConnector creado exitosamente\n')

    // Segunda Prueba: Leer hoja "flowers"
    console.log('PRUEBA 2: Leer hoja "flowers"')

    const flowers = await connector.readSheet('flowers')
    
    console.log(`Datos leidos: ${flowers.length} registros`)
    console.log('\nDatos obtenidos:')
    console.table(flowers)

    // Tercera Prueba: Obtener headers
    console.log('\nPRUEBA 3: Obtener headers de "flowers"')

    const headers = await connector.getHeaders('flowers')
    console.log('Headers obtenidos:', headers)

    // Cuarta Prueba: Insertar registro de prueba
    console.log('\nPRUEBA 4: Insertar registro de prueba')
    let today = new Date().toISOString();

    const newFlower = {
      id: 'fe734f8734y83fh9q38gr973g9q8r',
      name: 'Flor de Prueba2',
      country: 'argentina',
      type: 'test',
      created_at: today
    }

    console.log('Datos a insertar:')
    console.log(newFlower)

    await connector.appendRow('flowers', newFlower)
    console.log('Registro insertado exitosamente')

    console.log('\nVerificando insercion...')
    const updatedFlowers = await connector.readSheet('flowers')
    const lastFlower = updatedFlowers[updatedFlowers.length - 1]
    
    console.log('Ultima fila insertada:')
    console.log(lastFlower)

    console.log('\nTODAS LAS PRUEBAS PASARON')
    console.log(`
Conexion exitosa a Google Sheets
Lectura de datos funcionando
Escritura de datos funcionando
Total de flores: ${updatedFlowers.length}
    `)

  } catch (error) {
    console.error('\nERROR EN LAS PRUEBAS:')
    console.error(error.message)
    
    if (error.message.includes('API key not valid')) {
      console.error('\nVerifica que tu GOOGLE_API_KEY en .env sea correcta')
    }
    
    if (error.message.includes('not found')) {
      console.error('\nVerifica que:')
      console.error('   1. Tu SPREADSHEET_ID en .env sea correcto')
      console.error('   2. El sheet sea publico o compartido con tu API key')
      console.error('   3. La hoja "flowers" exista en tu spreadsheet')
    }

    if (error.message.includes('The caller does not have permission')) {
      console.error('\nCompartí el spreadsheet con el email de la service account')
    }

    process.exit(1)
  }
}

testSheetsConnection()