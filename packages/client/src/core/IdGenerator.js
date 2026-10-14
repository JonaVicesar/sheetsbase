/**
 * Generates unique IDs for records.
 */
class IdGenerator {
  /** @returns {string} a UUID v4 */
  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /** @returns {string} a 16-char [a-z0-9] ID */
  static generateShortId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = ''
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
  }

  /** @returns {string} `timestamp_random`, sortable by creation time */
  static generateTimestampId() {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 10)
    return `${timestamp}_${random}`
  }

  /** @returns {string} `prefix-YYYY-MM-DD-random` */
  static generateReadableId(prefix = 'item') {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.random().toString(36).substring(2, 6)
    return `${prefix}-${year}-${month}-${day}-${random}`
  }

  static checkIdExists(records, id) {
    return records.some(record => record.id === id)
  }

  /**
   * Generates a unique ID, re-rolling until it doesn't collide with `existingRecords`.
   * @param {Array} existingRecords
   * @param {string} type - 'uuid' | 'short' | 'timestamp' | 'readable'
   * @param {string} prefix - for 'readable' IDs
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
