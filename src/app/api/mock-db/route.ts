import { NextResponse } from 'next/server'
import { executeQuery, type QueryRequest } from '@/lib/supabase/mock-db-server'

export async function POST(request: Request) {
  try {
    const body: QueryRequest = await request.json()
    const result = await executeQuery(body)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error in mock-db API route:', err)
    return NextResponse.json(
      { data: null, error: { message: err.message || 'Internal Server Error' }, count: 0 },
      { status: 500 }
    )
  }
}
