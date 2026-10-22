import type { ImapFlow } from "imapflow"
import { and, desc, eq, isNotNull, like, lt, ne, or, sql } from "drizzle-orm"
import MailComposer from "nodemailer/lib/mail-composer"
import { db } from "./db/client.server"
import { accounts, bodies, mailboxes, messages } from "./db/schema"
import type { MailboxRole } from "./db/schema"
import type { Category } from "../lib/categories"
import { bumpVersion, getProfileName, getVersion, saveBody, setSyncRequest, setUserCategory } from "./db/store.server"
import { downloadableAttachments, parseSource } from "./imap.server"
import type { Account } from "./imap.server"
import { createSmtp, withImap } from "./mail.server"

export type Folder = MailboxRole | "starred"

const PAGE_SIZE = 100

export function listMessages(input: {
  accountId?: number
  folder: Folder
  category?: Category
  q?: string
  before?: number
}) {
  const filters = [
    input.folder === "starred"
      ? and(eq(messages.flagged, true), ne(mailboxes.role, "trash"))
      : eq(mailboxes.role, input.folder),
  ]
  if (input.accountId) filters.push(eq(messages.accountId, input.accountId))
  if (input.category) filters.push(eq(messages.category, input.category))
  if (input.before) filters.push(lt(messages.date, new Date(input.before)))
  const q = input.q?.trim()
  if (q) {
    const pattern = `%${q}%`
    filters.push(
      or(
        like(messages.subject, pattern),
        like(messages.fromName, pattern),
        like(messages.fromAddress, pattern),
        like(messages.snippet, pattern),
      ),
    )
  }

  const rows = db
    .select({
      id: messages.id,
      accountId: messages.accountId,
      subject: messages.subject,
      fromName: messages.fromName,
      fromAddress: messages.fromAddress,
      to: messages.to,
      date: messages.date,
      snippet: messages.snippet,
      seen: messages.seen,
      flagged: messages.flagged,
      hasAttachments: messages.hasAttachments,
      category: messages.category,
      categoryReason: messages.categoryReason,
      role: mailboxes.role,
    })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .where(and(...filters))
    .orderBy(desc(messages.date))
    .limit(PAGE_SIZE + 1)
    .all()

  return { messages: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

export function getSidebar() {
  const accountRows = db
    .select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      label: accounts.label,
      color: accounts.color,
      syncError: accounts.syncError,
      lastSyncedAt: accounts.lastSyncedAt,
    })
    .from(accounts)
    .orderBy(accounts.createdAt)
    .all()

  const unread = db
    .select({ accountId: messages.accountId, count: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .where(and(eq(mailboxes.role, "inbox"), eq(messages.seen, false)))
    .groupBy(messages.accountId)
    .all()
  const unreadByAccount = new Map(unread.map((u) => [u.accountId, u.count]))

  const categoryCounts = db
    .select({ category: messages.category, count: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .where(and(eq(mailboxes.role, "inbox"), eq(messages.seen, false), isNotNull(messages.category)))
    .groupBy(messages.category)
    .all()

  const folderCounts = db
    .select({
      starred: sql<number>`sum(case when ${messages.flagged} = 1 and ${mailboxes.role} != 'trash' then 1 else 0 end)`,
      drafts: sql<number>`sum(case when ${mailboxes.role} = 'drafts' then 1 else 0 end)`,
      junk: sql<number>`sum(case when ${mailboxes.role} = 'junk' and ${messages.seen} = 0 then 1 else 0 end)`,
    })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .get()

  const localPart = accountRows[0]?.email.split("@")[0] ?? ""
  const fallbackName = localPart.charAt(0).toUpperCase() + localPart.slice(1)

  return {
    user: { name: getProfileName(db) || fallbackName || "You" },
    accounts: accountRows.map((a) => ({ ...a, unread: unreadByAccount.get(a.id) ?? 0 })),
    categories: Object.fromEntries(categoryCounts.map((c) => [c.category, c.count])) as Partial<
      Record<Category, number>
    >,
    counts: {
      inbox: unread.reduce((sum, u) => sum + u.count, 0),
      starred: folderCounts?.starred ?? 0,
      drafts: folderCounts?.drafts ?? 0,
      junk: folderCounts?.junk ?? 0,
    },
  }
}

function loadMessage(id: number) {
  const row = db
    .select({ message: messages, mailbox: mailboxes, account: accounts })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .innerJoin(accounts, eq(messages.accountId, accounts.id))
    .where(eq(messages.id, id))
    .get()
  if (!row) throw new Error("Message not found")
  return row
}

async function fetchSource(account: Account, path: string, uid: number) {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(path)
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!msg || !msg.source) throw new Error("Message no longer exists on the server")
      return msg.source
    } finally {
      lock.release()
    }
  })
}

async function storeFlag(account: Account, path: string, uid: number, flag: string, value: boolean) {
  await withImap(account, async (client) => {
    const lock = await client.getMailboxLock(path)
    try {
      if (value) await client.messageFlagsAdd(String(uid), [flag], { uid: true })
      else await client.messageFlagsRemove(String(uid), [flag], { uid: true })
    } finally {
      lock.release()
    }
  })
}

export async function getMessage(id: number) {
  const { message, mailbox, account } = loadMessage(id)
  let body = db.select().from(bodies).where(eq(bodies.messageId, id)).get()
  if (!body) {
    const parsed = await parseSource(await fetchSource(account, mailbox.path, message.uid))
    saveBody(db, id, parsed)
    body = { messageId: id, html: parsed.html, text: parsed.text, attachments: parsed.attachments }
  }
  return {
    message: { ...message, role: mailbox.role },
    account: { id: account.id, email: account.email, name: account.name, label: account.label, color: account.color },
    body: { html: body.html, text: body.text, attachments: body.attachments },
  }
}

export function setFlag(id: number, flag: "seen" | "flagged", value: boolean) {
  const { message, mailbox, account } = loadMessage(id)
  const previous = flag === "seen" ? message.seen : message.flagged
  const apply = (next: boolean) => {
    db.update(messages)
      .set({ ...(flag === "seen" ? { seen: next } : { flagged: next }), flagsChangedAt: new Date() })
      .where(eq(messages.id, id))
      .run()
    bumpVersion(db)
  }
  apply(value)
  storeFlag(account, mailbox.path, message.uid, flag === "seen" ? "\\Seen" : "\\Flagged", value).catch((error) => {
    console.error(`Failed to update ${flag} on the server, reverting`, error)
    apply(previous)
  })
  return { ok: true }
}

async function createArchiveMailbox(account: Account) {
  const created = await withImap(account, (client) => client.mailboxCreate("Archive"))
  return db
    .insert(mailboxes)
    .values({ accountId: account.id, path: created.path, role: "archive" })
    .onConflictDoUpdate({ target: [mailboxes.accountId, mailboxes.path], set: { role: "archive" } })
    .returning()
    .get()
}

export async function moveMessage(id: number, to: "inbox" | "archive" | "trash" | "junk") {
  const { message, mailbox, account } = loadMessage(id)
  const existing = db
    .select()
    .from(mailboxes)
    .where(and(eq(mailboxes.accountId, account.id), eq(mailboxes.role, to)))
    .get()
  const target = existing ?? (to === "archive" ? await createArchiveMailbox(account) : undefined)

  if (mailbox.role === "trash" && to === "trash") {
    await withImap(account, async (client) => {
      const lock = await client.getMailboxLock(mailbox.path)
      try {
        await client.messageDelete(String(message.uid), { uid: true })
      } finally {
        lock.release()
      }
    })
    db.delete(messages).where(eq(messages.id, id)).run()
    bumpVersion(db)
    return { ok: true }
  }
  if (!target) throw new Error(`${account.email} has no ${to} folder`)
  if (target.id === mailbox.id) return { ok: true }

  const newUid = await withImap(account, async (client) => {
    const lock = await client.getMailboxLock(mailbox.path)
    try {
      const result = await client.messageMove(String(message.uid), target.path, { uid: true })
      return result ? result.uidMap?.get(message.uid) : undefined
    } finally {
      lock.release()
    }
  })

  if (newUid && newUid <= target.lastUid) {
    db.update(messages).set({ mailboxId: target.id, uid: newUid }).where(eq(messages.id, id)).run()
  } else {
    db.delete(messages).where(eq(messages.id, id)).run()
  }
  bumpVersion(db)
  return { ok: true }
}

function findOriginal(accountId: number, messageId: string | null) {
  if (!messageId) return undefined
  const row = db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.messageId, messageId)))
    .get()
  return row ? loadMessage(row.id) : undefined
}

async function withMailbox(account: Account, path: string, run: (client: ImapFlow) => Promise<unknown>) {
  await withImap(account, async (client) => {
    const lock = await client.getMailboxLock(path)
    try {
      await run(client)
    } finally {
      lock.release()
    }
  })
}

export async function sendMessage(input: {
  accountId: number
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  replyToId?: number
  draftId?: number
}) {
  const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get()
  if (!account) throw new Error("Account not found")

  const draft = input.draftId ? loadMessage(input.draftId) : undefined
  if (draft && draft.mailbox.role !== "drafts") throw new Error("That message is not a draft")

  const original = input.replyToId
    ? loadMessage(input.replyToId)
    : draft && findOriginal(draft.account.id, draft.message.inReplyTo)
  const inReplyTo = original?.message.messageId ?? draft?.message.inReplyTo ?? undefined
  const references = original
    ? [original.message.references, original.message.messageId].filter(Boolean).join(" ")
    : (draft?.message.references ?? undefined)

  const raw = await new MailComposer({
    from: { name: account.name, address: account.email },
    to: input.to,
    cc: input.cc || undefined,
    bcc: input.bcc || undefined,
    subject: input.subject,
    text: input.text,
    inReplyTo,
    references,
  })
    .compile()
    .build()

  const recipients = [input.to, input.cc, input.bcc].filter(Boolean).join(",")
  const transport = createSmtp(account)
  try {
    await transport.sendMail({
      envelope: { from: account.email, to: recipients },
      raw,
    })
  } finally {
    transport.close()
  }

  const sent = db
    .select()
    .from(mailboxes)
    .where(and(eq(mailboxes.accountId, account.id), eq(mailboxes.role, "sent")))
    .get()
  if (sent && account.appendSent) {
    await withImap(account, (client) => client.append(sent.path, raw, ["\\Seen"])).catch((error) =>
      console.error("Sent, but failed to save to Sent folder", error),
    )
  }

  if (original) {
    db.update(messages).set({ answered: true }).where(eq(messages.id, original.message.id)).run()
    await withMailbox(original.account, original.mailbox.path, (client) =>
      client.messageFlagsAdd(String(original.message.uid), ["\\Answered"], { uid: true }),
    ).catch((error) => console.error("Sent, but failed to mark the original as answered", error))
  }

  if (draft) {
    db.delete(messages).where(eq(messages.id, draft.message.id)).run()
    await withMailbox(draft.account, draft.mailbox.path, (client) =>
      client.messageDelete(String(draft.message.uid), { uid: true }),
    ).catch((error) => console.error("Sent, but failed to remove the draft", error))
  }

  requestSync()
  return { ok: true }
}

export function setCategory(id: number, category: Category) {
  setUserCategory(db, id, category)
  return { ok: true }
}

export function dataVersion() {
  return getVersion(db)
}

export function requestSync() {
  setSyncRequest(db)
  return { ok: true }
}

export async function getAttachment(messageId: number, index: number) {
  const { message, mailbox, account } = loadMessage(messageId)
  const { parsed } = await parseSource(await fetchSource(account, mailbox.path, message.uid))
  const file = downloadableAttachments(parsed)[index]
  if (!file) throw new Error("Attachment not found")
  return file
}
