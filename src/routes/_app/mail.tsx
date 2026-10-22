import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient, useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CloseIcon, MagnifierIcon, RefreshIcon } from "@solar-icons/react/linear"
import { toast } from "sonner"
import { z } from "zod"
import { useCompose } from "@/components/mail/compose"
import type { Draft } from "@/components/mail/compose"
import type { MessageActions } from "@/components/mail/message-context-menu"
import { MessageList } from "@/components/mail/message-list"
import { Reader } from "@/components/mail/reader"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMailActions } from "@/hooks/use-mail-actions"
import type { MessageRef } from "@/hooks/use-mail-actions"
import { CATEGORIES, categorySchema } from "@/lib/categories"
import { SEARCH_EVENT } from "@/lib/events"
import { FOLDER_TITLES, folderSchema } from "@/lib/folders"
import { formatFullDate } from "@/lib/format"
import { htmlToText } from "@/lib/html-to-text"
import { messageListQuery, messageQuery, sidebarQuery } from "@/lib/mail-queries"
import type { LoadedMessage } from "@/lib/mail-queries"

const searchSchema = z.object({
  folder: folderSchema.default("inbox").catch("inbox"),
  account: z.number().int().optional().catch(undefined),
  category: categorySchema.optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  id: z.number().int().optional().catch(undefined),
})

export const Route = createFileRoute("/_app/mail")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    folder: search.folder,
    account: search.account,
    category: search.category,
    q: search.q,
  }),
  loader: ({ context, deps }) => context.queryClient.infiniteQuery({ ...messageListQuery(deps), staleTime: "static" }),
  component: MailPage,
})

function replyDraft({ message, body, account }: LoadedMessage): Partial<Draft> {
  const from = message.fromName ? `${message.fromName} <${message.fromAddress}>` : message.fromAddress
  return {
    accountId: account.id,
    to: message.fromAddress ?? "",
    subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
    replyToId: message.id,
    quote: { attribution: `On ${formatFullDate(message.date)}, ${from} wrote:`, text: (body.text ?? "").trimEnd() },
  }
}

function formatAddresses(list: LoadedMessage["message"]["to"]) {
  return list.map(({ name, address }) => (name ? `${name} <${address}>` : address)).join(", ")
}

function draftForEditing({ message, body, account }: LoadedMessage): Partial<Draft> {
  return {
    accountId: account.id,
    to: formatAddresses(message.to),
    cc: formatAddresses(message.cc),
    subject: message.subject,
    text: body.text?.trimEnd() ?? (body.html ? htmlToText(body.html) : ""),
    draftId: message.id,
  }
}

function MailPage() {
  const search = Route.useSearch()
  const filters = Route.useLoaderDeps()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const compose = useCompose()
  const mail = useMailActions()
  const { data: sidebar } = useSuspenseQuery(sidebarQuery())
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(messageListQuery(filters))

  const searchRef = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = useState(Boolean(search.q))
  const [query, setQuery] = useState(search.q ?? "")

  const messages = useMemo(() => data.pages.flatMap((page) => page.messages), [data.pages])
  const accounts = useMemo(
    () => new Map(sidebar.accounts.map((a) => [a.id, { label: a.label, color: a.color }])),
    [sidebar.accounts],
  )
  const currentAccount = sidebar.accounts.find((a) => a.id === search.account)
  const selectedIndex = messages.findIndex((m) => m.id === search.id)
  const selected = selectedIndex >= 0 ? messages[selectedIndex] : undefined

  const select = useCallback(
    (id: number | undefined) => navigate({ search: (prev) => ({ ...prev, id }), replace: true }),
    [navigate],
  )

  const { setSeen, setStarred, categorize, move } = mail

  const keptUnread = useRef(new Set<number>())

  const prefetchAround = useCallback(
    (id: number) => {
      const index = messages.findIndex((m) => m.id === id)
      for (const neighbour of [messages[index + 1], messages[index + 2], messages[index - 1]]) {
        if (neighbour) queryClient.query(messageQuery(neighbour.id)).catch(() => undefined)
      }
    },
    [messages, queryClient],
  )

  const open = useCallback(
    (message: MessageRef) => {
      select(message.id)
      prefetchAround(message.id)
      if (!message.seen && !keptUnread.current.has(message.id)) setSeen.mutate({ id: message.id, seen: true })
    },
    [prefetchAround, select, setSeen],
  )

  const actions = useMemo<MessageActions>(
    () => ({
      open,
      reply: async (message) => {
        try {
          compose.open(replyDraft(await queryClient.query(messageQuery(message.id))))
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not load the message")
        }
      },
      editDraft: async (message) => {
        try {
          compose.open(draftForEditing(await queryClient.query(messageQuery(message.id))))
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not load the draft")
        }
      },
      setSeen: (message, seen) => {
        if (seen) keptUnread.current.delete(message.id)
        else keptUnread.current.add(message.id)
        setSeen.mutate({ id: message.id, seen })
      },
      toggleStar: (message) => setStarred.mutate({ id: message.id, flagged: !message.flagged }),
      setCategory: (message, category) => categorize.mutate({ id: message.id, category }),
      move: (message, to) => {
        if (message.id === search.id) {
          const index = messages.findIndex((m) => m.id === message.id)
          const next = messages[index + 1] ?? messages[index - 1]
          if (next) open(next)
          else select(undefined)
        }
        move.mutate({ message, to })
      },
    }),
    [categorize, compose, messages, move, open, queryClient, search.id, select, setSeen, setStarred],
  )

  const submitSearch = (value: string) =>
    navigate({ search: (prev) => ({ ...prev, q: value.trim() || undefined, id: undefined }) })

  const closeSearch = () => {
    setQuery("")
    setSearchOpen(false)
    if (search.q) submitSearch("")
  }

  useEffect(() => {
    const openSearch = () => {
      setSearchOpen(true)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    window.addEventListener(SEARCH_EVENT, openSearch)
    return () => window.removeEventListener(SEARCH_EVENT, openSearch)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (compose.isOpen || event.metaKey || event.ctrlKey || event.altKey) return
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return

      const step = (delta: number) => {
        const next = messages[Math.min(messages.length - 1, Math.max(0, selectedIndex + delta))]
        if (next) actions.open(next)
      }
      const handlers: Record<string, () => void> = {
        j: () => step(1),
        ArrowDown: () => step(1),
        k: () => step(-1),
        ArrowUp: () => step(-1),
        Escape: () => select(undefined),
        c: () => compose.open({ accountId: search.account }),
        "/": () => window.dispatchEvent(new Event(SEARCH_EVENT)),
        e: () => selected?.role === "inbox" && actions.move(selected, "archive"),
        "#": () => selected && actions.move(selected, "trash"),
        s: () => selected && actions.toggleStar(selected),
        u: () => selected && actions.setSeen(selected, !selected.seen),
        r: () => selected && (selected.role === "drafts" ? actions.editDraft(selected) : actions.reply(selected)),
      }
      const handler = handlers[event.key]
      if (handler) {
        event.preventDefault()
        handler()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [actions, compose, messages, search.account, select, selected, selectedIndex])

  const view = search.category
    ? CATEGORIES[search.category].title
    : search.folder === "inbox" && !currentAccount
      ? "All Mail"
      : FOLDER_TITLES[search.folder]
  const title = currentAccount ? `${view} · ${currentAccount.label}` : view

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 pr-3 pl-5">
          {searchOpen ? (
            <form
              className="flex flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submitSearch(query)
              }}
            >
              <MagnifierIcon className="size-4 text-muted-foreground" />
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                placeholder={`Search ${title.toLowerCase()}`}
                className="h-9 flex-1 bg-transparent text-sm outline-none"
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close search" onClick={closeSearch}>
                <CloseIcon />
              </Button>
            </form>
          ) : (
            <>
              <h1 className="flex-1 truncate text-[15px] font-semibold tracking-tight">{title}</h1>
              <HeaderButton label="Search" onClick={() => window.dispatchEvent(new Event(SEARCH_EVENT))}>
                <MagnifierIcon />
              </HeaderButton>
            </>
          )}
          <HeaderButton label="Sync now" onClick={() => mail.sync.mutate()}>
            <RefreshIcon />
          </HeaderButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState hasAccounts={sidebar.accounts.length > 0} searching={Boolean(search.q)} />
          ) : (
            <>
              <MessageList
                messages={messages}
                accounts={accounts}
                selectedId={search.id}
                showAccount={!search.account}
                showCategory={!search.category}
                showRecipients={search.folder === "sent" || search.folder === "drafts"}
                actions={actions}
              />
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button variant="ghost" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                    {isFetchingNextPage ? "Loading…" : "Load older messages"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {search.id !== undefined && <Reader id={search.id} actions={actions} onClose={() => select(undefined)} />}
    </>
  )
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="text-muted-foreground">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EmptyState({ hasAccounts, searching }: { hasAccounts: boolean; searching: boolean }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      {!hasAccounts
        ? "Add an account in Settings to start syncing mail."
        : searching
          ? "No messages match your search."
          : "Nothing here."}
    </div>
  )
}
