/**
 * Every function here is called directly from the browser (student dashboard,
 * future scanning screens), so each needs CORS handling — there is no API
 * gateway in front of them doing it centrally.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // '*' rather than an enumerated list: supabase-js attaches its own headers
  // (x-client-info, x-supabase-api-version, ...) that change across versions,
  // and any header missing from an explicit list fails the whole preflight.
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

/** Call first in every handler; returns a response to send back for OPTIONS, else null. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
