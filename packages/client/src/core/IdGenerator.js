/**
 * Genera IDs unicos  (UUID v4)
 */
class IdGenerator {
  /**
   * Genera un UUID v4
   * @returns {string} UUID v4
   */
  static generateUUID() {

    
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Genera un ID corto con 16 caracteres
   * @returns {string} Short ID
   */
  static generateShortId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = ''
    
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return id
  }

  /**
   * Genera un ID con timestamp 
   * Para ordenar por fecha de creación
   * @returns {string} Timestamp ID
   */
  static generateTimestampId() {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 10)
    return `${timestamp}_${random}`
  }

  /**
   * Genera un ID mas legible 
   * @param {string} prefix - Prefijo 
   * @returns {string}
   */
  static generateReadableId(prefix = 'item') {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.random().toString(36).substring(2, 6)
    
    return `${prefix}-${year}-${month}-${day}-${random}`
  }

  /**
   * Verifica si un ID ya existe en una tabla
   * @param {Array} records - Registros de la tabla
   * @param {string} id - ID a verificar
   * @returns {boolean} true si existe
   */
  static checkIdExists(records, id) {
    return records.some(record => record.id === id)
  }

  /**
   * Genera un ID único garantizado,verifica que no exista
   * @param {Array} existingRecords - Registros existentes
   * @param {string} type - Tipo de ID 
   * @param {string} prefix - Prefijo para IDs
   * @returns {string} ID unico
   */
  static generateUniqueId(existingRecords = [], type = 'uuid', prefix = 'item') {
    let id
    let attempts = 0
    const maxAttempts = 10
    
    do {
      // Generar ID con respecto al tipo
      switch (type) {
        case 'uuid':
          id = this.generateUUID()
          break
        case 'short':
          id = this.generateShortId()
          break
        case 'timestamp':
          id = this.generateTimestampId()
          break
        case 'readable':
          id = this.generateReadableId(prefix)
          break
        default:
          id = this.generateUUID()
      }
      
      attempts++
      
      // agrega timestamp si sigue existiendo despues de 10 intentos
      if (attempts >= maxAttempts && this.checkIdExists(existingRecords, id)) {
        id = `${id}_${Date.now()}`
        break
      }
      
    } while (this.checkIdExists(existingRecords, id))
    
    return id
  }
}

export default IdGenerator