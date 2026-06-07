const COLOR_CLASS = {
  red: 'foundr-highlight-red',
  yellow: 'foundr-highlight-yellow',
  blue: 'foundr-highlight-blue',
}

const RANK = { red: 3, yellow: 2, blue: 1 }

/**
 * @param {string} text
 * @param {Array<{ phrase: string, highlight_color?: string }>} concepts
 * @returns {Array<{ type: 'text' | 'hit', value: string, className?: string }>}
 */
export function buildHighlightSegments(text, concepts = []) {
  if (!text) return [{ type: 'text', value: '' }]
  const n = text.length
  const winClass = Array(n).fill(null)
  const winRank = Array(n).fill(0)

  for (const c of concepts) {
    const phrase = (c.phrase || '').trim()
    if (!phrase) continue
    const color = (c.highlight_color || 'yellow').toLowerCase()
    const className = COLOR_CLASS[color] || COLOR_CLASS.yellow
    const rank = RANK[color] ?? RANK.yellow
    const lower = text.toLowerCase()
    const p = phrase.toLowerCase()
    let idx = 0
    while (true) {
      const i = lower.indexOf(p, idx)
      if (i === -1) break
      const end = Math.min(n, i + phrase.length)
      for (let j = i; j < end; j++) {
        if (rank >= winRank[j]) {
          winRank[j] = rank
          winClass[j] = className
        }
      }
      idx = i + Math.max(1, phrase.length)
    }
  }

  const out = []
  let i = 0
  while (i < n) {
    const cls = winClass[i]
    if (!cls) {
      let j = i
      while (j < n && !winClass[j]) j++
      out.push({ type: 'text', value: text.slice(i, j) })
      i = j
      continue
    }
    let j = i
    while (j < n && winClass[j] === cls) j++
    out.push({ type: 'hit', value: text.slice(i, j), className: cls })
    i = j
  }
  if (out.length === 0) out.push({ type: 'text', value: text })
  return out
}
