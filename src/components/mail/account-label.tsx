import { textClass } from "@/lib/account-colors"
import { cn } from "@/lib/utils"

export function AccountLabel({ label, color, className }: { label: string; color: string; className?: string }) {
  return <span className={cn("truncate text-xs font-medium", textClass(color), className)}>{label}</span>
}
