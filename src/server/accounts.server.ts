import { eq } from "drizzle-orm"
import { COLOR_NAMES } from "../lib/account-colors"
import { encrypt } from "./crypto.server"
import { db } from "./db/client.server"
import { setProfileName } from "./db/store.server"
import { accounts } from "./db/schema"
import { createSmtp, withImap } from "./mail.server"

export type AccountInput = {
  email: string
  password: string
  name: string
  label?: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  username?: string
  appendSent?: boolean
}

type LoginCheck = Pick<AccountInput, "imapHost" | "imapPort" | "smtpHost" | "smtpPort"> & { username: string }

function describeLoginError(error: unknown) {
  const cause = error as { responseText?: string; response?: string; message?: string }
  return cause.responseText ?? cause.response ?? cause.message ?? "unknown error"
}

export function listAccounts() {
  return db
    .select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      label: accounts.label,
      color: accounts.color,
      imapHost: accounts.imapHost,
      imapPort: accounts.imapPort,
      smtpHost: accounts.smtpHost,
      smtpPort: accounts.smtpPort,
      username: accounts.username,
      appendSent: accounts.appendSent,
      syncError: accounts.syncError,
      lastSyncedAt: accounts.lastSyncedAt,
    })
    .from(accounts)
    .orderBy(accounts.createdAt)
    .all()
}

async function verifyLogin(check: LoginCheck, passwordEnc: string) {
  const [imap, smtp] = await Promise.allSettled([
    withImap({ ...check, passwordEnc }, async () => undefined),
    (async () => {
      const transport = createSmtp({ ...check, passwordEnc })
      try {
        await transport.verify()
      } finally {
        transport.close()
      }
    })(),
  ])
  if (imap.status === "rejected")
    throw new Error(`Could not sign in to ${check.imapHost}: ${describeLoginError(imap.reason)}`)
  if (smtp.status === "rejected")
    throw new Error(`Could not sign in to ${check.smtpHost}: ${describeLoginError(smtp.reason)}`)
}

export async function addAccount(input: AccountInput) {
  const email = input.email.trim().toLowerCase()
  const username = input.username?.trim() || email
  const passwordEnc = encrypt(input.password)
  await verifyLogin({ ...input, username }, passwordEnc)

  const used = new Set(
    db
      .select({ color: accounts.color })
      .from(accounts)
      .all()
      .map((a) => a.color),
  )
  const color = COLOR_NAMES.find((c) => !used.has(c)) ?? COLOR_NAMES[used.size % COLOR_NAMES.length] ?? "slate"
  const now = new Date()
  db.insert(accounts)
    .values({
      email,
      name: input.name.trim() || email,
      label: input.label?.trim() || email.split("@")[1]!.split(".")[0]!,
      color,
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      username,
      passwordEnc,
      appendSent: input.appendSent ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return { ok: true }
}

export type AccountUpdate = {
  id: number
  name: string
  label: string
  color: string
  password?: string
  imapHost?: string
  imapPort?: number
  smtpHost?: string
  smtpPort?: number
  username?: string
  appendSent?: boolean
}

export async function updateAccount(input: AccountUpdate) {
  const account = db.select().from(accounts).where(eq(accounts.id, input.id)).get()
  if (!account) throw new Error("Account not found")

  const connection = {
    imapHost: input.imapHost?.trim() || account.imapHost,
    imapPort: input.imapPort ?? account.imapPort,
    smtpHost: input.smtpHost?.trim() || account.smtpHost,
    smtpPort: input.smtpPort ?? account.smtpPort,
    username: input.username?.trim() || account.username,
  }
  const connectionChanged = (Object.keys(connection) as (keyof typeof connection)[]).some(
    (key) => connection[key] !== account[key],
  )
  const passwordEnc = input.password ? encrypt(input.password) : account.passwordEnc
  const needsCheck = Boolean(input.password) || connectionChanged
  if (needsCheck) await verifyLogin(connection, passwordEnc)

  db.update(accounts)
    .set({
      name: input.name.trim() || account.email,
      label: input.label.trim() || account.label,
      color: input.color,
      passwordEnc,
      ...connection,
      appendSent: input.appendSent ?? account.appendSent,
      ...(needsCheck ? { syncError: null, updatedAt: new Date() } : {}),
    })
    .where(eq(accounts.id, input.id))
    .run()
  return { ok: true }
}

export function updateProfile(name: string) {
  setProfileName(db, name.trim())
  return { ok: true }
}

export function deleteAccount(id: number) {
  db.delete(accounts).where(eq(accounts.id, id)).run()
  return { ok: true }
}
