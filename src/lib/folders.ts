import { z } from "zod"

export const folderSchema = z.enum(["inbox", "starred", "sent", "drafts", "archive", "trash", "junk"])

export type Folder = z.infer<typeof folderSchema>

export const FOLDER_TITLES: Record<Folder, string> = {
  inbox: "Inbox",
  starred: "Starred",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  junk: "Junk",
  trash: "Trash",
}
