import { useState } from "react"
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AddIcon, DangerTriangleIcon } from "@solar-icons/react/linear"
import { toast } from "sonner"
import { AccountMark } from "@/components/mail/account-mark"
import { AccountLabel } from "@/components/mail/account-label"
import { LocalDate } from "@/components/mail/local-date"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { COLOR_NAMES, dotClass } from "@/lib/account-colors"
import { accountsQuery, mailKeys, sidebarQuery } from "@/lib/mail-queries"
import { PROVIDER_IDS, PROVIDERS, providerNote, usernameFor } from "@/lib/mail-providers"
import type { MailServers, ProviderId } from "@/lib/mail-providers"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  addAccount,
  deleteAccount,
  discoverMailSettings,
  updateAccount,
  updateProfile,
} from "@/server/accounts.functions"
import type { listAccounts } from "@/server/accounts.functions"

export const Route = createFileRoute("/_app/settings")({
  loader: ({ context }) => context.queryClient.query({ ...accountsQuery(), staleTime: "static" }),
  component: SettingsPage,
})

type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number]

function SettingsPage() {
  const { data: accounts } = useSuspenseQuery(accountsQuery())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AccountRow | null>(null)

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center pr-3 pl-5">
        <h1 className="flex-1 text-[15px] font-semibold tracking-tight">Accounts</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          <AddIcon data-icon="inline-start" />
          Add account
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <ProfileForm />
          {accounts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No accounts yet. Add your first Purelymail mailbox to start syncing.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-4 py-3.5">
                  <AccountMark label={account.label} color={account.color} className="size-7 rounded-lg text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium">{account.email}</span>
                      <AccountLabel label={account.label} color={account.color} className="shrink-0" />
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {account.syncError ? (
                        <span className="inline-flex items-center gap-1.5 text-destructive">
                          <DangerTriangleIcon className="size-3.5" />
                          {account.syncError}
                        </span>
                      ) : account.lastSyncedAt ? (
                        <>
                          Synced <LocalDate value={account.lastSyncedAt} format={formatRelative} />
                        </>
                      ) : (
                        "Waiting for first sync"
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground/70 tabular-nums">
                      IMAP {account.imapHost}:{account.imapPort} · SMTP {account.smtpHost}:{account.smtpPort}
                      {account.username !== account.email && ` · user ${account.username}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(account)}>
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-8 text-xs text-muted-foreground">
            Mail syncs in the background worker, which <code>pnpm dev</code> starts. Passwords are encrypted at rest.
          </p>
        </div>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && <AddAccountDialog onDone={() => setAdding(false)} />}
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && <EditAccountDialog account={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </section>
  )
}

function ProfileForm() {
  const { data: sidebar } = useSuspenseQuery(sidebarQuery())
  const [name, setName] = useState(sidebar.user.name)
  const save = useAccountMutation(
    (value: string) => updateProfile({ data: { name: value } }),
    () => "Name saved",
    () => undefined,
  )

  return (
    <form
      className="mb-6 flex items-center gap-3 border-b border-border/60 pb-6"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(name)
      }}
    >
      <Label htmlFor="profile-name" className="w-24 shrink-0">
        Your name
      </Label>
      <Input
        id="profile-name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        className="max-w-xs"
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={save.isPending || name.trim() === sidebar.user.name}
      >
        Save
      </Button>
    </form>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function useAccountMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  success: (variables: TVariables) => string,
  onDone: () => void,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_result, variables) => {
      toast.success(success(variables))
      onDone()
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: accountsQuery().queryKey }),
        queryClient.invalidateQueries({ queryKey: mailKeys.all }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong"),
  })
}

type NewAccount = Parameters<typeof addAccount>[0]["data"]
type ServerSettings = MailServers & { username?: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function AddAccountDialog({ onDone }: { onDone: () => void }) {
  const add = useAccountMutation(
    (data: NewAccount) => addAccount({ data }),
    (data) => `Added ${data.email}`,
    onDone,
  )
  const [form, setForm] = useState({ email: "", password: "", name: "", label: "" })
  const [override, setOverride] = useState<{ provider: ProviderId | "custom"; servers: ServerSettings }>()
  const [editingServers, setEditingServers] = useState(false)
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const lookupEmail = useDebouncedValue(form.email.trim().toLowerCase(), 400)
  const discovery = useQuery({
    queryKey: ["mail-discovery", lookupEmail],
    queryFn: () => discoverMailSettings({ data: { email: lookupEmail } }),
    enabled: EMAIL_PATTERN.test(lookupEmail),
    staleTime: Infinity,
    retry: false,
  })
  const detected = EMAIL_PATTERN.test(lookupEmail) ? discovery.data : undefined
  const servers: ServerSettings | undefined = override?.servers ?? detected ?? undefined
  const providerId = override
    ? override.provider === "custom"
      ? null
      : override.provider
    : (detected?.provider ?? null)
  const note = providerNote(providerId)
  const notFound = discovery.isSuccess && discovery.data === null && !override
  const showServerFields = editingServers || notFound || override?.provider === "custom"
  const email = form.email.trim()
  const username = servers?.username || usernameFor(email, servers?.usernameStyle ?? "email")

  const updateServers = (patch: Partial<ServerSettings>) =>
    setOverride({
      provider: override?.provider ?? "custom",
      servers: { ...(servers ?? EMPTY_SERVERS), ...patch },
    })

  function chooseProvider(value: string) {
    if (value === "custom") setOverride({ provider: "custom", servers: servers ?? EMPTY_SERVERS })
    else if (isProviderId(value)) setOverride({ provider: value, servers: PROVIDERS[value].servers })
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add account</DialogTitle>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!servers) return
          add.mutate({
            ...form,
            imapHost: servers.imapHost,
            imapPort: servers.imapPort,
            smtpHost: servers.smtpHost,
            smtpPort: servers.smtpPort,
            username,
            appendSent: servers.appendSent,
          })
        }}
      >
        <Field label="Email">
          <Input type="email" autoFocus required value={form.email} onChange={(e) => set("email", e.target.value)} />
          <DiscoveryStatus
            fetching={discovery.isFetching}
            detected={Boolean(detected) && !override}
            notFound={notFound}
            providerName={providerId ? PROVIDERS[providerId].name : servers?.imapHost}
            note={note}
          />
        </Field>
        <Field label={note?.href ? "App password" : "Password"}>
          <Input type="password" required value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sender name">
            <Input placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Label">
            <Input placeholder="From domain" value={form.label} onChange={(e) => set("label", e.target.value)} />
          </Field>
        </div>

        {servers && !showServerFields ? (
          <div className="flex items-center gap-3 rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs">
            <div className="min-w-0 flex-1 text-muted-foreground">
              <p className="truncate">
                <span className="text-foreground/80">IMAP</span> {servers.imapHost}:{servers.imapPort}
              </p>
              <p className="truncate">
                <span className="text-foreground/80">SMTP</span> {servers.smtpHost}:{servers.smtpPort}
              </p>
            </div>
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditingServers(true)}>
              Edit
            </Button>
          </div>
        ) : null}

        {showServerFields && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <Field label="Provider">
              <Select value={override?.provider ?? providerId ?? "custom"} onValueChange={chooseProvider}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PROVIDERS[id].name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Other (custom servers)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Field label="IMAP server">
                <Input
                  required
                  placeholder="imap.example.com"
                  value={servers?.imapHost ?? ""}
                  onChange={(e) => updateServers({ imapHost: e.target.value })}
                />
              </Field>
              <Field label="Port">
                <Input
                  type="number"
                  value={servers?.imapPort ?? 993}
                  onChange={(e) => updateServers({ imapPort: Number(e.target.value) })}
                />
              </Field>
              <Field label="SMTP server">
                <Input
                  required
                  placeholder="smtp.example.com"
                  value={servers?.smtpHost ?? ""}
                  onChange={(e) => updateServers({ smtpHost: e.target.value })}
                />
              </Field>
              <Field label="Port">
                <Input
                  type="number"
                  value={servers?.smtpPort ?? 465}
                  onChange={(e) => updateServers({ smtpPort: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Username" hint="Usually your full email address.">
              <Input
                placeholder={email || "you@example.com"}
                value={servers?.username ?? ""}
                onChange={(e) => updateServers({ username: e.target.value })}
              />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Save sent mail to the Sent folder
                <span className="block text-xs text-muted-foreground">
                  Turn off for Gmail and Outlook, they do it themselves.
                </span>
              </span>
              <Switch
                checked={servers?.appendSent ?? true}
                onCheckedChange={(appendSent) => updateServers({ appendSent })}
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={add.isPending || !servers?.imapHost || !servers.smtpHost}>
            {add.isPending ? "Checking login…" : "Add account"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

const EMPTY_SERVERS: ServerSettings = {
  imapHost: "",
  imapPort: 993,
  smtpHost: "",
  smtpPort: 465,
  usernameStyle: "email",
  appendSent: true,
}

function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS
}

function DiscoveryStatus({
  fetching,
  detected,
  notFound,
  providerName,
  note,
}: {
  fetching: boolean
  detected: boolean
  notFound: boolean
  providerName?: string
  note?: { text: string; href?: string; linkLabel?: string }
}) {
  if (fetching) return <p className="text-xs text-muted-foreground">Looking up mail settings…</p>
  if (notFound) {
    return (
      <p className="text-xs text-muted-foreground">Couldn't detect this provider. Enter its server settings below.</p>
    )
  }
  if (!detected && !note) return null
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {detected && providerName && (
        <p className="text-muted-foreground">
          Detected <span className="font-medium text-foreground/80">{providerName}</span>
        </p>
      )}
      {note && (
        <p className="text-amber-700 dark:text-amber-300">
          {note.text}{" "}
          {note.href && (
            <a href={note.href} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
              {note.linkLabel ?? "Learn more"}
            </a>
          )}
        </p>
      )}
    </div>
  )
}

type AccountChanges = Parameters<typeof updateAccount>[0]["data"]

function EditAccountDialog({ account, onDone }: { account: AccountRow; onDone: () => void }) {
  const update = useAccountMutation(
    (data: AccountChanges) => updateAccount({ data }),
    () => "Account updated",
    onDone,
  )
  const remove = useAccountMutation(
    (id: number) => deleteAccount({ data: { id } }),
    () => `Removed ${account.email}`,
    onDone,
  )
  const pending = update.isPending || remove.isPending
  const [form, setForm] = useState({ name: account.name, label: account.label, color: account.color, password: "" })
  const [servers, setServers] = useState({
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    username: account.username,
    appendSent: account.appendSent,
  })
  const setServer = <TKey extends keyof typeof servers>(key: TKey, value: (typeof servers)[TKey]) =>
    setServers((current) => ({ ...current, [key]: value }))
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{account.email}</DialogTitle>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate({ id: account.id, ...form, ...servers, password: form.password || undefined })
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sender name">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Label">
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </Field>
        </div>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLOR_NAMES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setForm((f) => ({ ...f, color }))}
                className={cn(
                  "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-popover",
                  form.color === color && "ring-2 ring-foreground/70",
                )}
              >
                <span className={cn("size-4 rounded-full", dotClass(color))} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="New password" hint="Leave empty to keep the current password.">
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Server settings</p>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <Field label="IMAP server">
              <Input required value={servers.imapHost} onChange={(e) => setServer("imapHost", e.target.value)} />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={servers.imapPort}
                onChange={(e) => setServer("imapPort", Number(e.target.value))}
              />
            </Field>
            <Field label="SMTP server">
              <Input required value={servers.smtpHost} onChange={(e) => setServer("smtpHost", e.target.value)} />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={servers.smtpPort}
                onChange={(e) => setServer("smtpPort", Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Username">
            <Input required value={servers.username} onChange={(e) => setServer("username", e.target.value)} />
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Save sent mail to the Sent folder
              <span className="block text-xs text-muted-foreground">
                Turn off for Gmail and Outlook, they do it themselves.
              </span>
            </span>
            <Switch
              checked={servers.appendSent}
              onCheckedChange={(appendSent) => setServer("appendSent", appendSent)}
            />
          </label>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => (confirmDelete ? remove.mutate(account.id) : setConfirmDelete(true))}
          >
            {confirmDelete ? "Click again to remove" : "Remove account"}
          </Button>
          <Button type="submit" disabled={pending}>
            {update.isPending ? "Checking…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
