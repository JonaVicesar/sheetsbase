import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Importar desde packages/server
import SheetsConnector from '../../packages/server/src/core/SheetsConnector.js'
import CacheManager from '../../packages/server/src/core/Cache.js'
import queryRoutes from '../../packages/server/src/routes/query.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Inicializar cache
const cacheManager = new CacheManager({
  ttl: 300,
  enabled: true
})

// Inicializar sheets connector
const sheetsConnector = new SheetsConnector(
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  process.env.SPREADSHEET_ID
)

// Guardar en app.locals
app.locals.cacheManager = cacheManager
app.locals.sheetsConnector = sheetsConnector

// Middleware
app.use(cors())
app.use(express.json())

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// Servir dashboard.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'))
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api', queryRoutes)

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Error en el servidor', message: err.message })
})

app.listen(PORT, () => {
  console.log(`
☕ Coffee Shop Dashboard
http://localhost:${PORT}

Spreadsheet: ${process.env.SPREADSHEET_ID}
  `)
})