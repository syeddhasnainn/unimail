import {
  ArchiveIcon,
  InboxIcon,
  LetterIcon,
  LetterOpenedIcon,
  PenNewSquareIcon,
  ReplyIcon,
  ShieldWarningIcon,
  SidebarMinimalisticIcon,
  TagIcon,
  TrashBinMinimalisticIcon,
} from "@solar-icons/react/linear"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { StarToggleIcon } from "@/components/icons"
import type { MessageRef, MoveTarget } from "@/hooks/use-mail-actions"
import { CATEGORIES, CATEGORY_IDS, isCategory } from "@/lib/categories"
import type { Category } from "@/lib/categories"
import { CategoryIcon } from "./category-icon"

export type MessageActions = {
  open: (message: MessageRef) => void
  reply: (message: MessageRef) => void
  editDraft: (message: MessageRef) => void
  setSeen: (message: MessageRef, seen: boolean) => void
  toggleStar: (message: MessageRef) => void
  setCategory: (message: MessageRef, category: Category) => void
  move: (message: MessageRef, to: MoveTarget) => void
}

export function MessageContextMenu({
  message,
  actions,
  children,
}: {
  message: MessageRef
  actions: MessageActions
  children: React.ReactNode
}) {
  const { role } = message
  const canArchive = role === "inbox"
  const canRestore = role === "archive" || role === "junk" || role === "trash"
  const canReportSpam = role === "inbox" || role === "archive"

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => actions.open(message)}>
          <SidebarMinimalisticIcon />
          Open
        </ContextMenuItem>
        {role === "drafts" ? (
          <ContextMenuItem onSelect={() => actions.editDraft(message)}>
            <PenNewSquareIcon />
            Edit draft
            <ContextMenuShortcut>R</ContextMenuShortcut>
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onSelect={() => actions.reply(message)}>
            <ReplyIcon />
            Reply
            <ContextMenuShortcut>R</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => actions.setSeen(message, !message.seen)}>
          {message.seen ? <LetterIcon /> : <LetterOpenedIcon />}
          {message.seen ? "Mark as unread" : "Mark as read"}
          <ContextMenuShortcut>U</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.toggleStar(message)}>
          <StarToggleIcon starred={message.flagged} />
          {message.flagged ? "Unstar" : "Star"}
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        {role === "inbox" && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <TagIcon />
              Category
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuRadioGroup
                value={message.category ?? ""}
                onValueChange={(value) => isCategory(value) && actions.setCategory(message, value)}
              >
                {CATEGORY_IDS.map((id) => (
                  <ContextMenuRadioItem key={id} value={id}>
                    <CategoryIcon category={id} className="size-4" />
                    {CATEGORIES[id].title}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />
        {canArchive && (
          <ContextMenuItem onSelect={() => actions.move(message, "archive")}>
            <ArchiveIcon />
            Archive
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {canRestore && (
          <ContextMenuItem onSelect={() => actions.move(message, "inbox")}>
            <InboxIcon />
            {role === "junk" ? "Not spam" : "Move to inbox"}
          </ContextMenuItem>
        )}
        {canReportSpam && (
          <ContextMenuItem onSelect={() => actions.move(message, "junk")}>
            <ShieldWarningIcon />
            Report spam
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onSelect={() => actions.move(message, "trash")}>
          <TrashBinMinimalisticIcon />
          {role === "trash" ? "Delete forever" : "Move to trash"}
          <ContextMenuShortcut>#</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
