import type { ComponentType } from "react"
import type { IconProps } from "@solar-icons/react"
import { StarIcon as StarBoldIcon } from "@solar-icons/react/bold"
import { StarIcon } from "@solar-icons/react/linear"
import { cn } from "@/lib/utils"

export type Icon = ComponentType<IconProps>

export function StarToggleIcon({ starred, className, ...props }: IconProps & { starred: boolean }) {
  return starred ? (
    <StarBoldIcon className={cn("text-amber-400", className)} {...props} />
  ) : (
    <StarIcon className={className} {...props} />
  )
}
