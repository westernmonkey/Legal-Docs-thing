export default function DocumentCards({ documents }) {
  if (!documents.length) {
    return (
      <div className="border border-[#1f1f1f] bg-[#0c0c0c] px-3 py-8 text-center font-mono text-xs text-[#555]">
        No documents indexed yet.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#1f1f1f] bg-[#0c0c0c]">
      <div className="shrink-0 border-b border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#666]">
        Retrieved — {documents.length} file{documents.length === 1 ? '' : 's'}
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#161616] overflow-y-auto">
        {documents.map((d, i) => (
          <article
            key={d.id}
            className="foundr-doc-row px-3 py-3 font-['DM_Sans']"
          >
            <div className="flex gap-3">
              <span className="w-7 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-[#FF6B00]/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-medium leading-snug text-[#f0f0f0]">
                  {d.name}
                </h3>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-[#5c5c5c]">
                  {d.source}
                </p>
                {d.snippet ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#8a8a8a]">
                    {d.snippet}
                  </p>
                ) : null}
                {(d.requiredInfo || []).length > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-[#6f6f6f]">
                    <span className="font-mono text-[#4a4a4a]">need </span>
                    {(d.requiredInfo || []).join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
