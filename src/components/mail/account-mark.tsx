import { dotClass } from "@/lib/account-colors"
import { cn } from "@/lib/utils"

export function AccountMark({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md text-[11px] leading-none font-semibold text-black/75",
        dotClass(color),
        className,
      )}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  )
}
