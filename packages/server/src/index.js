import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import SheetsConnector from './core/SheetsConnector.js'
import queryRoutes from './routes/query.js'
import CacheManager from './core/Cache.js'

// Inicializar cache
const cacheManager = new CacheManager({
  ttl: 300,      // 5 minutos
  enabled: true
})


// Cargar variables de entorno
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

//guardar en app.locals
app.locals.cacheManager = cacheManager

const sheetsConnector = new SheetsConnector(
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  process.env.SPREADSHEET_ID
)

//guardar en app.locals
app.locals.sheetsConnector = sheetsConnector

console.log('Inicializando\n')


//cors funciona para hacer requests desde otros dominio
app.use(cors())

//convertir el body de las requests a json
app.use(express.json())

//imprimir las requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.url}`)
  next()
})

//ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'SheetsBase API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      query: 'POST /api/query',
      insert: 'POST /api/insert',
      update: 'PUT /api/update',
      delete: 'DELETE /api/delete',
      health: 'GET /health'
    }
  })
})

//ruta health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

app.use('/api', queryRoutes)

//ruta 404,pagina no encontrada
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.url,
    availableEndpoints: [
      'POST /api/query',
      'POST /api/insert',
      'PUT /api/update',
      'DELETE /api/delete'
    ]
  })
})

// error general
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err)
  res.status(500).json({
    error: 'Error en el servidor',
    message: err.message
  })
})


app.listen(PORT, () => {
  console.log(`

                                     
 SheetsBase Running                                              
 http://localhost:${PORT}         
                                       
  Endpoints disponibles:           
  • POST   /api/query                 
  • POST   /api/insert                
  • PUT    /api/update                
  • DELETE /api/delete                
  • GET    /health                    
                                       
  `)
})