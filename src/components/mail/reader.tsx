import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  ArchiveIcon,
  DoubleAltArrowRightIcon,
  DownloadMinimalisticIcon,
  InboxIcon,
  LetterIcon,
  LetterOpenedIcon,
  PenNewSquareIcon,
  ReplyIcon,
  StarIcon,
  TrashBinMinimalisticIcon,
} from "@solar-icons/react/linear"
import type { Icon } from "@/components/icons"
import { StarIcon as StarredIcon } from "@solar-icons/react/bold"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CATEGORIES, CATEGORY_IDS } from "@/lib/categories"
import type { Category } from "@/lib/categories"
import { emailDocument } from "@/lib/email-document"
import type { EmailTheme } from "@/lib/email-document"
import { formatFullDate, formatSize, senderName } from "@/lib/format"
import { messageQuery } from "@/lib/mail-queries"
import { useTheme } from "@/lib/theme"
import type { LoadedMessage } from "@/lib/mail-queries"
import { cn } from "@/lib/utils"
import { AccountLabel } from "./account-label"
import { CategoryPill } from "./category-pill"
import { CategoryIcon } from "./category-icon"
import { LocalDate } from "./local-date"
import type { MessageActions } from "./message-context-menu"

export function Reader({ id, actions, onClose }: { id: number; actions: MessageActions; onClose: () => void }) {
  const { data, error, isPlaceholderData } = useQuery({ ...messageQuery(id), placeholderData: keepPreviousData })
  const { resolvedTheme } = useTheme()
  const theme: EmailTheme = resolvedTheme === "dark" ? "dark" : "original"
  const message = data?.message
  const ifCurrent = (run: () => void) => () => {
    if (!isPlaceholderData) run()
  }

  return (
    <section className="flex w-[46%] max-w-3xl min-w-[420px] shrink-0 flex-col border-l bg-background">
      <div className="flex h-14 shrink-0 items-center gap-1 px-3">
        <ToolbarButton icon={DoubleAltArrowRightIcon} label="Close" shortcut="Esc" onClick={onClose} />
        <div className="flex-1" />
        {data && message && (
          <>
            {message.role === "drafts" ? (
              <Button
                size="sm"
                variant="secondary"
                className="mr-1"
                onClick={ifCurrent(() => actions.editDraft(message))}
              >
                <PenNewSquareIcon data-icon="inline-start" />
                Edit draft
              </Button>
            ) : (
              <ToolbarButton
                icon={ReplyIcon}
                label="Reply"
                shortcut="R"
                onClick={ifCurrent(() => actions.reply(message))}
              />
            )}
            {message.role === "inbox" ? (
              <ToolbarButton
                icon={ArchiveIcon}
                label="Archive"
                shortcut="E"
                onClick={ifCurrent(() => actions.move(message, "archive"))}
              />
            ) : (
              <ToolbarButton
                icon={InboxIcon}
                label="Move to inbox"
                onClick={ifCurrent(() => actions.move(message, "inbox"))}
              />
            )}
            <ToolbarButton
              icon={TrashBinMinimalisticIcon}
              label={message.role === "trash" ? "Delete forever" : "Trash"}
              shortcut="#"
              onClick={ifCurrent(() => actions.move(message, "trash"))}
            />
            <ToolbarButton
              icon={message.flagged ? StarredIcon : StarIcon}
              label={message.flagged ? "Unstar" : "Star"}
              shortcut="S"
              onClick={ifCurrent(() => actions.toggleStar(message))}
              iconClassName={cn(message.flagged && "text-amber-400")}
            />
            <ToolbarButton
              icon={message.seen ? LetterIcon : LetterOpenedIcon}
              label={message.seen ? "Mark unread" : "Mark read"}
              shortcut="U"
              onClick={ifCurrent(() => actions.setSeen(message, !message.seen))}
            />
          </>
        )}
      </div>

      {error ? (
        <div className="p-6 text-sm text-destructive">{error.message}</div>
      ) : !data ? (
        <div className="flex flex-col gap-3 px-6 pt-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
      ) : (
        <MessageView
          data={data}
          theme={theme}
          onChooseCategory={(category) => !isPlaceholderData && actions.setCategory(data.message, category)}
        />
      )}
    </section>
  )
}

function MessageView({
  data,
  theme,
  onChooseCategory,
}: {
  data: LoadedMessage
  theme: EmailTheme
  onChooseCategory: (category: Category) => void
}) {
  const { message, account, body } = data
  const { category, categoryReason } = message
  const recipients = [...message.to, ...message.cc].map((a) => a.name || a.address).join(", ")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pt-2 pb-5">
        <div className="flex items-center gap-3">
          <h1
            title={message.subject || undefined}
            className="min-w-0 flex-1 truncate text-xl leading-snug font-semibold tracking-tight text-foreground"
          >
            {message.subject || "(no subject)"}
          </h1>
          <AccountLabel label={account.label} color={account.color} className="shrink-0" />
        </div>
        <div className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {senderName(message.fromName, message.fromAddress)}
              </span>
              {message.fromName && (
                <span className="truncate text-[13px] text-muted-foreground/80">{message.fromAddress}</span>
              )}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground/80">
              to {recipients || "undisclosed recipients"}
            </div>
          </div>
          <span className="shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
            <LocalDate value={message.date} format={formatFullDate} />
          </span>
        </div>
        {data.message.role === "inbox" && (
          <div className="mt-4 flex min-w-0 items-center gap-2 text-xs">
            <DropdownMenu>
              <DropdownMenuTrigger className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                {category ? (
                  <CategoryPill category={category} className="cursor-pointer hover:brightness-125" />
                ) : (
                  <span className="inline-flex h-5 items-center rounded-md border border-dashed px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted">
                    Classifying…
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Move to category</DropdownMenuLabel>
                {CATEGORY_IDS.map((id) => (
                  <DropdownMenuItem key={id} onSelect={() => onChooseCategory(id)}>
                    <CategoryIcon category={id} className="size-4" />
                    {CATEGORIES[id].title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {categoryReason && <span className="truncate text-muted-foreground/70">{categoryReason}</span>}
          </div>
        )}
        {body.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {body.attachments.map((file, index) => (
              <a
                key={index}
                href={`/api/attachments/${message.id}/${index}`}
                className="flex max-w-60 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                <DownloadMinimalisticIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.filename}</span>
                <span className="shrink-0 text-muted-foreground">{formatSize(file.size)}</span>
              </a>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 border-t">
        {body.html ? (
          <iframe
            title="Message body"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={emailDocument(body.html, theme)}
            style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
            className="size-full"
          />
        ) : (
          <div className="h-full overflow-y-auto px-6 py-5 text-sm leading-relaxed whitespace-pre-wrap">
            {body.text || "(empty message)"}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  iconClassName,
}: {
  icon: Icon
  label: string
  shortcut?: string
  onClick: () => void
  iconClassName?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          <Icon className={cn("text-muted-foreground", iconClassName)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
