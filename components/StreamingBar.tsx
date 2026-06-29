'use client'

interface Props {
  label: string
  description: string
  totalStreamed: number
  percentage: number
  color: string
  isStreaming: boolean
  onHoldStart: () => void
  onHoldEnd: () => void
  disabled: boolean
}

export default function StreamingBar({
  label,
  description,
  totalStreamed,
  percentage,
  color,
  isStreaming,
  onHoldStart,
  onHoldEnd,
  disabled,
}: Props) {
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-white">{label}</span>
        <span className="shrink-0 font-mono text-xs text-zinc-400">
          {totalStreamed.toFixed(4)} USDC ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="mb-1 text-xs text-zinc-500">{description}</div>
      <button
        className="relative h-12 w-full touch-none select-none overflow-hidden rounded-xl border bg-zinc-800/60 transition-all"
        style={{
          borderColor: isStreaming ? color : 'rgba(255,255,255,0.1)',
          animation: isStreaming ? 'pulse-green 1s infinite' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
        onMouseDown={disabled ? undefined : onHoldStart}
        onMouseUp={onHoldEnd}
        onMouseLeave={onHoldEnd}
        onTouchStart={disabled ? undefined : onHoldStart}
        onTouchEnd={onHoldEnd}
        onTouchCancel={onHoldEnd}
        disabled={disabled}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-200"
          style={{
            width: `${Math.min(100, percentage)}%`,
            backgroundColor: color,
            opacity: 0.3,
          }}
        />
        <span className="relative z-10 text-xs font-semibold uppercase tracking-wider text-white">
          {isStreaming ? 'STREAMING...' : 'HOLD TO STREAM'}
        </span>
      </button>
    </div>
  )
}
