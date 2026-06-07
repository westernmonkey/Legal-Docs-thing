const BASE = '/api/anthropic'

export const FOUNDR_MODEL = 'claude-sonnet-4-20250514'

export const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
}

async function readErrorMessage(res) {
  const t = await res.text()
  try {
    const j = JSON.parse(t)
    return j?.error?.message || j?.message || t
  } catch {
    return t || res.statusText
  }
}

export async function createMessage(body) {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: FOUNDR_MODEL, ...body }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export async function createMessageStream(body, onEvent) {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: FOUNDR_MODEL, stream: true, ...body }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep
    while ((sep = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, sep).trimEnd()
      buffer = buffer.slice(sep + 1)
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        onEvent(JSON.parse(payload))
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }
}

/** Incrementally extracts assistant text from Anthropic message stream events. */
export function createStreamTextAccumulator() {
  let text = ''
  return {
    pushEvent(evt) {
      if (evt?.type === 'content_block_delta' && evt?.delta?.type === 'text_delta') {
        text += evt.delta.text || ''
      }
      return text
    },
    text() {
      return text
    },
  }
}

export function extractTextBlocks(message) {
  if (!message?.content) return ''
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

export function extractJsonObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object found in model output')
  return JSON.parse(text.slice(start, end + 1))
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"')]+/gi

/** Pull http(s) links from plain text (e.g. retrieval body, citations). */
export function extractUrlsFromText(text) {
  if (!text) return []
  const found = new Set()
  let m
  const s = String(text)
  URL_IN_TEXT.lastIndex = 0
  while ((m = URL_IN_TEXT.exec(s)) !== null) {
    let u = m[0].replace(/[),.;:]+$/g, '')
    if (u.length > 2000) u = u.slice(0, 2000)
    try {
      const parsed = new URL(u)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') found.add(u)
    } catch {
      /* skip */
    }
  }
  return [...found]
}

/** Extract URLs from full Messages API response (text + tool/citation blocks). */
export function extractSourceUrlsFromMessage(message) {
  const found = new Set()
  const scan = (v) => {
    if (!v) return
    if (typeof v === 'string') {
      extractUrlsFromText(v).forEach((u) => found.add(u))
      return
    }
    if (Array.isArray(v)) {
      v.forEach(scan)
      return
    }
    if (typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (/url|href|link|uri|source/i.test(k) && typeof v[k] === 'string') {
          extractUrlsFromText(v[k]).forEach((u) => found.add(u))
        }
      }
      for (const k of Object.keys(v)) scan(v[k])
    }
  }
  try {
    scan(message?.content)
  } catch {
    /* ignore */
  }
  return [...found].slice(0, 12)
}
