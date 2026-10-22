import { ImapFlow } from "imapflow"
import type { FetchMessageObject, MessageAddressObject } from "imapflow"
import { simpleParser } from "mailparser"
import type { ParsedMail } from "mailparser"
import type { accounts, Address, AttachmentMeta, MailboxRole } from "./db/schema"
import type { ParsedBody } from "./db/store.server"

export type Account = typeof accounts.$inferSelect

export const MAX_BODY_BYTES = 2 * 1024 * 1024

export type ImapSettings = Pick<Account, "imapHost" | "imapPort" | "username">

export function createImap(account: ImapSettings, password: string) {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: { user: account.username, pass: password },
    logger: false,
  })
}

const SPECIAL_USE_ROLES: Record<string, MailboxRole> = {
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Archive": "archive",
  "\\Trash": "trash",
  "\\Junk": "junk",
}

export function roleFor(path: string, specialUse?: string): MailboxRole | null {
  if (path.toUpperCase() === "INBOX") return "inbox"
  if (specialUse && SPECIAL_USE_ROLES[specialUse]) return SPECIAL_USE_ROLES[specialUse]
  return /^archives?$/i.test(path) ? "archive" : null
}

export function toAddresses(list?: MessageAddressObject[]): Address[] {
  return (list ?? []).filter((a) => a.address).map((a) => ({ name: a.name || undefined, address: a.address! }))
}

export function metadataFrom(msg: FetchMessageObject) {
  const env = msg.envelope
  const from = env?.from?.[0]
  const flags = msg.flags ?? new Set<string>()
  return {
    uid: msg.uid,
    messageId: env?.messageId ?? null,
    inReplyTo: env?.inReplyTo ?? null,
    subject: env?.subject ?? "",
    fromName: from?.name || null,
    fromAddress: from?.address ?? null,
    to: toAddresses(env?.to),
    cc: toAddresses(env?.cc),
    date: env?.date ? new Date(env.date) : msg.internalDate ? new Date(msg.internalDate) : new Date(),
    seen: flags.has("\\Seen"),
    flagged: flags.has("\\Flagged"),
    answered: flags.has("\\Answered"),
    size: msg.size ?? 0,
  }
}

export async function parseSource(source: Buffer): Promise<ParsedBody & { parsed: ParsedMail }> {
  const parsed = await simpleParser(source)
  let html = typeof parsed.html === "string" ? parsed.html : null
  const files = downloadableAttachments(parsed)
  if (html) {
    for (const a of parsed.attachments) {
      if (a.cid && a.size < 1024 * 1024) {
        html = html.replaceAll(`cid:${a.cid}`, `data:${a.contentType};base64,${a.content.toString("base64")}`)
      }
    }
  }
  const text = parsed.text ?? null
  const attachments: AttachmentMeta[] = files.map((a) => ({
    filename: a.filename ?? "attachment",
    contentType: a.contentType,
    size: a.size,
  }))
  return {
    html,
    text,
    references: Array.isArray(parsed.references) ? parsed.references.join(" ") : (parsed.references ?? null),
    snippet: (text ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    attachments,
    parsed,
  }
}

export function downloadableAttachments(parsed: ParsedMail) {
  return parsed.attachments.filter((a) => a.contentDisposition !== "inline" || !a.cid)
}
