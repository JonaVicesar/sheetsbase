import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@sheetsbase/client'

dotenv.config()

console.log('===========================================')
console.log('Starting Coffee Shop Server...')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('PORT:', process.env.PORT)
console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID ? 'SET' : 'MISSING')
console.log('GOOGLE_SERVICE_ACCOUNT_FILE:', process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
console.log('===========================================')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

// inicializar cliente de sheetsbase
const db = createClient({
  serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  spreadsheetId: process.env.SPREADSHEET_ID
})

app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

app.use(express.static(path.join(__dirname, 'src')))

// servir el dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'))
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// query
app.post('/api/query', async (req, res) => {
  try {
    const { table, filters = [], select = '*', order, limit } = req.body

    let q = db.from(table).select(select)
    filters.forEach(f => { q = q[f.op](f.field, f.value) })
    if (order) q = q.order(order.field, order.direction)
    if (limit) q = q.limit(limit)

    const data = await q.execute()
    res.json({ success: true, data, count: data.length })

  } catch (error) {
    console.error('Error en /api/query:', error.message)
    res.status(400).json({ success: false, error: error.message })
  }
})

// insert
app.post('/api/insert', async (req, res) => {
  try {
    const { table, data, idConfig } = req.body
    const result = await db.insert(table, data, { idConfig })
    res.json(result)

  } catch (error) {
    console.error('Error en /api/insert:', error.message)
    res.status(400).json({ success: false, error: error.message })
  }
})

// update
app.put('/api/update', async (req, res) => {
  try {
    const { table, id, data } = req.body
    const result = await db.update(table, id, data)
    res.json(result)

  } catch (error) {
    console.error('Error en /api/update:', error.message)
    res.status(400).json({ success: false, error: error.message })
  }
})

// delete
app.delete('/api/delete', async (req, res) => {
  try {
    const { table, id } = req.body
    const result = await db.delete(table, id)
    res.json(result)

  } catch (error) {
    console.error('Error en /api/delete:', error.message)
    res.status(400).json({ success: false, error: error.message })
  }
})

// cache stats
app.get('/api/cache/stats', (req, res) => {
  res.json({ success: true, stats: db.getCacheStats() })
})

// cache clear
app.post('/api/cache/clear', (req, res) => {
  try {
    const { table } = req.body
    db.clearCache(table)
    res.json({ success: true, message: table ? `Cache limpiado para: ${table}` : 'Cache completamente limpiado' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Error en el servidor', message: err.message })
})

console.log('About to start server on port:', PORT)

app.listen(PORT, () => {
  console.log(`
☕ Coffee Shop Dashboard
http://localhost:${PORT}
Spreadsheet: ${process.env.SPREADSHEET_ID}
  `)
})