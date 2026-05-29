import { ServerMockQueryBuilder } from '@/lib/supabase/server'
import { executeQuery } from '../supabase/mock-db-server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for automation engine work.
// Mirrors the pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts).
const mockAdminClient = {
  from(tableName: string) {
    return new ServerMockQueryBuilder(tableName)
  },
  async rpc(fnName: string, args: any) {
    if (fnName === 'increment_automation_execution_count') {
      try {
        const { data } = await executeQuery({
          action: 'select',
          tableName: 'automations',
          filters: [{ col: 'id', op: 'eq', val: args.p_automation_id }]
        })
        if (data && data[0]) {
          const newCount = (data[0].execution_count || 0) + 1
          await executeQuery({
            action: 'update',
            tableName: 'automations',
            filters: [{ col: 'id', op: 'eq', val: args.p_automation_id }],
            data: { execution_count: newCount }
          })
        }
      } catch (err) {
        console.error('[mock rpc] failed to increment count:', err)
        return { error: err }
      }
    }
    return { error: null }
  }
}

export function supabaseAdmin(): SupabaseClient {
  return mockAdminClient as unknown as SupabaseClient
}

