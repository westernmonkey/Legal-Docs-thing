import { useMemo } from 'react'
import { buildHighlightSegments } from '../utils/highlighter'

export default function FounderInput({
  situation,
  setSituation,
  onAnalyze,
  disabled,
  highlights,
  showHighlights,
  displaySituation,
}) {
  const segments = useMemo(
    () => buildHighlightSegments(displaySituation, highlights),
    [displaySituation, highlights],
  )

  const laserKey = showHighlights
    ? `${displaySituation}::${highlights.map((h) => h.phrase).join('|')}`
    : 'idle'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0A0A] px-5 pb-5 pt-4">
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-[0.22em] text-[#666]">
          INPUT / <span className="text-[#FF6B00]">situation</span>
        </div>
        <div className="mt-2 font-['DM_Sans'] text-xs text-[#666]">
          Plain language is fine.
        </div>
      </div>

      <textarea
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        disabled={disabled}
        placeholder={
          "e.g. Me and my co-founder have been building for 3 months. He's still at Amazon. We haven't incorporated yet..."
        }
        className="h-44 min-h-44 w-full resize-none rounded-sm border border-[#1f1f1f] bg-[#0c0c0c] px-3 py-3 font-['DM_Sans'] text-sm leading-relaxed text-[#e8e8e8] outline-none ring-0 placeholder:text-[#4a4a4a] focus:border-[#FF6B00]/35 disabled:opacity-60"
      />

      <button
        type="button"
        disabled={disabled || !situation.trim()}
        onClick={onAnalyze}
        className="mt-4 h-10 w-full rounded-sm bg-[#FF6B00] font-mono text-xs font-medium tracking-[0.12em] text-black transition hover:bg-[#e65f00] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Analyze
      </button>

      {showHighlights && (
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[#555]">
            PARSED / <span className="text-[#888]">highlights</span>
          </div>
          <div className="relative mt-3 rounded-sm border border-[#1f1f1f] bg-[#0c0c0c] p-3">
            <div key={laserKey} className="foundr-laser-line" />
            <div className="relative z-[1] font-['DM_Sans'] text-sm leading-relaxed text-[#F5F5F5]">
              {segments.map((s, idx) =>
                s.type === 'hit' ? (
                  <span key={idx} className={s.className}>
                    {s.value}
                  </span>
                ) : (
                  <span key={idx}>{s.value}</span>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
