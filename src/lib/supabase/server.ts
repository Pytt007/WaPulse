import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { executeQuery } from './mock-db-server'

// This is a local-dev server-side mock that mimics the Supabase client shape.
// The query builder intentionally uses broad types because it proxies
// arbitrary table schemas — suppress `no-explicit-any` for the whole file.
/* eslint-disable @typescript-eslint/no-explicit-any */

interface QueryFilter {
  col: string
  op: string
  val: unknown
}

export class ServerMockQueryBuilder {
  private tableName: string
  private filters: QueryFilter[] = []
  private orderCol: string | null = null
  private orderAsc = true
  private rangeStart?: number
  private rangeEnd?: number
  private limitCount?: number
  private isSingle = false
  private isMaybeSingle = false
  private isHead = false
  private data: unknown = null
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(_fields?: string, options?: { count?: string; head?: boolean }) {
    if (options?.head) this.isHead = true
    return this
  }

  insert(data: unknown) {
    this.data = data
    this.action = 'insert'
    return this
  }

  upsert(data: unknown, _options?: unknown) {
    this.data = data
    this.action = 'insert'
    return this
  }

  update(data: unknown) {
    this.data = data
    this.action = 'update'
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, op: 'eq', val })
    return this
  }

  neq(col: string, val: unknown) {
    this.filters.push({ col, op: 'neq', val })
    return this
  }

  gte(col: string, val: unknown) {
    this.filters.push({ col, op: 'gte', val })
    return this
  }

  lte(col: string, val: unknown) {
    this.filters.push({ col, op: 'lte', val })
    return this
  }

  gt(col: string, val: unknown) {
    this.filters.push({ col, op: 'gt', val })
    return this
  }

  lt(col: string, val: unknown) {
    this.filters.push({ col, op: 'lt', val })
    return this
  }

  in(col: string, val: unknown[]) {
    this.filters.push({ col, op: 'in', val })
    return this
  }

  or(val: string) {
    this.filters.push({ col: '', op: 'or', val })
    return this
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col
    this.orderAsc = options?.ascending ?? true
    return this
  }

  range(start: number, end: number) {
    this.rangeStart = start
    this.rangeEnd = end
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    return this
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const result = await executeQuery({
        tableName: this.tableName,
        action: this.action,
        filters: this.filters,
        orderCol: this.orderCol,
        orderAsc: this.orderAsc,
        rangeStart: this.rangeStart,
        rangeEnd: this.rangeEnd,
        limitCount: this.limitCount,
        isSingle: this.isSingle,
        isMaybeSingle: this.isMaybeSingle,
        isHead: this.isHead,
        data: this.data,
      })
      if (onfulfilled) return onfulfilled(result)
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const errorResult = { data: null, error: { message }, count: 0 }
      if (onrejected) return onrejected(err)
      return errorResult
    }
  }
}

const mockAuth = {
  async getUser() {
    const cookieStore = await cookies()
    const hasSession = cookieStore.has('sb-mock-session')
    if (hasSession) {
      return {
        data: {
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'user@example.com',
            user_metadata: { full_name: 'Jean Dupont' },
          },
        },
        error: null,
      }
    }
    return { data: { user: null }, error: null }
  },

  async getSession() {
    const cookieStore = await cookies()
    const hasSession = cookieStore.has('sb-mock-session')
    if (hasSession) {
      return {
        data: {
          session: {
            user: {
              id: '00000000-0000-0000-0000-000000000000',
              email: 'user@example.com',
            },
          },
        },
        error: null,
      }
    }
    return { data: { session: null }, error: null }
  },

  async signInWithPassword({ email }: { email: string }) {
    const cookieStore = await cookies()
    cookieStore.set('sb-mock-session', 'true', { path: '/', maxAge: 86400 })
    return {
      data: {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: email || 'user@example.com',
        },
      },
      error: null,
    }
  },

  async signUp({ email }: { email: string }) {
    const cookieStore = await cookies()
    cookieStore.set('sb-mock-session', 'true', { path: '/', maxAge: 86400 })
    return {
      data: {
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: email || 'user@example.com',
        },
      },
      error: null,
    }
  },

  onAuthStateChange(_callback: (event: string, session: unknown) => void) {
    // Server components don't listen to auth state changes.
    return {
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    }
  },

  async signOut() {
    const cookieStore = await cookies()
    cookieStore.delete('sb-mock-session')
    return { error: null }
  },
}

const mockClient = {
  from(tableName: string) {
    return new ServerMockQueryBuilder(tableName)
  },
  auth: mockAuth,
  channel(_channelName: string) {
    return {
      on(_event: string, _filter: unknown, _callback: unknown) {
        return this
      },
      subscribe(_callback?: unknown) {
        return this
      },
      unsubscribe() {
        return this
      },
    }
  },
  removeChannel(_channel: unknown) {
    return Promise.resolve({ error: null })
  },
}

export async function createClient() {
  return mockClient as unknown as SupabaseClient
}
