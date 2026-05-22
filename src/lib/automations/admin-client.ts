import { ServerMockQueryBuilder } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for automation engine work.
// Mirrors the pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts).
const mockAdminClient = {
  from(tableName: string) {
    return new ServerMockQueryBuilder(tableName)
  },
}

export function supabaseAdmin(): SupabaseClient {
  return mockAdminClient as unknown as SupabaseClient
}

