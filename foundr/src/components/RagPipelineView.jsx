import { useCallback, useEffect, useRef, useState } from 'react'
import RagPipelineCanvas from './RagPipelineCanvas.jsx'
import { FeedRow } from './FeedRow.jsx'

export default function RagPipelineView({
  feedLines,
  vizHud,
  vizKeywords,
  vizResults,
  vizCylinder,
  vizRunEpoch,
  analysisProgress = 0,
  summary,
  onReset,
  showReset,
}) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [showResultPanel, setShowResultPanel] = useState(false)

  const handleReveal = useCallback(() => {
    setShowResultPanel(true)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const hudClass =
    vizHud.includes('COMPLETE')
      ? 'text-[#00ff88]'
      : vizHud.includes('STANDBY') || vizHud.includes('ANALYZING INPUT')
        ? 'text-[#333]'
        : 'text-[#ff6b00]'

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#060608] font-mono"
    >
      {size.w > 0 && size.h > 0 && (
        <RagPipelineCanvas
          width={size.w}
          height={size.h}
          keywords={vizKeywords}
          results={vizResults}
          cylinderOn={vizCylinder}
          runEpoch={vizRunEpoch}
          onRevealResults={handleReveal}
        />
      )}

      <div
        className={`pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 text-[8.5px] tracking-[0.3em] transition-colors duration-300 ${hudClass}`}
      >
        {vizHud}
      </div>

      <div className="pointer-events-none absolute left-4 right-4 top-8 z-20">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#141414]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#cc5500] to-[#ff6b00] transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, analysisProgress))}%` }}
          />
        </div>
        <div className="mt-0.5 text-center font-mono text-[7px] tracking-[0.2em] text-[#555]">
          PIPELINE {Math.round(analysisProgress)}%
        </div>
      </div>

      <div
        className={`absolute bottom-0 right-0 top-0 z-10 flex w-[230px] flex-col justify-start overflow-y-auto border-l border-[#111] bg-[#060608]/90 px-4 pb-16 pt-16 transition-opacity duration-500 ${
          showResultPanel && vizResults.length
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <h3 className="border-b border-[#111] pb-2 text-[8px] font-normal tracking-[0.3em] text-[#ff6b00]">
          WHAT YOU NEED
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          {vizResults.map((r, i) => (
            <ResultRow key={`${r.title}-${i}`} item={r} index={i} visible={showResultPanel} />
          ))}
        </div>
        {summary && showResultPanel ? (
          <div className="mt-4 border-t border-[#111] pt-3 font-mono text-[9px] leading-relaxed text-[#666]">
            <div>
              <span className="text-[#444]">flags </span>
              {summary.critical} critical · {summary.warnings} other
            </div>
            <div className="mt-1">
              <span className="text-[#444]">est. </span>
              <span className="text-[#aaa]">${summary.costUsd.toLocaleString()}</span>
              <span className="text-[#444]"> · </span>
              {summary.lawyerHours}h
            </div>
            <div className="mt-1 text-[#ff6b00]/80">{summary.seconds}s elapsed</div>
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-3 left-3 z-10 max-h-[34%] w-[min(420px,42%)] overflow-y-auto rounded-sm border border-[#1a1a1a] bg-[#070707]/88 px-2 py-2 backdrop-blur-sm">
        <div className="mb-1 text-[8px] tracking-[0.2em] text-[#555]">LOG</div>
        <div className="text-[11px] leading-relaxed">
          {feedLines.map((l) => (
            <FeedRow key={l.id} line={l} />
          ))}
          <div className="text-[#555]">
            <span className="foundr-cursor-blink">█</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md border border-[#222] bg-transparent px-4 py-1.5 text-[9px] tracking-[0.2em] text-[#444] transition hover:border-[#ff6b00] hover:text-[#ff6b00] ${
          showReset ? 'block' : 'hidden'
        }`}
        onClick={onReset}
      >
        ↺ RESET
      </button>
    </div>
  )
}

function ResultRow({ item, index, visible }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`transition duration-300 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
      style={{ transitionDelay: visible ? `${index * 120 + 80}ms` : '0ms' }}
    >
      <button
        type="button"
        className="flex w-full gap-2 border-0 bg-transparent p-0 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`mt-0.5 h-[5px] w-[5px] shrink-0 rounded-full ${
            item.critical ? 'bg-[#ff3333]' : 'bg-[#ff6b00]'
          }`}
        />
        <span className="min-w-0 text-[10px] leading-relaxed text-[#999]">
          <span
            className={`mb-0.5 block text-[10px] font-medium ${
              item.critical ? 'text-[#ff8888]' : 'text-[#ddd]'
            }`}
          >
            {item.title}
          </span>
          {item.snip}
        </span>
      </button>
      {open && item.sourceUrls?.length ? (
        <div className="mt-1.5 pl-3 text-[8px] leading-relaxed text-[#666]">
          <div className="mb-1 font-mono tracking-[0.15em] text-[#555]">SOURCES / PDF</div>
          <p className="mb-1 text-[#555]">
            We cannot render PDFs in-app. Open links in a new tab — PDFs if the host serves them.
          </p>
          <ul className="space-y-1">
            {item.sourceUrls.map((u, k) => (
              <li key={k} className="truncate">
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ff6b00] underline decoration-[#ff6b00]/40 underline-offset-2 hover:text-[#ff8c00]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {u.includes('.pdf') ? '📎 ' : '🔗 '}
                  {u.length > 56 ? `${u.slice(0, 54)}…` : u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {open && item.personalItems?.length ? (
        <ul className="mt-2 list-none space-y-1 border-l border-[#222] pl-3 text-[9px] text-[#888]">
          {item.personalItems.map((p, j) => (
            <li key={j}>
              <span className="text-[#ff6b00]/90">{p.field_label}</span>
              {p.sensitivity ? (
                <span className="text-[#555]"> · {p.sensitivity}</span>
              ) : null}
              {p.why_needed ? (
                <span className="block text-[#666]">{p.why_needed}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <p className="mt-1 pl-3 text-[9px] leading-relaxed text-[#666]">{item.detail}</p>
      ) : null}
    </div>
  )
}
