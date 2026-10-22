import { CATEGORIES } from "@/lib/categories"
import type { Category } from "@/lib/categories"
import { cn } from "@/lib/utils"
import { CATEGORY_ICONS } from "./category-icon"

export function CategoryPill({ category, className }: { category: Category; className?: string }) {
  const { title, chip } = CATEGORIES[category]
  const CategoryGlyph = CATEGORY_ICONS[category]
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] leading-none font-medium whitespace-nowrap",
        chip,
        className,
      )}
    >
      <CategoryGlyph className="size-3 shrink-0 stroke-2" />
      {title}
    </span>
  )
}
