export type UsernameStyle = "email" | "localpart"

export type MailServers = {
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  usernameStyle: UsernameStyle
  appendSent: boolean
}

type Provider = {
  name: string
  domains: string[]
  hostSuffixes: string[]
  servers: MailServers
  note?: { text: string; href?: string; linkLabel?: string }
}

const servers = (
  imapHost: string,
  smtpHost: string,
  smtpPort: number,
  options: Partial<Pick<MailServers, "appendSent" | "usernameStyle">> = {},
): MailServers => ({
  imapHost,
  imapPort: 993,
  smtpHost,
  smtpPort,
  usernameStyle: options.usernameStyle ?? "email",
  appendSent: options.appendSent ?? true,
})

export const PROVIDERS = {
  purelymail: {
    name: "Purelymail",
    domains: ["purelymail.com"],
    hostSuffixes: ["purelymail.com"],
    servers: servers("imap.purelymail.com", "smtp.purelymail.com", 465),
  },
  gmail: {
    name: "Gmail",
    domains: ["gmail.com", "googlemail.com"],
    hostSuffixes: ["google.com", "googlemail.com", "gmail.com"],
    servers: servers("imap.gmail.com", "smtp.gmail.com", 465, { appendSent: false }),
    note: {
      text: "Gmail needs an app password (turn on 2-Step Verification first).",
      href: "https://myaccount.google.com/apppasswords",
      linkLabel: "Create one",
    },
  },
  outlook: {
    name: "Outlook",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    hostSuffixes: ["outlook.com", "office365.com"],
    servers: servers("outlook.office365.com", "smtp.office365.com", 587, { appendSent: false }),
    note: {
      text: "Microsoft usually blocks password sign-in for Outlook accounts. Sign in with Microsoft is coming next.",
    },
  },
  icloud: {
    name: "iCloud Mail",
    domains: ["icloud.com", "me.com", "mac.com"],
    hostSuffixes: ["mail.me.com", "icloud.com"],
    servers: servers("imap.mail.me.com", "smtp.mail.me.com", 587),
    note: {
      text: "iCloud needs an app-specific password.",
      href: "https://account.apple.com/account/manage",
      linkLabel: "Create one",
    },
  },
  yahoo: {
    name: "Yahoo Mail",
    domains: ["yahoo.com", "ymail.com", "rocketmail.com"],
    hostSuffixes: ["yahoo.com"],
    servers: servers("imap.mail.yahoo.com", "smtp.mail.yahoo.com", 465),
    note: {
      text: "Yahoo needs an app password.",
      href: "https://login.yahoo.com/account/security",
      linkLabel: "Create one",
    },
  },
  aol: {
    name: "AOL Mail",
    domains: ["aol.com"],
    hostSuffixes: ["aol.com"],
    servers: servers("imap.aol.com", "smtp.aol.com", 465),
    note: {
      text: "AOL needs an app password.",
      href: "https://login.aol.com/account/security",
      linkLabel: "Create one",
    },
  },
  fastmail: {
    name: "Fastmail",
    domains: ["fastmail.com", "fastmail.fm"],
    hostSuffixes: ["fastmail.com", "messagingengine.com"],
    servers: servers("imap.fastmail.com", "smtp.fastmail.com", 465),
    note: {
      text: "Fastmail needs an app password.",
      href: "https://app.fastmail.com/settings/security/apps",
      linkLabel: "Create one",
    },
  },
  zoho: {
    name: "Zoho Mail",
    domains: ["zoho.com", "zohomail.com"],
    hostSuffixes: ["zoho.com", "zohomail.com"],
    servers: servers("imap.zoho.com", "smtp.zoho.com", 465),
    note: { text: "If you use two-factor authentication, use an app-specific password." },
  },
  titan: {
    name: "Titan Mail",
    domains: ["titan.email"],
    hostSuffixes: ["titan.email"],
    servers: servers("imap.titan.email", "smtp.titan.email", 465),
  },
  gmx: {
    name: "GMX",
    domains: ["gmx.com", "gmx.us", "gmx.co.uk"],
    hostSuffixes: ["gmx.com", "gmx.net"],
    servers: servers("imap.gmx.com", "mail.gmx.com", 465),
  },
} satisfies Record<string, Provider>

export type ProviderId = keyof typeof PROVIDERS

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export function providerForHost(host: string): ProviderId | null {
  const normalized = host.toLowerCase().replace(/\.$/, "")
  const match = PROVIDER_IDS.find((id) =>
    PROVIDERS[id].hostSuffixes.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)),
  )
  return match ?? null
}

export function providerNote(id: ProviderId | null) {
  if (!id) return undefined
  const provider: Provider = PROVIDERS[id]
  return provider.note
}

export function usernameFor(email: string, style: UsernameStyle) {
  return style === "localpart" ? (email.split("@")[0] ?? email) : email
}
