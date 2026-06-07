export default function SummaryCard({ summary }) {
  if (!summary) return null

  return (
    <div className="mt-3 shrink-0 border border-[#1f1f1f] bg-[#0c0c0c] px-3 py-3 font-mono text-[11px] text-[#888]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[#666]">Run summary</div>
      <div className="mt-2 space-y-1.5 text-[#a3a3a3]">
        <div>
          <span className="text-[#555]">flags </span>
          {summary.critical} critical · {summary.warnings} other
        </div>
        <div>
          <span className="text-[#555]">docs </span>
          {summary.documents}
        </div>
        <div>
          <span className="text-[#555]">est. counsel </span>
          <span className="text-[#c4c4c4]">
            ${summary.costUsd.toLocaleString()}
          </span>
          <span className="text-[#555]"> · </span>
          {summary.lawyerHours}h
        </div>
        <div>
          <span className="text-[#555]">elapsed </span>
          <span className="text-[#FF6B00]/90">{summary.seconds}s</span>
        </div>
      </div>
    </div>
  )
}
