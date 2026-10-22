import { z } from "zod"

export const CATEGORY_IDS = [
  "important",
  "cold_outreach",
  "newsletter",
  "promotion",
  "notification",
  "billing",
  "spam",
] as const

export type Category = (typeof CATEGORY_IDS)[number]

export const categorySchema = z.enum(CATEGORY_IDS)

export const CATEGORIES: Record<
  Category,
  { title: string; description: string; dot: string; text: string; chip: string }
> = {
  important: {
    title: "Important",
    description:
      "Written by a real person to the user specifically, and worth their attention: colleagues, customers, partners, friends, replies in conversations the user started, or anything that needs a decision or reply. Includes legitimate inbound requests from people the user already works with.",
    dot: "bg-sky-400",
    text: "text-sky-600 dark:text-sky-300",
    chip: "bg-sky-500/12 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  cold_outreach: {
    title: "Cold outreach",
    description:
      "Unsolicited pitches from people or companies with no existing relationship: sales prospecting, agencies offering services (SEO, design, dev, lead gen), guest-post or link-building offers, sponsorship or review offers, partnership or collaboration requests, recruiters, and automated follow-up sequences. Personalized wording or flattery does not make it Important.",
    dot: "bg-orange-400",
    text: "text-orange-600 dark:text-orange-300",
    chip: "bg-orange-500/12 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  newsletter: {
    title: "Newsletters",
    description:
      "Editorial content the user subscribed to: newsletters, digests, blog roundups, community updates, product changelogs written as articles.",
    dot: "bg-violet-400",
    text: "text-violet-600 dark:text-violet-300",
    chip: "bg-violet-500/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  promotion: {
    title: "Promotions",
    description:
      "Marketing from companies or products the user has used or signed up for: offers, discounts, launches, webinars, upgrade nudges, feature announcements, review requests.",
    dot: "bg-pink-400",
    text: "text-pink-600 dark:text-pink-300",
    chip: "bg-pink-500/12 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  },
  notification: {
    title: "Notifications",
    description:
      "Automated messages about the user's own accounts and activity: sign-in codes, security alerts, account changes, platform activity, confirmations, status updates, system alerts.",
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    chip: "bg-slate-400/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
  },
  billing: {
    title: "Billing",
    description: "Receipts, invoices, payment confirmations or failures, subscription renewals, payouts and refunds.",
    dot: "bg-emerald-400",
    text: "text-emerald-600 dark:text-emerald-300",
    chip: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  spam: {
    title: "Spam",
    description:
      "Scams, phishing, deceptive or malicious messages, fake invoices or security warnings, and irrelevant bulk junk the user never signed up for.",
    dot: "bg-red-400",
    text: "text-red-600 dark:text-red-300",
    chip: "bg-red-500/12 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
}

export function isCategory(value: string | null | undefined): value is Category {
  return CATEGORY_IDS.includes(value as Category)
}
