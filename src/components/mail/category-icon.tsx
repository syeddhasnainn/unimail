import {
  BellIcon,
  BillIcon,
  DocumentTextIcon,
  FlagIcon,
  HandShakeIcon,
  SaleIcon,
  ShieldWarningIcon,
} from "@solar-icons/react/linear"
import type { Icon } from "@/components/icons"
import { CATEGORIES } from "@/lib/categories"
import type { Category } from "@/lib/categories"
import { cn } from "@/lib/utils"

export const CATEGORY_ICONS: Record<Category, Icon> = {
  important: FlagIcon,
  cold_outreach: HandShakeIcon,
  newsletter: DocumentTextIcon,
  promotion: SaleIcon,
  notification: BellIcon,
  billing: BillIcon,
  spam: ShieldWarningIcon,
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const CategoryGlyph = CATEGORY_ICONS[category]
  return <CategoryGlyph className={cn("shrink-0", CATEGORIES[category].text, className)} />
}
