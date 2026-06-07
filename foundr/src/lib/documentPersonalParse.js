import { createMessage, extractJsonObject, extractTextBlocks } from './anthropic'

const MAX_CONTENT = 28_000

const SYSTEM = `You are a legal document analyst. You receive:
1) A founder's own description of their startup situation (their words).
2) Retrieved text about a legal document, official form, employer policy, filing, or regulatory guidance. The text may be excerpts, summaries, bullet points, or quoted clauses from web retrieval — treat it as the only evidence.

Task: determine what **specific personal information, private identifiers, or individual-specific particulars** the founder would need to gather or disclose to complete, sign, file, or comply with this document or process.

Rules:
- Ground every item in the retrieved text. If the text does not imply a field, omit it — do not invent typical fields unless clearly implied.
- "personal_information_required" includes government IDs, tax IDs, full legal names, DOB, home/mailing address, personal email/phone, bank details, spouse/domestic partner where relevant, citizenship, compensation, equity numbers tied to a person, etc.
- "non_personal_information_required" includes entity-only items (company legal name, state of incorporation) unless they are clearly tied to a natural person in the text.
- sensitivity must be one of: "standard_pii" | "sensitive_pii" | "financial" | "identifiers" | "minimal_contact" | "other"

Output ONLY valid JSON:
{
  "document_identity": {
    "title_guess": "short label for what this material is",
    "document_nature": "agreement | form | statute_summary | policy | other"
  },
  "personal_information_required": [
    {
      "field_label": "human-readable label",
      "why_needed": "one sentence tied to the retrieved content",
      "sensitivity": "standard_pii",
      "source_basis": "what in the text implies this (paraphrase, no invention)"
    }
  ],
  "non_personal_information_required": [
    { "item": "string", "why_needed": "string" }
  ],
  "ambiguities": [ "string — only if evidence is thin" ]
}`

/**
 * Second-pass analysis: no web search — parses retrieved material for PII / personal particulars.
 */
export async function analyzeDocumentPersonalRequirements(situation, documentLabel, retrievedContent) {
  const body =
    (retrievedContent || '').length > MAX_CONTENT
      ? `${(retrievedContent || '').slice(0, MAX_CONTENT)}\n\n[CONTENT TRUNCATED FOR ANALYSIS]`
      : retrievedContent || ''

  const user = `FOUNDER SITUATION (verbatim):\n${situation}\n\nDOCUMENT / SEARCH FOCUS:\n${documentLabel}\n\nRETRIEVED MATERIAL TO ANALYZE:\n---\n${body}\n---\n\nReturn JSON as specified.`

  const msg = await createMessage({
    max_tokens: 4096,
    temperature: 0.1,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  })

  try {
    return extractJsonObject(extractTextBlocks(msg))
  } catch {
    return {
      document_identity: {
        title_guess: documentLabel,
        document_nature: 'other',
      },
      personal_information_required: [],
      non_personal_information_required: [],
      ambiguities: ['Structured parse unavailable for this retrieval.'],
    }
  }
}

export function mergeRequiredInfoLists(synthesisList, personalFields, nonPersonalItems) {
  const seen = new Set()
  const out = []

  const push = (s) => {
    const k = s.toLowerCase().trim()
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push(s)
  }

  for (const p of personalFields || []) {
    const label = (p.field_label || '').trim()
    if (!label) continue
    const why = (p.why_needed || '').trim()
    const sens = (p.sensitivity || '').trim()
    push(why ? `${label} (${sens}): ${why}` : `${label} (${sens})`)
  }

  for (const n of nonPersonalItems || []) {
    const it = (n.item || '').trim()
    if (!it) continue
    const why = (n.why_needed || '').trim()
    push(why ? `${it}: ${why}` : it)
  }

  for (const s of synthesisList || []) {
    if (typeof s === 'string') push(s)
  }

  return out.length ? out : synthesisList || []
}
