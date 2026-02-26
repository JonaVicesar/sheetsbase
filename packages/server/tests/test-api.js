const API_URL = 'http://localhost:3000'

// HELPER: Hacer request
async function request(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_URL}${endpoint}`, options)
  return response.json()
}

// PRUEBAS
async function runTests() {
  console.log('Iniciando pruebas del API REST\n')

  try {
    
    // Primera Prueba: Health check
    console.log('\nPrimera Prueba: GET /health')

    const health = await request('GET', '/health')
    console.log('Response:', health)

    // Segunda Prueba: Query simple (SELECT *)
    console.log('\nSegunda Prueba: POST /api/query - SELECT *')

    const query1 = await request('POST', '/api/query', {
      table: 'flowers',
      select: '*'
    })
    console.log('Response:', JSON.stringify(query1, null, 2))

    // Tercera Prueba: Query con filtros
    console.log('\nTercera Prueba: Query con filtro WHERE type = "test"')

    const query2 = await request('POST', '/api/query', {
      table: 'flowers',
      select: 'name, country, type',
      filters: [
        { field: 'type', op: 'eq', value: 'test' }
      ]
    })
    console.log('Response:', JSON.stringify(query2, null, 2))

    // Cuarta Prueba: Query con orden y límite
    console.log('\nCuarta Prueba: Query con ORDER BY y LIMIT')
   
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    const query3 = await request('POST', '/api/query', {
      table: 'flowers',
      select: 'name, country',
      order: { field: 'name', direction: 'asc' },
      limit: 3
    })
    console.log('Response:', JSON.stringify(query3, null, 2))

    // Quinta Prueba: INSERT
      console.log('\nQuinta Prueba: POST /api/insert')

    const insert = await request('POST', '/api/insert', {
      table: 'flowers',
      data: {
        id: `test-${Date.now()}`,
        name: 'Flor desde API',
        country: 'API Country',
        type: 'api-test'
      }
    })
    console.log('Response:', JSON.stringify(insert, null, 2))

    // Sexta Prueba}: UPDATE
    console.log('\nSexta Prueba: PUT /api/update')

    const update = await request('PUT', '/api/update', {
      table: 'flowers',
      id: '999',
      data: {
        name: 'Flor ACTUALIZADA desde API',
        country: 'Updated Country'
      }
    })
    console.log('Response:', JSON.stringify(update, null, 2))

    // Septima Prueba Query compleja
    console.log('\nSeptima Prueba: Query compleja (múltiples filtros)')

    const query4 = await request('POST', '/api/query', {
      table: 'flowers',
      select: '*',
      filters: [
        { field: 'name', op: 'like', value: 'Flor' }
      ],
      order: { field: 'created_at', direction: 'desc' },
      limit: 5
    })
    console.log('Response:', JSON.stringify(query4, null, 2))

    console.log('\nTODAS LAS PRUEBAS COMPLETADAS!')
    
  } catch (error) {
    console.error('\nERROR en las pruebas:')
    console.error(error.message)
  }
}

runTests()