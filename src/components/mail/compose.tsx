import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CloseIcon, PlaneIcon } from "@solar-icons/react/linear"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { dotClass } from "@/lib/account-colors"
import { mailKeys } from "@/lib/mail-queries"
import { recipientError } from "@/lib/recipients"
import { cn } from "@/lib/utils"
import { sendMessage } from "@/server/mail.functions"
import { EmailMarkdown } from "./email-markdown"

export type QuotedMessage = { attribution: string; text: string }

export type Draft = {
  accountId?: number
  to: string
  cc: string
  bcc: string
  subject: string
  text: string
  replyToId?: number
  draftId?: number
  quote?: QuotedMessage
}

function bodyWithQuote({ text, quote }: Draft) {
  if (!quote) return text
  const quoted = quote.text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")
  return `${text.trimEnd()}\n\n${quote.attribution}\n${quoted}`
}

type ComposeAccount = { id: number; email: string; name: string; color: string }

const ComposeContext = createContext<{ open: (draft?: Partial<Draft>) => void; isOpen: boolean } | null>(null)

export function useCompose() {
  const context = useContext(ComposeContext)
  if (!context) throw new Error("useCompose must be used inside ComposeProvider")
  return context
}

const EMPTY: Draft = { to: "", cc: "", bcc: "", subject: "", text: "" }

export function ComposeProvider({ accounts, children }: { accounts: ComposeAccount[]; children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null)

  const open = useCallback(
    (initial?: Partial<Draft>) => setDraft({ ...EMPTY, accountId: accounts[0]?.id, ...initial }),
    [accounts],
  )
  const value = useMemo(() => ({ open, isOpen: draft !== null }), [open, draft])

  return (
    <ComposeContext.Provider value={value}>
      {children}
      <Dialog open={draft !== null} onOpenChange={(next) => !next && setDraft(null)}>
        {draft && <ComposeDialog draft={draft} accounts={accounts} onChange={setDraft} onDone={() => setDraft(null)} />}
      </Dialog>
    </ComposeContext.Provider>
  )
}

function ComposeDialog({
  draft,
  accounts,
  onChange,
  onDone,
}: {
  draft: Draft
  accounts: ComposeAccount[]
  onChange: (draft: Draft) => void
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [showCc, setShowCc] = useState(Boolean(draft.cc || draft.bcc))
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const sendMutation = useMutation({
    mutationFn: ({ accountId, ...message }: Draft & { accountId: number }) =>
      sendMessage({
        data: {
          accountId,
          to: message.to,
          cc: message.cc,
          bcc: message.bcc,
          subject: message.subject,
          text: bodyWithQuote(message),
          replyToId: message.replyToId,
          draftId: message.draftId,
        },
      }),
    onSuccess: () => {
      toast.success("Message sent")
      onDone()
      return queryClient.invalidateQueries({ queryKey: mailKeys.all })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to send"),
  })
  const sending = sendMutation.isPending
  const canSend = Boolean(draft.accountId && draft.to.trim()) && !sending

  const [recipientIssue, setRecipientIssue] = useState<{ field: "to" | "cc" | "bcc"; message: string }>()

  function send() {
    if (!canSend || !draft.accountId) return
    const issue = (
      [
        ["to", recipientError("To", draft.to)],
        ["cc", recipientError("Cc", draft.cc)],
        ["bcc", recipientError("Bcc", draft.bcc)],
      ] as const
    ).find(([, message]) => message)
    if (issue?.[1]) {
      setRecipientIssue({ field: issue[0], message: issue[1] })
      if (issue[0] !== "to") setShowCc(true)
      return
    }
    sendMutation.mutate({ ...draft, accountId: draft.accountId })
  }

  const editRecipients = (patch: Partial<Pick<Draft, "to" | "cc" | "bcc">>) => {
    setRecipientIssue(undefined)
    update(patch)
  }

  return (
    <DialogContent
      className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          send()
        }
      }}
    >
      <DialogTitle className="border-b px-5 py-3.5 text-sm font-medium">
        {draft.draftId ? "Edit draft" : draft.replyToId ? "Reply" : "New message"}
      </DialogTitle>

      <ComposeRow label="From">
        <Select
          value={draft.accountId ? String(draft.accountId) : undefined}
          onValueChange={(v) => update({ accountId: Number(v) })}
        >
          <SelectTrigger className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent">
            <SelectValue placeholder="Choose an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                <span className={cn("size-2 rounded-full", dotClass(a.color))} />
                {a.name && a.name !== a.email ? `${a.name} <${a.email}>` : a.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ComposeRow>
      <ComposeRow label="To">
        <ComposeInput
          autoFocus={!draft.to}
          value={draft.to}
          invalid={recipientIssue?.field === "to"}
          onChange={(to) => editRecipients({ to })}
        />
        {!showCc && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowCc(true)}
          >
            Cc / Bcc
          </button>
        )}
      </ComposeRow>
      {showCc && (
        <>
          <ComposeRow label="Cc">
            <ComposeInput
              value={draft.cc}
              invalid={recipientIssue?.field === "cc"}
              onChange={(cc) => editRecipients({ cc })}
            />
          </ComposeRow>
          <ComposeRow label="Bcc">
            <ComposeInput
              value={draft.bcc}
              invalid={recipientIssue?.field === "bcc"}
              onChange={(bcc) => editRecipients({ bcc })}
            />
          </ComposeRow>
        </>
      )}
      {recipientIssue && (
        <p role="alert" className="border-b bg-destructive/10 px-5 py-2 text-xs text-destructive">
          {recipientIssue.message}
        </p>
      )}
      <ComposeRow label="Subject">
        <ComposeInput value={draft.subject} onChange={(subject) => update({ subject })} />
      </ComposeRow>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <textarea
          autoFocus={!!draft.to}
          value={draft.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={draft.quote ? "Write your reply…" : "Write your message…"}
          className={cn(
            "block field-sizing-content w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50",
            draft.quote ? "min-h-32" : "min-h-72",
          )}
        />
        {draft.quote && <QuotedBlock quote={draft.quote} onRemove={() => update({ quote: undefined })} />}
      </div>

      <div className="flex items-center justify-between border-t px-5 py-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd> to send
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Discard
          </Button>
          <Button onClick={send} disabled={!canSend}>
            <PlaneIcon data-icon="inline-start" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

function QuotedBlock({ quote, onRemove }: { quote: QuotedMessage; onRemove: () => void }) {
  return (
    <div className="mx-5 mb-5 rounded-lg bg-foreground/[0.04] px-4 py-3">
      <div className="mb-2 flex items-start gap-3">
        <p className="flex-1 text-xs text-muted-foreground">{quote.attribution}</p>
        <button
          type="button"
          aria-label="Remove quoted message"
          title="Don't include the original message"
          onClick={onRemove}
          className="-m-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>
      <EmailMarkdown className="text-[13px] leading-relaxed text-foreground/55">{quote.text}</EmailMarkdown>
    </div>
  )
}

function ComposeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-1.5 text-sm">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function ComposeInput({
  value,
  onChange,
  autoFocus,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  invalid?: boolean
}) {
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      aria-invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-0 flex-1 bg-transparent outline-none aria-invalid:text-destructive"
    />
  )
}
