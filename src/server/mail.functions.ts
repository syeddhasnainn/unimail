import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authMiddleware } from "./auth.functions"
import { categorySchema } from "../lib/categories"
import { folderSchema } from "../lib/folders"
import { recipientError } from "../lib/recipients"
import * as mail from "./mail-actions.server"

export const listMessages = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({
      accountId: z.number().int().optional(),
      folder: folderSchema,
      category: categorySchema.optional(),
      q: z.string().optional(),
      before: z.number().optional(),
    }),
  )
  .handler(({ data }) => mail.listMessages(data))

export const getSidebar = createServerFn()
  .middleware([authMiddleware])
  .handler(() => mail.getSidebar())

export const getMessage = createServerFn()
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(({ data }) => mail.getMessage(data.id))

export const setFlag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int(), flag: z.enum(["seen", "flagged"]), value: z.boolean() }))
  .handler(({ data }) => mail.setFlag(data.id, data.flag, data.value))

export const moveMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int(), to: z.enum(["inbox", "archive", "trash", "junk"]) }))
  .handler(({ data }) => mail.moveMessage(data.id, data.to))

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        accountId: z.number().int(),
        to: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        subject: z.string(),
        text: z.string(),
        replyToId: z.number().int().optional(),
        draftId: z.number().int().optional(),
      })
      .superRefine((data, ctx) => {
        for (const field of ["to", "cc", "bcc"] as const) {
          const message = recipientError(field === "to" ? "To" : field === "cc" ? "Cc" : "Bcc", data[field])
          if (message) ctx.addIssue({ code: "custom", path: [field], message })
        }
      }),
  )
  .handler(({ data }) => mail.sendMessage(data))

export const setCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int(), category: categorySchema }))
  .handler(({ data }) => mail.setCategory(data.id, data.category))

export const getDataVersion = createServerFn()
  .middleware([authMiddleware])
  .handler(() => mail.dataVersion())

export const requestSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(() => mail.requestSync())
