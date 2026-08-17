/**
 * Helpers for Supabase Edge Function calls.
 * Surfaces the JSON `{ error }` body instead of the generic
 * "Edge Function returned a non-2xx status code" message.
 */
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'
import { supabase } from './supabase'

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export type InvokeResult<T = any> = {
  data: T | null
  error: { message: string; status?: number } | null
}

/** Read error detail from FunctionsHttpError response body when present. */
async function extractFunctionErrorMessage(error: unknown, fallbackData?: any): Promise<string> {
  if (fallbackData && typeof fallbackData === 'object' && typeof fallbackData.error === 'string') {
    return fallbackData.error
  }
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body.error === 'string' && body.error.trim()) return body.error
      if (body && typeof body.message === 'string' && body.message.trim()) return body.message
    } catch {
      /* ignore parse failures */
    }
    return error.message || 'Edge Function returned a non-2xx status code'
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

/**
 * Invoke an edge function with the project anon key as Authorization.
 * Avoids 401s from stale/invalid user JWTs during signup (pre-auth).
 */
export async function invokeEdgeFunction<T = any>(
  name: string,
  body?: Record<string, unknown>,
  opts?: { useAnonAuth?: boolean },
): Promise<InvokeResult<T>> {
  const useAnon = opts?.useAnonAuth !== false
  try {
    const result = await supabase.functions.invoke(name, {
      body,
      headers: useAnon && anonKey
        ? { Authorization: `Bearer ${anonKey}` }
        : undefined,
    })

    if (result.error) {
      const message = await extractFunctionErrorMessage(result.error, result.data)
      const status =
        result.error instanceof FunctionsHttpError
          ? (result.error.context as Response | undefined)?.status
          : undefined
      return { data: (result.data as T) ?? null, error: { message, status } }
    }

    return { data: result.data as T, error: null }
  } catch (err) {
    const message = await extractFunctionErrorMessage(err)
    return { data: null, error: { message } }
  }
}
