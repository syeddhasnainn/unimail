const MARK_PATH = "M10 52V14L22 21V35C22 49 42 49 42 35V21L54 14V52"

export function UnimailMark({ className, strokeWidth = 5.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
