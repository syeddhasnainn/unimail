import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authMiddleware } from "./auth.functions"
import * as accounts from "./accounts.server"
import * as discovery from "./discovery.server"

export const listAccounts = createServerFn()
  .middleware([authMiddleware])
  .handler(() => accounts.listAccounts())

export const addAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      email: z.email(),
      password: z.string().min(1),
      name: z.string(),
      label: z.string().optional(),
      imapHost: z.string().min(1),
      imapPort: z.number().int(),
      smtpHost: z.string().min(1),
      smtpPort: z.number().int(),
      username: z.string().optional(),
      appendSent: z.boolean().optional(),
    }),
  )
  .handler(({ data }) => accounts.addAccount(data))

export const discoverMailSettings = createServerFn()
  .middleware([authMiddleware])
  .validator(z.object({ email: z.email() }))
  .handler(({ data }) => discovery.discoverMailSettings(data.email))

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int(),
      name: z.string(),
      label: z.string(),
      color: z.string(),
      password: z.string().optional(),
      imapHost: z.string().optional(),
      imapPort: z.number().int().optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.number().int().optional(),
      username: z.string().optional(),
      appendSent: z.boolean().optional(),
    }),
  )
  .handler(({ data }) => accounts.updateAccount(data))

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().max(80) }))
  .handler(({ data }) => accounts.updateProfile(data.name))

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(({ data }) => accounts.deleteAccount(data.id))
