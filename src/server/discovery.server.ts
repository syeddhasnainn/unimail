import { resolveMx, resolveSrv } from "node:dns/promises"
import { XMLParser } from "fast-xml-parser"
import { PROVIDERS, providerForHost } from "../lib/mail-providers"
import type { MailServers, ProviderId } from "../lib/mail-providers"

export type DiscoveredSettings = MailServers & {
  provider: ProviderId | null
  source: "preset" | "ispdb" | "autoconfig" | "mx" | "srv"
}

const FETCH_TIMEOUT_MS = 4000

type ServerEntry = { "@_type"?: string; hostname?: string; port?: number; socketType?: string; username?: string }

const xml = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "incomingServer" || name === "outgoingServer",
})

function pickServer(entries: ServerEntry[] | undefined, type: "imap" | "smtp") {
  const candidates = (entries ?? []).filter((entry) => entry["@_type"] === type && entry.hostname && entry.port)
  return (
    candidates.find((entry) => entry.socketType === "SSL") ??
    candidates.find((entry) => entry.socketType === "STARTTLS")
  )
}

function parseClientConfig(body: string): Omit<MailServers, "appendSent"> | undefined {
  const parsed = xml.parse(body) as {
    clientConfig?: { emailProvider?: { incomingServer?: ServerEntry[]; outgoingServer?: ServerEntry[] } }
  }
  const provider = parsed.clientConfig?.emailProvider
  const imap = pickServer(provider?.incomingServer, "imap")
  const smtp = pickServer(provider?.outgoingServer, "smtp")
  if (!imap?.hostname || !imap.port || !smtp?.hostname || !smtp.port) return undefined
  return {
    imapHost: imap.hostname,
    imapPort: Number(imap.port),
    smtpHost: smtp.hostname,
    smtpPort: Number(smtp.port),
    usernameStyle: imap.username === "%EMAILLOCALPART%" ? "localpart" : "email",
  }
}

async function fetchClientConfig(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" })
    if (!response.ok) return undefined
    return parseClientConfig(await response.text())
  } catch {
    return undefined
  }
}

function registrableDomain(host: string) {
  return host.replace(/\.$/, "").split(".").slice(-2).join(".")
}

function withProviderDefaults(
  settings: Omit<MailServers, "appendSent">,
): MailServers & { provider: ProviderId | null } {
  const provider = providerForHost(settings.imapHost)
  return { ...settings, provider, appendSent: provider ? PROVIDERS[provider].servers.appendSent : true }
}

async function firstSrvRecord(name: string) {
  try {
    const records = await resolveSrv(name)
    return records.filter((r) => r.name && r.name !== ".").toSorted((a, b) => a.priority - b.priority)[0]
  } catch {
    return undefined
  }
}

async function fromSrv(domain: string): Promise<Omit<MailServers, "appendSent"> | undefined> {
  const [imaps, imap, submissions, submission] = await Promise.all([
    firstSrvRecord(`_imaps._tcp.${domain}`),
    firstSrvRecord(`_imap._tcp.${domain}`),
    firstSrvRecord(`_submissions._tcp.${domain}`),
    firstSrvRecord(`_submission._tcp.${domain}`),
  ])
  const incoming = imaps ?? imap
  const outgoing = submissions ?? submission
  if (!incoming || !outgoing) return undefined
  return {
    imapHost: incoming.name,
    imapPort: incoming.port,
    smtpHost: outgoing.name,
    smtpPort: outgoing.port,
    usernameStyle: "email",
  }
}

export async function discoverMailSettings(email: string): Promise<DiscoveredSettings | null> {
  const domain = email.split("@")[1]?.trim().toLowerCase()
  if (!domain) return null

  const preset = Object.entries(PROVIDERS).find(([, provider]) => provider.domains.includes(domain))
  if (preset) {
    const [id, provider] = preset
    return { ...provider.servers, provider: id as ProviderId, source: "preset" }
  }

  const ispdb = await fetchClientConfig(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`)
  if (ispdb) return { ...withProviderDefaults(ispdb), source: "ispdb" }

  const query = `emailaddress=${encodeURIComponent(email)}`
  const autoconfig =
    (await fetchClientConfig(`https://autoconfig.${domain}/mail/config-v1.1.xml?${query}`)) ??
    (await fetchClientConfig(`https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml?${query}`))
  if (autoconfig) return { ...withProviderDefaults(autoconfig), source: "autoconfig" }

  const mx = await resolveMx(domain).catch(() => [])
  const primary = mx.toSorted((a, b) => a.priority - b.priority)[0]?.exchange
  if (primary) {
    const hosted = providerForHost(primary)
    if (hosted) return { ...PROVIDERS[hosted].servers, provider: hosted, source: "mx" }
    const mxDomain = registrableDomain(primary)
    const viaMx = await fetchClientConfig(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(mxDomain)}`)
    if (viaMx) return { ...withProviderDefaults(viaMx), source: "mx" }
  }

  const srv = await fromSrv(domain)
  if (srv) return { ...withProviderDefaults(srv), source: "srv" }

  return null
}
