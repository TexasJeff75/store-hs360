import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'vite'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
}

function sendJson(res: any, statusCode: number, data: any) {
  res.writeHead(statusCode, CORS_HEADERS)
  res.end(JSON.stringify(data))
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

function handleGqlProxy(env: Record<string, string>) {
  return async (req: any, res: any) => {
    const body = await readBody(req)
    try {
      const requestBody = JSON.parse(body)
      const BC_STORE_HASH = env.VITE_BC_STORE_HASH || env.BC_STORE_HASH
      const BC_STOREFRONT_TOKEN = env.VITE_BC_STOREFRONT_TOKEN || env.BC_STOREFRONT_TOKEN

      if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
        sendJson(res, 500, { errors: [{ message: 'Missing BigCommerce credentials' }] })
        return
      }

      const ENDPOINT = `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BC_STOREFRONT_TOKEN}`
        },
        body: JSON.stringify(requestBody)
      })

      const responseText = await response.text()
      res.writeHead(response.status, {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=60'
      })
      res.end(responseText)
    } catch (error) {
      sendJson(res, 500, { errors: [{ message: 'Internal server error' }] })
    }
  }
}

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_AUTH_BASE_URL = 'https://appcenter.intuit.com/connect/oauth2'

function getQBConfig(env: Record<string, string>) {
  const clientId = env.QB_CLIENT_ID || env.VITE_QB_CLIENT_ID
  const clientSecret = env.QB_CLIENT_SECRET || env.VITE_QB_CLIENT_SECRET
  const redirectUri = env.QB_REDIRECT_URI || env.VITE_QB_REDIRECT_URI
  return { clientId, clientSecret, redirectUri }
}

async function authenticateUser(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized')
  }
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const supabase = createClient(supabaseUrl, supabaseKey)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('Unauthorized')
  return { supabase, user }
}

function handleQuickBooksOAuth(env: Record<string, string>) {
  return async (req: any, res: any) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const action = url.searchParams.get('action')

    try {
      const { supabase, user } = await authenticateUser(req.headers.authorization)
      const { clientId, clientSecret, redirectUri } = getQBConfig(env)

      if (!clientId || !clientSecret || !redirectUri) {
        sendJson(res, 500, { error: 'QuickBooks credentials not configured' })
        return
      }

      let body: any = {}
      if (req.method === 'POST') {
        const raw = await readBody(req)
        if (raw) body = JSON.parse(raw)
      }

      if (action === 'authorize') {
        const scope = 'com.intuit.quickbooks.accounting com.intuit.quickbooks.payment'
        const state = crypto.randomUUID()

        await supabase.from('quickbooks_credentials').upsert({
          realm_id: `pending_${state.substring(0, 8)}`,
          access_token: 'pending',
          refresh_token: 'pending',
          token_expires_at: new Date().toISOString(),
          is_active: false,
          connected_by: user.id,
          metadata: { state, pending: true }
        })

        const params = new URLSearchParams({
          client_id: clientId,
          scope,
          redirect_uri: redirectUri,
          response_type: 'code',
          state
        })

        sendJson(res, 200, { url: `${QB_AUTH_BASE_URL}?${params.toString()}` })
      } else if (action === 'exchange') {
        const { code, realmId, state } = body
        if (!code || !realmId || !state) {
          sendJson(res, 400, { error: 'Missing required parameters' })
          return
        }

        const { data: pendingCreds } = await supabase
          .from('quickbooks_credentials')
          .select('*')
          .eq('connected_by', user.id)
          .eq('is_active', false)
          .order('created_at', { ascending: false })
          .limit(10)

        const matchingCred = pendingCreds?.find((c: any) => c.metadata?.state === state && c.metadata?.pending === true)
        if (!matchingCred) {
          sendJson(res, 400, { error: 'Invalid state parameter' })
          return
        }

        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const tokenResponse = await fetch(QB_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`
          },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
        })

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          sendJson(res, 500, { error: `Token exchange failed: ${errorText}` })
          return
        }

        const tokenData = await tokenResponse.json()
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

        await supabase.from('quickbooks_credentials').update({ is_active: false }).eq('is_active', true)
        await supabase.from('quickbooks_credentials').delete().eq('id', matchingCred.id)

        const { data: credentials, error: insertError } = await supabase
          .from('quickbooks_credentials')
          .insert({
            realm_id: realmId,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            is_active: true,
            connected_by: user.id,
            last_refresh_at: new Date().toISOString(),
            metadata: { token_type: tokenData.token_type, refresh_token_expires_in: tokenData.x_refresh_token_expires_in }
          })
          .select()
          .single()

        if (insertError) throw insertError
        sendJson(res, 200, { success: true, credentials })
      } else if (action === 'refresh') {
        const { credentialsId } = body
        if (!credentialsId) { sendJson(res, 400, { error: 'Missing credentialsId' }); return }

        const { data: creds } = await supabase.from('quickbooks_credentials').select('*').eq('id', credentialsId).single()
        if (!creds) { sendJson(res, 404, { error: 'Credentials not found' }); return }

        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const tokenResponse = await fetch(QB_TOKEN_URL, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creds.refresh_token })
        })

        if (!tokenResponse.ok) {
          sendJson(res, 500, { error: `Token refresh failed: ${await tokenResponse.text()}` })
          return
        }

        const tokenData = await tokenResponse.json()
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

        const { data: updated, error: updateError } = await supabase
          .from('quickbooks_credentials')
          .update({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, token_expires_at: expiresAt.toISOString(), last_refresh_at: new Date().toISOString() })
          .eq('id', credentialsId)
          .select()
          .single()

        if (updateError) throw updateError
        sendJson(res, 200, { success: true, credentials: updated })
      } else if (action === 'disconnect') {
        const { credentialsId } = body
        if (!credentialsId) { sendJson(res, 400, { error: 'Missing credentialsId' }); return }
        const { error } = await supabase.from('quickbooks_credentials').update({ is_active: false }).eq('id', credentialsId)
        if (error) throw error
        sendJson(res, 200, { success: true })
      } else {
        sendJson(res, 400, { error: `Invalid action: ${action}` })
      }
    } catch (error: any) {
      sendJson(res, error.message === 'Unauthorized' ? 401 : 500, { error: error.message })
    }
  }
}

function netlifyFunctionsPlugin(env: Record<string, string>) {
  return {
    name: 'netlify-functions-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = req.url?.split('?')[0]

        if (req.method === 'OPTIONS' && (pathname === '/.netlify/functions/gql' || pathname === '/.netlify/functions/quickbooks-oauth')) {
          res.writeHead(200, CORS_HEADERS)
          res.end()
          return
        }

        if (pathname === '/.netlify/functions/gql' && req.method === 'POST') {
          await handleGqlProxy(env)(req, res)
          return
        }

        if (pathname === '/.netlify/functions/quickbooks-oauth') {
          await handleQuickBooksOAuth(env)(req, res)
          return
        }

        next()
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [react(), netlifyFunctionsPlugin(env)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      external: []
    }
  },
  server: {
    host: true,
    port: 3000,
    strictPort: false
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true
  },
  define: {
    'import.meta.env.VITE_BC_STORE_HASH': JSON.stringify(env.VITE_BC_STORE_HASH),
    'import.meta.env.VITE_BC_STOREFRONT_TOKEN': JSON.stringify(env.VITE_BC_STOREFRONT_TOKEN),
    'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || '/.netlify/functions'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
  },
  }
})