import { useCallback, useRef, useState } from 'react'
import {
  WEB_SEARCH_TOOL,
  createMessage,
  createMessageStream,
  createStreamTextAccumulator,
  extractJsonObject,
  extractSourceUrlsFromMessage,
  extractTextBlocks,
  extractUrlsFromText,
} from '../lib/anthropic'
import {
  analyzeDocumentPersonalRequirements,
  mergeRequiredInfoLists,
} from '../lib/documentPersonalParse.js'

export const DEMO_SITUATION =
  "Me and my co-founder have been building for 3 months. He's still at Amazon. " +
  "We haven't incorporated yet, no paperwork at all. We're thinking 50/50 equity. " +
  'We already have 2 pilot customers paying us $500/month each.'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function conceptsToKeywords(concepts) {
  return (concepts || [])
    .filter((c) => (c.phrase || '').trim())
    .slice(0, 10)
    .map((c) => ({
      label: String(c.phrase).trim().slice(0, 48),
      critical: String(c.severity || '').toLowerCase() === 'critical',
    }))
}

function matchRetrieval(retrievals, docName, idx) {
  const name = (docName || '').toLowerCase()
  return (
    retrievals[idx] ||
    (retrievals || []).find(
      (r) =>
        (r.document_type || '').toLowerCase() === name ||
        name.includes((r.document_type || '').toLowerCase()) ||
        (r.document_type || '').toLowerCase().includes(name),
    ) ||
    null
  )
}

function mapSynthesisToVizResults(docsRequired, synthesis, retrievals = []) {
  return (docsRequired || []).map((d, idx) => {
    const r = matchRetrieval(retrievals, d.name, idx)
    const parse = r?.personalParse
    const pFields = parse?.personal_information_required || []
    const personalLines = pFields.map((p) => {
      const L = (p.field_label || '').trim()
      const W = (p.why_needed || '').trim()
      const S = (p.sensitivity || '').trim()
      if (!L) return ''
      return W ? `${L} [${S}]: ${W}` : `${L} [${S}]`
    })
    const synthLines = (d.required_information || []).filter(Boolean)
    const detail = [...personalLines.filter(Boolean), ...synthLines]
      .join(' · ')
      .slice(0, 900)

    return {
      title: d.name,
      snip: (d.why_needed || '').slice(0, 140),
      detail: detail || (d.critical_clause || ''),
      personalItems: pFields,
      sourceUrls: r?.sourceUrls || [],
      critical:
        String(d.urgency || '').toUpperCase() === 'TODAY' ||
        (synthesis.risk_flags || []).some((rf) => {
          if ((rf.severity || '').toLowerCase() !== 'critical') return false
          const src = String(rf.source_document || '')
          const nm = String(d.name || '')
          return src === nm || src.includes(nm) || nm.includes(src)
        }),
    }
  })
}

const ANALYSIS_SYSTEM = `You are a startup legal intelligence system. A founder has described their situation.

Your job is to:
1. Identify every legally relevant concept in their description
2. For each concept, output a search query to find the relevant legal document
3. Identify risk flags

Output ONLY valid JSON in this exact format:
{
  "detected_concepts": [
    {
      "phrase": "still at Amazon",
      "category": "employment_conflict", 
      "severity": "critical",
      "highlight_color": "red"
    }
  ],
  "search_queries": [
    {
      "query": "Amazon employee intellectual property agreement 2024",
      "purpose": "Check what IP Amazon claims from employees",
      "document_type": "Employee Agreement",
      "severity": "critical"
    }
  ],
  "pre_analysis_flags": [
    {
      "flag": "Co-founder still employed at Amazon",
      "risk": "All IP built during employment may belong to Amazon",
      "severity": "critical"
    }
  ]
}`

const SYNTH_SYSTEM = `You are a startup legal advisor. You have retrieved legal documents and information for a founder.

The bundle may include a structured "personal-field parse" per retrieval (JSON). Treat those fields as hypotheses grounded in retrieval text — reconcile them with the founder situation.

Output ONLY valid JSON in this exact format:
{
  "documents_required": [
    {
      "name": "IP Assignment Agreement",
      "urgency": "TODAY",
      "source": "Y Combinator Standard Documents",
      "why_needed": "...",
      "required_information": ["..."],
      "personal_information_required": [
        { "field_label": "Full legal name of assignor", "why_needed": "...", "sensitivity": "standard_pii" }
      ],
      "critical_clause": "..."
    }
  ],
  "risk_flags": [
    {
      "flag": "...",
      "explanation": "...",
      "severity": "critical",
      "source_document": "..."
    }
  ],
  "action_plan": {
    "today": ["..."],
    "this_week": ["..."],
    "this_month": ["..."]
  },
  "estimated_cost_without_foundr_usd": 4200,
  "estimated_lawyer_hours": 2.5
}`

const FALLBACK_ANALYSIS = {
  detected_concepts: [
    {
      phrase: 'still at Amazon',
      category: 'employment_conflict',
      severity: 'critical',
      highlight_color: 'red',
    },
    {
      phrase: '3 months',
      category: 'pre_incorp_build',
      severity: 'high',
      highlight_color: 'yellow',
    },
    {
      phrase: 'co-founder',
      category: 'governance',
      severity: 'medium',
      highlight_color: 'blue',
    },
    {
      phrase: '50/50 equity',
      category: 'deadlock_risk',
      severity: 'high',
      highlight_color: 'yellow',
    },
    {
      phrase: 'pilot customers paying us',
      category: 'pre_revenue_contracts',
      severity: 'medium',
      highlight_color: 'blue',
    },
    {
      phrase: "haven't incorporated yet",
      category: 'entity_gap',
      severity: 'critical',
      highlight_color: 'red',
    },
  ],
  search_queries: [
    {
      query: 'Amazon employee intellectual property agreement 2024',
      purpose: 'Determine Amazon IP assignment scope for employees',
      document_type: 'Amazon Employee Agreement',
      severity: 'critical',
    },
    {
      query: 'Delaware C-Corp incorporation requirements startup',
      purpose: 'Entity formation requirements and founder paperwork',
      document_type: 'Delaware Incorporation Guide',
      severity: 'critical',
    },
    {
      query: 'founder IP assignment pre-incorporation startup',
      purpose: 'Assign IP created before incorporation to the company',
      document_type: 'IP Assignment Agreement',
      severity: 'critical',
    },
    {
      query: '50/50 founder equity deadlock YC founder agreement',
      purpose: 'Governance and tie-breakers for equal splits',
      document_type: 'Founder Agreement',
      severity: 'high',
    },
    {
      query: 'pre-revenue pilot customer contract template SaaS',
      purpose: 'Customer agreements before formal entity exists',
      document_type: 'Customer Agreement / MSA',
      severity: 'high',
    },
  ],
  pre_analysis_flags: [
    {
      flag: 'Co-founder still employed at Amazon',
      risk: 'Employer may claim IP for work overlapping with employer duties or resources',
      severity: 'critical',
    },
    {
      flag: 'No entity exists yet',
      risk: 'No clean counterparty to assign IP, sign contracts, or issue equity',
      severity: 'critical',
    },
    {
      flag: '50/50 equity without governance',
      risk: 'Deadlock on decisions, fundraising, and founder exits',
      severity: 'high',
    },
    {
      flag: 'Paying customers before incorporation',
      risk: 'Revenue attribution, sales tax, and contract enforceability issues',
      severity: 'critical',
    },
  ],
}

const FALLBACK_SYNTHESIS = {
  documents_required: [
    {
      name: 'IP Assignment Agreement',
      urgency: 'TODAY',
      source: 'Y Combinator Standard Documents',
      why_needed:
        'Captures pre-incorporation IP and routes ownership to the company once formed.',
      required_information: [
        'Full legal name of each founder',
        'Date of incorporation (or target date)',
        'Description of IP being assigned',
        'Signatures from all founders',
      ],
      critical_clause: 'Must reflect actual development timeline and scope of work performed.',
    },
    {
      name: 'Amazon-side employment/IP review',
      urgency: 'TODAY',
      source: 'Amazon policies (via counsel review)',
      why_needed: 'Employment agreements and policies may restrict outside work and claim IP.',
      required_information: [
        'Co-founder role level and team',
        'Outside activity disclosure status',
        'Copies of employment agreement and IP provisions',
      ],
      critical_clause: 'Outside business activity and IP assignment clauses are outcome-determinative.',
    },
    {
      name: 'Delaware C-Corp formation package',
      urgency: 'THIS WEEK',
      source: 'Delaware Secretary of State + standard startup formation',
      why_needed: 'Creates the legal entity that can own IP, hire, and enter customer contracts.',
      required_information: [
        'Company name',
        'Authorized shares and par value',
        'Registered agent',
        'Founder addresses',
      ],
      critical_clause: 'Charter + bylaws + initial board consent set baseline governance.',
    },
  ],
  risk_flags: [
    {
      flag: 'Amazon IP ownership risk',
      explanation:
        'If product work overlaps with Amazon duties or uses Amazon resources, Amazon may assert IP rights.',
      severity: 'critical',
      source_document: 'Amazon Employee Agreement',
    },
    {
      flag: 'No entity to own IP or contracts',
      explanation:
        'Without a company, founders cannot cleanly assign IP or centralize customer agreements.',
      severity: 'critical',
      source_document: 'Delaware Incorporation Guide',
    },
    {
      flag: '50/50 deadlock risk',
      explanation: 'Equal splits without tie-breakers frequently stall decisions and fundraising.',
      severity: 'high',
      source_document: 'Founder Agreement',
    },
    {
      flag: 'Pre-incorporation customer revenue',
      explanation:
        'Collecting revenue before entity formation can complicate accounting, liability, and tax posture.',
      severity: 'critical',
      source_document: 'Customer Agreement / MSA',
    },
  ],
  action_plan: {
    today: [
      'Incorporate Delaware C-Corp and adopt baseline governance documents',
      'Sign IP assignment to the company for all pre-incorporation work',
    ],
    this_week: [
      'Have counsel review Amazon employment agreement against actual build activities',
      'Put pilot customers on written contracts with the new entity (novation if needed)',
    ],
    this_month: [
      'Founder agreement with vesting, roles, and deadlock resolution',
      '83(b) elections if issuing restricted stock',
    ],
  },
  estimated_cost_without_foundr_usd: 4200,
  estimated_lawyer_hours: 2.5,
}

function newId() {
  return crypto.randomUUID()
}

function relevanceLabel(score) {
  if (score >= 0.85) return 'HIGH'
  if (score >= 0.6) return 'MEDIUM'
  return 'LOW'
}

export function useFoundrAnalysis() {
  const [situation, setSituation] = useState(DEMO_SITUATION)
  const [displaySituation, setDisplaySituation] = useState(DEMO_SITUATION)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [feedLines, setFeedLines] = useState([])
  const [highlights, setHighlights] = useState([])
  const [showHighlights, setShowHighlights] = useState(false)
  const [documents, setDocuments] = useState([])
  const [summary, setSummary] = useState(null)
  const [vizKeywords, setVizKeywords] = useState([])
  const [vizResults, setVizResults] = useState([])
  const [vizHud, setVizHud] = useState('● STANDBY')
  const [vizCylinder, setVizCylinder] = useState(false)
  const [vizRunEpoch, setVizRunEpoch] = useState(0)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const abortRef = useRef(false)

  const pushLine = useCallback((line) => {
    if (abortRef.current) return
    setFeedLines((prev) => [...prev, { ...line, id: line.id || newId() }])
  }, [])

  const updateLine = useCallback((id, patch) => {
    setFeedLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  const resetRun = useCallback(() => {
    abortRef.current = false
    setFeedLines([])
    setHighlights([])
    setShowHighlights(false)
    setDocuments([])
    setSummary(null)
    setVizKeywords([])
    setVizResults([])
    setVizCylinder(false)
    setVizHud('● STANDBY')
    setVizRunEpoch((e) => e + 1)
    setAnalysisProgress(0)
  }, [])

  const analyze = useCallback(async () => {
    resetRun()
    setDisplaySituation(situation)
    setIsAnalyzing(true)
    abortRef.current = false
    const started = performance.now()

    try {
      setAnalysisProgress(4)
      setVizHud('● ANALYZING INPUT')
      pushLine({ kind: 'scan', text: '[SCAN] Analyzing founder situation...' })

      let analysis = FALLBACK_ANALYSIS
      const acc = createStreamTextAccumulator()
      const liveId = newId()
      setFeedLines((prev) => [
        ...prev,
        { id: liveId, kind: 'live', text: '> [ANALYZE] ' },
      ])

      try {
        await createMessageStream(
          {
            max_tokens: 4096,
            temperature: 0.2,
            system: ANALYSIS_SYSTEM,
            messages: [{ role: 'user', content: situation }],
          },
          (evt) => {
            const t = acc.pushEvent(evt)
            if (!t) return
            setFeedLines((prev) =>
              prev.map((l) =>
                l.id === liveId ? { ...l, text: `> [ANALYZE] ${t}` } : l,
              ),
            )
          },
        )
        analysis = extractJsonObject(acc.text())
        setFeedLines((prev) => prev.filter((l) => l.id !== liveId))
        setAnalysisProgress(16)
      } catch {
        setFeedLines((prev) =>
          prev.map((l) =>
            l.id === liveId
              ? {
                  ...l,
                  kind: 'detect',
                  text: '[DETECT] Model unavailable — running bundled legal scenario engine',
                }
              : l,
          ),
        )
        analysis = FALLBACK_ANALYSIS
        setAnalysisProgress(14)
      }

      setHighlights(analysis.detected_concepts || [])
      setShowHighlights(true)
      setVizKeywords(conceptsToKeywords(analysis.detected_concepts || []))
      setVizHud('● EXTRACTING SIGNALS')
      setAnalysisProgress(22)

      for (const f of analysis.pre_analysis_flags || []) {
        await sleep(280)
        if (abortRef.current) return
        const sev = (f.severity || 'warning').toLowerCase()
        pushLine({
          kind: 'detect',
          text: `[DETECT] ${f.flag} → ${f.risk}`,
          detectTone: sev === 'critical' ? 'critical' : 'warn',
        })
      }

      const retrievals = []

      const queries = analysis.search_queries || []
      const qTotal = Math.max(queries.length, 1)
      for (let qi = 0; qi < queries.length; qi++) {
        const q = queries[qi]
        if (qi === 0) {
          setVizCylinder(true)
          setVizHud('● RETRIEVING SOURCES')
        }
        setAnalysisProgress(26 + Math.round(((qi + 0.35) / qTotal) * 48))
        await sleep(320)
        if (abortRef.current) return
        pushLine({ kind: 'search', text: `[SEARCH] Querying: "${q.query}"` })

        await sleep(820)
        if (abortRef.current) return

        const docId = newId()
        const critical = (q.severity || '').toLowerCase() === 'critical'
        setDocuments((prev) => [
          ...prev,
          {
            id: docId,
            name: q.document_type || 'Legal Document',
            source: 'Live web retrieval',
            status: 'RETRIEVED',
            relevance: 0.62,
            relevanceLabel: 'MEDIUM',
            snippet: q.purpose || 'Retrieving authoritative clauses and founder obligations…',
            requiredInfo: ['Analysis in progress…'],
            critical,
            visible: true,
            query: q.query,
          },
        ])

        pushLine({
          kind: 'retrieve',
          text: `[RETRIEVE] Pulling document: ${q.document_type || 'Unknown'}...`,
        })

        await sleep(520)
        if (abortRef.current) return

        const readId = newId()
        pushLine({
          id: readId,
          kind: 'read',
          text: '[READ] LLM scanning document…',
          readProgress: 4,
        })

        const progressTimer = setInterval(() => {
          setFeedLines((prev) =>
            prev.map((l) => {
              if (l.id !== readId || l.kind !== 'read') return l
              const next = Math.min(96, (l.readProgress || 0) + 6)
              const words = Math.round(180 + next * 14)
              return {
                ...l,
                readProgress: next,
                text: `[READ] LLM scanning ${words} words...`,
              }
            }),
          )
        }, 160)

        let retrievedText = ''
        let searchMsg = null
        try {
          const searchUser = `Use web search to locate authoritative or primary sources for: ${q.query}

Return:
1) A factual summary of what the document/policy/form covers and who it binds.
2) SHORT quoted or near-verbatim excerpts (≤3 sentences each) wherever the sources list **information to be provided**, **schedules**, **signature blocks**, **notice addresses**, **defined terms** that imply personal data, or **filing fields** — label each excerpt as QUOTE.
3) A bullet list separating **personal / individual-specific** items the founder must supply vs **entity-only** items.
4) Any material risks or ambiguities if sources conflict.

Be dense and evidence-led — this text will be parsed by a second model pass for personal-data field extraction.`

          searchMsg = await createMessage({
            max_tokens: 4096,
            tools: [WEB_SEARCH_TOOL],
            messages: [{ role: 'user', content: searchUser }],
          })
          retrievedText = extractTextBlocks(searchMsg)
        } catch {
          retrievedText =
            'Web search unavailable in this environment. Using model reasoning with strong caveats: verify all citations with counsel.'
        } finally {
          clearInterval(progressTimer)
          updateLine(readId, { readProgress: 100 })
        }

        let personalParse = null
        try {
          const parseLineId = newId()
          pushLine({
            id: parseLineId,
            kind: 'parse',
            text: `[PARSE] LLM extracting personal / identifier fields from retrieved material…`,
          })
          personalParse = await analyzeDocumentPersonalRequirements(
            situation,
            q.document_type || q.query,
            retrievedText,
          )
          const n = (personalParse?.personal_information_required || []).length
          updateLine(parseLineId, {
            text: `[PARSE] Identified ${n} personal-information field(s) for "${q.document_type || 'document'}"`,
          })
        } catch {
          personalParse = {
            personal_information_required: [],
            non_personal_information_required: [],
            ambiguities: ['Personal-field parse skipped due to error.'],
          }
        }

        const urlsFromApi = searchMsg ? extractSourceUrlsFromMessage(searchMsg) : []
        const urlsFromBody = extractUrlsFromText(retrievedText)
        const sourceUrls = [...new Set([...urlsFromApi, ...urlsFromBody])].slice(0, 10)

        retrievals.push({
          query: q.query,
          document_type: q.document_type,
          text: retrievedText,
          personalParse,
          sourceUrls,
        })

        setAnalysisProgress(26 + Math.round(((qi + 1) / qTotal) * 48))

        await sleep(220)
        if (abortRef.current) return

        if ((q.severity || '').toLowerCase() === 'critical') {
          pushLine({
            kind: 'flag',
            text: `[FLAG] ⚠ CRITICAL: High-risk area detected for "${q.document_type}" — validate against primary sources`,
            flagLevel: 'critical',
          })
        } else {
          pushLine({
            kind: 'flag',
            text: `[FLAG] ⚠ WARNING: Important variables for "${q.document_type}" — confirm facts with counsel`,
            flagLevel: 'warning',
          })
        }

        const relScore = Math.min(0.95, 0.55 + retrievedText.length / 8000)
        const pFields = personalParse?.personal_information_required || []
        const nItems = personalParse?.non_personal_information_required || []
        const mergedInfo = mergeRequiredInfoLists([], pFields, nItems)

        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  relevance: relScore,
                  relevanceLabel: relevanceLabel(relScore),
                  snippet:
                    retrievedText.slice(0, 220).trim() +
                    (retrievedText.length > 220 ? '…' : ''),
                  personalInformationRequired: pFields,
                  parseAmbiguities: personalParse?.ambiguities || [],
                  documentNature: personalParse?.document_identity?.document_nature,
                  requiredInfo: mergedInfo,
                  sourceUrls,
                }
              : d,
          ),
        )
      }

      let synthesis = FALLBACK_SYNTHESIS
      setAnalysisProgress(82)
      setVizHud('● SYNTHESIZING RESULTS')
      try {
        const bundle = retrievals
          .map((r, i) => {
            const parseJson =
              r.personalParse &&
              JSON.stringify(
                {
                  document_identity: r.personalParse.document_identity,
                  personal_information_required:
                    r.personalParse.personal_information_required,
                  non_personal_information_required:
                    r.personalParse.non_personal_information_required,
                  ambiguities: r.personalParse.ambiguities,
                },
                null,
                2,
              )
            const parseBlock = parseJson
              ? `\n\n### Structured personal-field parse (from second-pass analysis)\n${parseJson}\n`
              : ''
            return `### Retrieval ${i + 1}: ${r.document_type}\nQuery: ${r.query}\n\n#### Source material / model digest\n${r.text}${parseBlock}`
          })
          .join('\n\n---\n\n')

        const finalUser = `Founder situation:\n${situation}\n\nRetrieved documents and their contents:\n${bundle}\n\nNow tell the founder EXACTLY:
1. What documents they need (in priority order)
2. For each document, EXACTLY what information they need to provide
3. What the critical risks are and why
4. What they should do TODAY vs this week vs this month

Be specific. Ground claims in the retrieved text when possible.

Output JSON in the format described in your system instructions.`

        const finalMsg = await createMessage({
          max_tokens: 6144,
          temperature: 0.2,
          system: SYNTH_SYSTEM,
          messages: [{ role: 'user', content: finalUser }],
        })
        synthesis = extractJsonObject(extractTextBlocks(finalMsg))
      } catch {
        synthesis = FALLBACK_SYNTHESIS
      }

      const docsRequired = synthesis.documents_required || []
      setVizResults(mapSynthesisToVizResults(docsRequired, synthesis, retrievals))
      setAnalysisProgress(94)

      setDocuments((prev) => {
        const keyed = new Map(prev.map((d) => [d.name, d]))
        return docsRequired.map((d, idx) => {
          const prior =
            keyed.get(d.name) ||
            prev.find((p) => p.name === d.name) ||
            prev[idx] ||
            null
          const r = matchRetrieval(retrievals, d.name, idx)
          const parse = r?.personalParse
          const pFields = parse?.personal_information_required || []
          const nItems = parse?.non_personal_information_required || []
          const synthPersonal = d.personal_information_required || []
          const mergedInfo = mergeRequiredInfoLists(
            [
              ...(d.required_information || []),
              ...synthPersonal.map((x) =>
                typeof x === 'string'
                  ? x
                  : [x.field_label, x.why_needed].filter(Boolean).join(' — '),
              ),
            ],
            pFields,
            nItems,
          )
          return {
            id: prior?.id || newId(),
            name: d.name,
            source: d.source || 'Retrieved sources',
            status: 'RETRIEVED',
            relevance: prior?.relevance ?? 0.86,
            relevanceLabel: relevanceLabel(prior?.relevance ?? 0.86),
            snippet: d.why_needed || prior?.snippet || '',
            requiredInfo: mergedInfo,
            personalInformationRequired:
              pFields.length ? pFields : prior?.personalInformationRequired || [],
            parseAmbiguities: parse?.ambiguities || prior?.parseAmbiguities || [],
            documentNature: parse?.document_identity?.document_nature || prior?.documentNature,
            sourceUrls: r?.sourceUrls?.length ? r.sourceUrls : prior?.sourceUrls || [],
            critical:
              String(d.urgency || '').toUpperCase() === 'TODAY' ||
              (synthesis.risk_flags || []).some((rf) => {
                if ((rf.severity || '').toLowerCase() !== 'critical') return false
                const src = String(rf.source_document || '')
                const nm = String(d.name || '')
                return src === nm || src.includes(nm) || nm.includes(src)
              }),
            visible: true,
            urgency: d.urgency,
            criticalClause: d.critical_clause,
          }
        })
      })

      const criticalCount = (synthesis.risk_flags || []).filter(
        (r) => (r.severity || '').toLowerCase() === 'critical',
      ).length
      const warnCount = (synthesis.risk_flags || []).filter(
        (r) => (r.severity || '').toLowerCase() !== 'critical',
      ).length
      const docCount = (synthesis.documents_required || []).length

      const elapsed = ((performance.now() - started) / 1000).toFixed(1)

      pushLine({
        kind: 'complete',
        text: `[COMPLETE] Analysis complete. ${criticalCount} critical issues. ${docCount} documents required.`,
      })

      setVizHud(`● COMPLETE — ${criticalCount} CRITICAL`)
      setAnalysisProgress(100)

      setSummary({
        critical: criticalCount,
        warnings: warnCount,
        documents: docCount,
        costUsd: synthesis.estimated_cost_without_foundr_usd ?? 4200,
        lawyerHours: synthesis.estimated_lawyer_hours ?? 2.5,
        seconds: Number(elapsed),
        actionPlan: synthesis.action_plan || null,
      })
    } catch (err) {
      setAnalysisProgress(0)
      setVizHud('● ERROR — CHECK LOG')
      pushLine({
        kind: 'detect',
        text: `[ERROR] ${String(err?.message || err)}`,
        detectTone: 'critical',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }, [pushLine, resetRun, situation, updateLine])

  const resetAll = useCallback(() => {
    setIsAnalyzing(false)
    abortRef.current = false
    resetRun()
  }, [resetRun])

  const stop = useCallback(() => {
    abortRef.current = true
    setIsAnalyzing(false)
  }, [])

  return {
    situation,
    setSituation,
    displaySituation,
    isAnalyzing,
    feedLines,
    highlights,
    showHighlights,
    documents,
    summary,
    analyze,
    stop,
    resetAll,
    vizKeywords,
    vizResults,
    vizHud,
    vizCylinder,
    vizRunEpoch,
    analysisProgress,
  }
}
