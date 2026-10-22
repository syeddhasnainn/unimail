import { useEffect, useRef } from "react"
import { PaperclipIcon } from "@solar-icons/react/linear"
import { StarToggleIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { formatListDate, senderName } from "@/lib/format"
import type { MessageRow } from "@/lib/mail-queries"
import { CATEGORIES } from "@/lib/categories"
import type { Category } from "@/lib/categories"
import { AccountLabel } from "./account-label"
import { CategoryIcon } from "./category-icon"
import { CategoryPill } from "./category-pill"
import { LocalDate } from "./local-date"
import { MessageContextMenu } from "./message-context-menu"
import type { MessageActions } from "./message-context-menu"

export type AccountInfo = { label: string; color: string }

type Props = {
  messages: MessageRow[]
  accounts: Map<number, AccountInfo>
  selectedId?: number
  showRecipients: boolean
  showAccount: boolean
  showCategory: boolean
  actions: MessageActions
}

export function MessageList({
  messages,
  accounts,
  selectedId,
  showRecipients,
  showAccount,
  showCategory,
  actions,
}: Props) {
  const selectedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedId === undefined) return
    selectedRef.current?.scrollIntoView({ block: "nearest" })
  }, [selectedId])

  return (
    <div role="listbox" aria-label="Messages" className="@container flex flex-col gap-px px-2 pb-2">
      {messages.map((message) => {
        const selected = message.id === selectedId
        const who = showRecipients
          ? `To: ${message.to.map((t) => t.name || t.address).join(", ") || "(no recipients)"}`
          : senderName(message.fromName, message.fromAddress)
        return (
          <MessageContextMenu key={message.id} message={message} actions={actions}>
            <div
              ref={selected ? selectedRef : undefined}
              role="option"
              aria-selected={selected}
              onClick={() => actions.open(message)}
              className={cn(
                "cursor-default rounded-lg transition-colors",
                selected
                  ? "bg-foreground/[0.08]"
                  : message.seen
                    ? "hover:bg-foreground/[0.035] data-[state=open]:bg-foreground/[0.05]"
                    : "bg-foreground/[0.04] hover:bg-foreground/[0.06] data-[state=open]:bg-foreground/[0.07]",
              )}
            >
              <Row
                message={message}
                account={showAccount ? accounts.get(message.accountId) : undefined}
                category={showCategory ? message.category : null}
                who={who}
                onToggleStar={() => actions.toggleStar(message)}
              />
            </div>
          </MessageContextMenu>
        )
      })}
    </div>
  )
}

type RowProps = {
  message: MessageRow
  account?: AccountInfo
  category: Category | null
  who: string
  onToggleStar: () => void
}

function tone(unread: boolean) {
  return unread
    ? {
        sender: "font-semibold text-foreground",
        subject: "font-medium text-foreground/90",
        snippet: "text-muted-foreground",
        date: "font-medium text-foreground/80",
        pills: "",
      }
    : {
        sender: "font-medium text-foreground/75",
        subject: "text-foreground/60",
        snippet: "text-muted-foreground/70",
        date: "text-muted-foreground/70",
        pills: "opacity-70",
      }
}

function UnreadDot({ unread }: { unread: boolean }) {
  return <span className={cn("size-[7px] shrink-0 rounded-full", unread ? "bg-unread" : "bg-transparent")} />
}

function Star({ flagged, onToggle }: { flagged: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={flagged ? "Unstar" : "Star"}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded text-muted-foreground/60 hover:text-foreground",
        !flagged && "opacity-0 group-hover/row:opacity-100",
      )}
    >
      <StarToggleIcon starred={flagged} className="size-3.5" />
    </button>
  )
}

function Row({ message, account, category, who, onToggleStar }: RowProps) {
  const unread = !message.seen
  const t = tone(unread)
  return (
    <div className="group/row flex h-11 items-center gap-2.5 pr-3 pl-3 text-sm @3xl:gap-3 @3xl:pr-4">
      <UnreadDot unread={unread} />
      {account && (
        <span className="flex w-20 shrink-0 @3xl:w-24">
          <AccountLabel label={account.label} color={account.color} className={t.pills} />
        </span>
      )}
      <span className={cn("w-28 shrink-0 truncate @3xl:w-48", t.sender)}>{who}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2.5 truncate">
        <span className={cn("min-w-0 flex-1 truncate @2xl:max-w-[65%] @2xl:flex-none", t.subject)}>
          {message.subject || "(no subject)"}
        </span>
        <span className={cn("hidden min-w-0 flex-1 truncate text-[13px] @2xl:block", t.snippet)}>
          {message.snippet}
        </span>
      </span>
      {message.hasAttachments && <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground/70" />}
      {category && (
        <>
          <CategoryPill category={category} className={cn("hidden @3xl:inline-flex", t.pills)} />
          <span title={CATEGORIES[category].title} className={cn("@3xl:hidden", t.pills)}>
            <CategoryIcon category={category} className="size-3.5 stroke-2" />
          </span>
        </>
      )}
      <Star flagged={message.flagged} onToggle={onToggleStar} />
      <span className={cn("w-12 shrink-0 text-right text-xs tabular-nums @3xl:w-14", t.date)}>
        <LocalDate value={message.date} format={formatListDate} />
      </span>
    </div>
  )
}
