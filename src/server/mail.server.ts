import type { ImapFlow } from "imapflow"
import { createTransport } from "nodemailer"
import { decrypt } from "./crypto.server"
import { createImap } from "./imap.server"
import type { Account, ImapSettings } from "./imap.server"

export async function withImap<T>(
  account: ImapSettings & Pick<Account, "passwordEnc">,
  fn: (client: ImapFlow) => Promise<T>,
) {
  const client = createImap(account, decrypt(account.passwordEnc))
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout().catch(() => client.close())
  }
}

type SmtpSettings = Pick<Account, "smtpHost" | "smtpPort" | "username" | "passwordEnc">

export function createSmtp(account: SmtpSettings) {
  const secure = account.smtpPort === 465
  return createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure,
    requireTLS: !secure,
    auth: { user: account.username, pass: decrypt(account.passwordEnc) },
  })
}
