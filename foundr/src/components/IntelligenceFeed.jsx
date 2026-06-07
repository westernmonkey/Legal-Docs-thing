import { FeedRow } from './FeedRow.jsx'

/** Standalone terminal column (optional); main UI uses `RagPipelineView` + `FeedRow`. */
export default function IntelligenceFeed({ lines }) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden border-x border-[#161616] bg-[#060606] foundr-scanlines">
      <div className="relative z-[2] flex h-full min-h-0 flex-col px-4 pb-4 pt-3">
        <div className="shrink-0 font-mono text-[10px] tracking-[0.28em] text-[#666]">
          LOG / <span className="text-[#FF6B00]">stream</span>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2 font-mono text-[12px] leading-relaxed">
          {lines.map((l) => (
            <FeedRow key={l.id} line={l} />
          ))}
          <div className="text-[#555]">
            <span className="foundr-cursor-blink">█</span>
          </div>
        </div>
      </div>
    </div>
  )
}
