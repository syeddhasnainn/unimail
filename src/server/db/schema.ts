import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { Category } from "../../lib/categories"

export const accounts = sqliteTable("accounts", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text().notNull(),
  label: text().notNull(),
  color: text().notNull(),
  imapHost: text().notNull(),
  imapPort: integer().notNull(),
  smtpHost: text().notNull(),
  smtpPort: integer().notNull(),
  username: text().notNull(),
  passwordEnc: text().notNull(),
  appendSent: integer({ mode: "boolean" }).notNull().default(true),
  syncError: text(),
  lastSyncedAt: integer({ mode: "timestamp_ms" }),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
})

export const mailboxes = sqliteTable(
  "mailboxes",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    accountId: integer()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    path: text().notNull(),
    role: text().$type<MailboxRole>(),
    uidValidity: text(),
    lastUid: integer().notNull().default(0),
  },
  (t) => [uniqueIndex("mailboxes_account_path").on(t.accountId, t.path)],
)

export const messages = sqliteTable(
  "messages",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    accountId: integer()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    mailboxId: integer()
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    uid: integer().notNull(),
    messageId: text(),
    inReplyTo: text(),
    references: text(),
    subject: text().notNull().default(""),
    fromName: text(),
    fromAddress: text(),
    to: text({ mode: "json" }).$type<Address[]>().notNull().default([]),
    cc: text({ mode: "json" }).$type<Address[]>().notNull().default([]),
    date: integer({ mode: "timestamp_ms" }).notNull(),
    snippet: text().notNull().default(""),
    seen: integer({ mode: "boolean" }).notNull().default(false),
    flagged: integer({ mode: "boolean" }).notNull().default(false),
    answered: integer({ mode: "boolean" }).notNull().default(false),
    hasAttachments: integer({ mode: "boolean" }).notNull().default(false),
    size: integer().notNull().default(0),
    category: text().$type<Category>(),
    categoryReason: text(),
    categorySource: text().$type<CategorySource>(),
    classifyAttempts: integer().notNull().default(0),
    flagsChangedAt: integer({ mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("messages_mailbox_uid").on(t.mailboxId, t.uid),
    index("messages_category").on(t.category),
    index("messages_date").on(t.date),
    index("messages_account_date").on(t.accountId, t.date),
  ],
)

export const bodies = sqliteTable("bodies", {
  messageId: integer()
    .primaryKey()
    .references(() => messages.id, { onDelete: "cascade" }),
  html: text(),
  text: text(),
  attachments: text({ mode: "json" }).$type<AttachmentMeta[]>().notNull().default([]),
})

export const classifications = sqliteTable(
  "classifications",
  {
    accountId: integer()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    messageId: text().notNull(),
    category: text().$type<Category>().notNull(),
    reason: text(),
    source: text().$type<CategorySource>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.messageId] })],
)

export const meta = sqliteTable("meta", {
  key: text().primaryKey(),
  value: text().notNull(),
})

export type CategorySource = "ai" | "user" | "sender"
export type MailboxRole = "inbox" | "sent" | "drafts" | "archive" | "trash" | "junk"
export type Address = { name?: string; address: string }
export type AttachmentMeta = { filename: string; contentType: string; size: number }
