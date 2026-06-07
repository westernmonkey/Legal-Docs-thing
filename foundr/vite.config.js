/* global Buffer, process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Proxies Anthropic API during dev/preview so the key stays off the client and CORS is avoided. */
function anthropicProxy(mode) {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || ''
      if (!url.startsWith('/api/anthropic')) return next()

      const env = loadEnv(mode, process.cwd(), '')
      const apiKey =
        env.VITE_ANTHROPIC_API_KEY ||
        env.ANTHROPIC_API_KEY ||
        process.env.VITE_ANTHROPIC_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        ''

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Anthropic-Version, Anthropic-Beta',
        })
        res.end()
        return
      }

      if (req.method !== 'POST') return next()

      const pathPart = url.replace(/^\/api\/anthropic/, '')
      const body = await new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
      })

      try {
        const upstream = await fetch(`https://api.anthropic.com${pathPart}`, {
          method: 'POST',
          headers: {
            'content-type': req.headers['content-type'] || 'application/json',
            'anthropic-version':
              req.headers['anthropic-version'] || '2023-06-01',
            'x-api-key': apiKey,
            ...(req.headers['anthropic-beta'] && {
              'anthropic-beta': String(req.headers['anthropic-beta']),
            }),
          },
          body,
        })

        res.statusCode = upstream.status
        const ct = upstream.headers.get('content-type')
        if (ct) res.setHeader('Content-Type', ct)
        res.setHeader('Access-Control-Allow-Origin', '*')

        if (!upstream.body) {
          res.end(await upstream.text())
          return
        }

        const reader = upstream.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
        res.end()
      } catch (err) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: String(err?.message || err) }))
      }
    })
  }

  return {
    name: 'foundr-anthropic-proxy',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), anthropicProxy(mode)],
}))
