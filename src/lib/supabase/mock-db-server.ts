import fs from 'fs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'supabase', 'mock-db.json')

export interface QueryFilter {
  col: string
  op: string
  val: any
}

export interface QueryRequest {
  action: 'select' | 'insert' | 'update' | 'delete'
  tableName: string
  filters?: QueryFilter[]
  orderCol?: string | null
  orderAsc?: boolean
  rangeStart?: number
  rangeEnd?: number
  limitCount?: number
  isSingle?: boolean
  isMaybeSingle?: boolean
  isHead?: boolean
  data?: any
}

function readDB(): Record<string, any[]> {
  try {
    if (!fs.existsSync(dbPath)) {
      return {}
    }
    const content = fs.readFileSync(dbPath, 'utf8')
    return JSON.parse(content)
  } catch (err) {
    console.error('Error reading mock DB:', err)
    return {}
  }
}

function writeDB(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing mock DB:', err)
  }
}

// Generate a random UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Enrich relations based on the table name
function enrichRecord(table: string, record: any, db: Record<string, any[]>): any {
  if (!record) return record
  const enriched = { ...record }

  if (table === 'messages') {
    const conv = db['conversations']?.find((c) => c.id === record.conversation_id)
    if (conv) {
      const contact = db['contacts']?.find((ct) => ct.id === conv.contact_id)
      enriched.conversations = {
        ...conv,
        contacts: contact ? [contact] : []
      }
    } else {
      enriched.conversations = null
    }
  }

  if (table === 'deals') {
    const stage = db['pipeline_stages']?.find((s) => s.id === record.stage_id)
    enriched.stage = stage || null

    const contact = db['contacts']?.find((c) => c.id === record.contact_id)
    enriched.contact = contact || null
  }

  if (table === 'automation_logs') {
    const automation = db['automations']?.find((a) => a.id === record.automation_id)
    enriched.automation = automation || null

    const contact = db['contacts']?.find((c) => c.id === record.contact_id)
    enriched.contact = contact || null
  }

  if (table === 'conversations') {
    const contact = db['contacts']?.find((c) => c.id === record.contact_id)
    enriched.contact = contact || null
  }

  if (table === 'orders') {
    const contact = db['contacts']?.find((c) => c.id === record.contact_id)
    enriched.contact = contact || null

    if (Array.isArray(record.items)) {
      enriched.items = record.items.map((item: any) => {
        const product = db['products']?.find((p) => p.id === item.product_id)
        return {
          ...item,
          product: product || null
        }
      })
    }
  }

  return enriched
}

export async function executeQuery(req: QueryRequest) {
  const db = readDB()
  const table = req.tableName

  if (!db[table]) {
    db[table] = []
  }

  let tableData = [...db[table]]

  if (req.action === 'select') {
    // 1. Apply Filters
    if (req.filters && req.filters.length > 0) {
      for (const filter of req.filters) {
        const { col, op, val } = filter
        if (op === 'eq') {
          tableData = tableData.filter((item) => item[col] === val)
        } else if (op === 'neq') {
          tableData = tableData.filter((item) => item[col] !== val)
        } else if (op === 'gte') {
          tableData = tableData.filter((item) => item[col] >= val)
        } else if (op === 'lte') {
          tableData = tableData.filter((item) => item[col] <= val)
        } else if (op === 'gt') {
          tableData = tableData.filter((item) => item[col] > val)
        } else if (op === 'lt') {
          tableData = tableData.filter((item) => item[col] < val)
        } else if (op === 'in') {
          const list = Array.isArray(val) ? val : [val]
          tableData = tableData.filter((item) => list.includes(item[col]))
        } else if (op === 'ilike') {
          const term = String(val).replace(/%/g, '').toLowerCase()
          tableData = tableData.filter((item) =>
            String(item[col] || '').toLowerCase().includes(term)
          )
        } else if (op === 'or') {
          // Format of val for or filter is comma-separated conditions, e.g. "name.ilike.%term%,phone.ilike.%term%"
          const conditions = String(val).split(',')
          tableData = tableData.filter((item) => {
            return conditions.some((cond) => {
              const [c, o, v] = cond.split('.')
              const cleanV = (v || '').replace(/%/g, '').toLowerCase()
              if (o === 'ilike') {
                return String(item[c] || '').toLowerCase().includes(cleanV)
              }
              if (o === 'eq') {
                return String(item[c]) === cleanV
              }
              return false
            })
          })
        }
      }
    }

    const totalCount = tableData.length

    // 2. Sorting
    if (req.orderCol) {
      const col = req.orderCol
      const asc = req.orderAsc !== false
      tableData.sort((a, b) => {
        const valA = a[col]
        const valB = b[col]
        if (valA === undefined || valA === null) return asc ? -1 : 1
        if (valB === undefined || valB === null) return asc ? 1 : -1
        if (valA < valB) return asc ? -1 : 1
        if (valA > valB) return asc ? 1 : -1
        return 0
      })
    }

    // 3. Slicing / Ranges
    let slicedData = tableData
    if (req.rangeStart !== undefined && req.rangeEnd !== undefined) {
      slicedData = tableData.slice(req.rangeStart, req.rangeEnd + 1)
    } else if (req.limitCount !== undefined) {
      slicedData = tableData.slice(0, req.limitCount)
    }

    // 4. Enrich relations
    const enrichedData = slicedData.map((record) => enrichRecord(table, record, db))

    if (req.isHead) {
      return { data: null, error: null, count: totalCount }
    }

    if (req.isSingle) {
      return { data: enrichedData[0] || null, error: enrichedData[0] ? null : { message: 'Row not found' }, count: enrichedData[0] ? 1 : 0 }
    }

    if (req.isMaybeSingle) {
      return { data: enrichedData[0] || null, error: null, count: enrichedData[0] ? 1 : 0 }
    }

    return { data: enrichedData, error: null, count: totalCount }
  }

  if (req.action === 'insert') {
    const rowsToInsert = Array.isArray(req.data) ? req.data : [req.data]
    const insertedRows = rowsToInsert.map((row) => {
      const newRow = {
        id: row.id || generateUUID(),
        user_id: row.user_id || '00000000-0000-0000-0000-000000000000',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row
      }
      db[table].push(newRow)
      return newRow
    })

    writeDB(db)
    const enriched = insertedRows.map((r) => enrichRecord(table, r, db))
    return { data: Array.isArray(req.data) ? enriched : enriched[0], error: null, count: enriched.length }
  }

  if (req.action === 'update') {
    // Determine which rows to update based on filters
    let rowsToUpdateIndices: number[] = []
    db[table].forEach((item, index) => {
      let matches = true
      if (req.filters && req.filters.length > 0) {
        for (const filter of req.filters) {
          const { col, op, val } = filter
          if (op === 'eq' && item[col] !== val) matches = false
          if (op === 'neq' && item[col] === val) matches = false
          if (op === 'in' && !val.includes(item[col])) matches = false
        }
      } else {
        matches = false // Do not update all if no filters provided
      }
      if (matches) {
        rowsToUpdateIndices.push(index)
      }
    })

    const updatedRows = rowsToUpdateIndices.map((idx) => {
      db[table][idx] = {
        ...db[table][idx],
        ...req.data,
        updated_at: new Date().toISOString()
      }
      return db[table][idx]
    })

    writeDB(db)
    const enriched = updatedRows.map((r) => enrichRecord(table, r, db))
    return { data: enriched, error: null, count: enriched.length }
  }

  if (req.action === 'delete') {
    let rowsToKeep: any[] = []
    let deletedRows: any[] = []

    db[table].forEach((item) => {
      let matches = true
      if (req.filters && req.filters.length > 0) {
        for (const filter of req.filters) {
          const { col, op, val } = filter
          if (op === 'eq' && item[col] !== val) matches = false
          if (op === 'neq' && item[col] === val) matches = false
          if (op === 'in' && !val.includes(item[col])) matches = false
        }
      } else {
        matches = false // Don't delete all if no filter
      }

      if (matches) {
        deletedRows.push(item)
      } else {
        rowsToKeep.push(item)
      }
    })

    db[table] = rowsToKeep
    writeDB(db)
    return { data: deletedRows, error: null, count: deletedRows.length }
  }

  return { data: null, error: { message: 'Unsupported action' }, count: 0 }
}
