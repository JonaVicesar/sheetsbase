/**
 * Genera IDs unicos para los registros
 */
class IdGenerator {
  /**
   * Genera un UUID v4
   * @returns {string}
   */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Genera un ID corto de 16 caracteres
   * @returns {string}
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
   * Genera un ID con timestamp para ordenar por fecha de creacion
   * @returns {string}
   */
  static generateTimestampId() {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 10)
    return `${timestamp}_${random}`
  }

  /**
   * Genera un ID legible con prefijo y fecha
   * @param {string} prefix - prefijo del ID
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
   * Verifica si un ID ya existe en los registros
   * @param {Array} records - registros existentes
   * @param {string} id - ID a verificar
   * @returns {boolean}
   */
  static checkIdExists(records, id) {
    return records.some(record => record.id === id)
  }

  /**
   * Genera un ID unico garantizado verificando que no exista
   * @param {Array} existingRecords - registros existentes
   * @param {string} type - tipo de ID: uuid, short, timestamp, readable
   * @param {string} prefix - prefijo para IDs tipo readable
   * @returns {string}
   */
  static generateUniqueId(existingRecords = [], type = 'uuid', prefix = 'item') {
    let id
    let attempts = 0
    const maxAttempts = 10

    do {
      switch (type) {
        case 'uuid':      id = this.generateUUID(); break
        case 'short':     id = this.generateShortId(); break
        case 'timestamp': id = this.generateTimestampId(); break
        case 'readable':  id = this.generateReadableId(prefix); break
        default:          id = this.generateUUID()
      }

      attempts++

      if (attempts >= maxAttempts && this.checkIdExists(existingRecords, id)) {
        id = `${id}_${Date.now()}`
        break
      }

    } while (this.checkIdExists(existingRecords, id))

    return id
  }
}

export default IdGenerator