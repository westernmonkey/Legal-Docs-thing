export function FeedRow({ line }) {
  if (line.kind === 'live') {
    return (
      <div className="mb-2 whitespace-pre-wrap break-words text-[#666]">
        {line.text}
      </div>
    )
  }

  if (line.kind === 'parse') {
    return (
      <div className="mb-2 break-words text-[#9a9a9a]">{`> ${line.text}`}</div>
    )
  }

  if (line.kind === 'read') {
    return (
      <div className="mb-2">
        <div className="text-[#777]">{`> ${line.text}`}</div>
        <div className="mt-1 h-px w-full overflow-hidden bg-[#1a1a1a]">
          <div
            className="h-px bg-[#FF6B00]/50 transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, line.readProgress || 0))}%` }}
          />
        </div>
      </div>
    )
  }

  const color =
    line.kind === 'scan' || line.kind === 'detect'
      ? 'text-[#777]'
      : line.kind === 'search'
        ? 'text-[#FF6B00]'
        : line.kind === 'retrieve'
          ? 'text-[#cc5a00]'
          : line.kind === 'flag' && line.flagLevel === 'critical'
            ? 'text-[#c45c4a]'
            : line.kind === 'flag'
              ? 'text-[#a67a3a]'
              : line.kind === 'complete'
                ? 'text-[#b87333]'
                : 'text-[#777]'

  return (
    <div className={`mb-2 break-words ${color}`}>{`> ${line.text}`}</div>
  )
}
