import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useLocation, useNavigate, useRouter, useSearch } from "@tanstack/react-router"
import {
  AltArrowDownIcon,
  ArchiveIcon,
  DangerTriangleIcon,
  FileTextIcon,
  InboxIcon,
  LogoutIcon,
  MenuDotsIcon,
  MonitorIcon,
  MoonStarsIcon,
  PenNewSquareIcon,
  PlaneIcon,
  RefreshIcon,
  SettingsIcon,
  ShieldWarningIcon,
  StarIcon,
  Sun2Icon,
  TrashBinMinimalisticIcon,
} from "@solar-icons/react/linear"
import { UnimailMark } from "@/components/brand"
import type { Icon } from "@/components/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMailActions } from "@/hooks/use-mail-actions"
import { CATEGORIES, CATEGORY_IDS } from "@/lib/categories"
import { FOLDER_TITLES } from "@/lib/folders"
import type { Folder } from "@/lib/folders"
import type { SidebarData } from "@/lib/mail-queries"
import { useTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { logout } from "@/server/auth.functions"
import { useCompose } from "./compose"
import { CategoryIcon } from "./category-icon"

const FOLDERS: { folder: Folder; icon: Icon; count?: "inbox" | "starred" | "drafts" | "junk" }[] = [
  { folder: "inbox", icon: InboxIcon, count: "inbox" },
  { folder: "starred", icon: StarIcon, count: "starred" },
  { folder: "sent", icon: PlaneIcon },
  { folder: "drafts", icon: FileTextIcon, count: "drafts" },
  { folder: "archive", icon: ArchiveIcon },
  { folder: "junk", icon: ShieldWarningIcon, count: "junk" },
  { folder: "trash", icon: TrashBinMinimalisticIcon },
]

export function Sidebar({ data }: { data: SidebarData }) {
  const search = useSearch({ strict: false })
  const onMail = useLocation({ select: (location) => location.pathname === "/mail" })
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const compose = useCompose()
  const folder = search.folder ?? "inbox"

  async function onLogout() {
    await logout()
    queryClient.clear()
    await router.navigate({ to: "/login" })
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground [&_svg]:stroke-2">
      <div className="flex items-center gap-2.5 px-5 pt-4.5 pb-3.5">
        <UnimailMark className="size-5 shrink-0 text-foreground" />
        <span className="truncate text-[13px] font-semibold tracking-tight">Unimail</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2 pb-4">
        <nav className="flex flex-col gap-0.5">
          <SidebarRow icon={PenNewSquareIcon} label="Compose" shortcut="C" onClick={() => compose.open()} />
          {FOLDERS.map(({ folder: f, icon, count }) => (
            <SidebarRow
              key={f}
              icon={icon}
              active={onMail && folder === f && !search.category}
              onClick={() => navigate({ to: "/mail", search: { folder: f, account: search.account } })}
              label={FOLDER_TITLES[f]}
              count={count ? data.counts[count] : undefined}
            />
          ))}
        </nav>

        <Section label="Accounts">
          <SidebarRow
            active={onMail && !search.account}
            onClick={() => navigate({ to: "/mail", search: { folder, category: search.category } })}
            label="All"
            count={data.counts.inbox}
          />
          {data.accounts.map((account) => {
            const active = onMail && search.account === account.id
            return (
              <SidebarRow
                key={account.id}
                active={active}
                onClick={() =>
                  navigate({
                    to: "/mail",
                    search: { folder, account: active ? undefined : account.id, category: search.category },
                  })
                }
                label={account.label}
                title={account.email}
                count={account.unread}
                warning={!!account.syncError}
              />
            )
          })}
          {data.accounts.length === 0 && (
            <Link
              to="/settings"
              className="px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground/70 hover:text-foreground"
            >
              Add your first account
            </Link>
          )}
        </Section>

        <Section label="Categories">
          {CATEGORY_IDS.map((id) => {
            const active = onMail && search.category === id
            return (
              <SidebarRow
                key={id}
                active={active}
                onClick={() =>
                  navigate({
                    to: "/mail",
                    search: { folder: "inbox", account: search.account, category: active ? undefined : id },
                  })
                }
                label={CATEGORIES[id].title}
                count={data.categories[id]}
                leading={<CategoryIcon category={id} className="size-4" />}
              />
            )
          })}
        </Section>
      </div>

      <UserFooter user={data.user} accounts={data.accounts} onLogout={onLogout} />
    </aside>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group/section mb-1 flex h-6 w-full items-center justify-between px-2.5 text-xs font-medium text-muted-foreground/70 hover:text-muted-foreground"
      >
        {label}
        <AltArrowDownIcon
          className={cn("size-3.5 opacity-0 transition group-hover/section:opacity-100", !open && "-rotate-90")}
        />
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </section>
  )
}

function SidebarRow({
  label,
  title,
  count,
  active = false,
  onClick,
  icon: RowIcon,
  leading,
  warning,
  shortcut,
}: {
  label: string
  title?: string
  count?: number
  active?: boolean
  onClick: () => void
  icon?: Icon
  leading?: React.ReactNode
  warning?: boolean
  shortcut?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "group/row flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors",
        active
          ? "bg-foreground/[0.07] font-semibold text-foreground"
          : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {RowIcon && (
        <RowIcon
          className={cn(
            "size-4 shrink-0",
            active ? "text-foreground" : "text-muted-foreground group-hover/row:text-foreground/80",
          )}
        />
      )}
      {leading}
      <span className="flex-1 truncate">{label}</span>
      {warning && <DangerTriangleIcon className="size-3.5 text-destructive" />}
      {shortcut && (
        <span className="text-[11px] text-muted-foreground/60 opacity-0 transition-opacity group-hover/row:opacity-100">
          {shortcut}
        </span>
      )}
      {!!count && (
        <span className={cn("text-[11px] tabular-nums", active ? "text-foreground/70" : "text-muted-foreground/70")}>
          {count}
        </span>
      )}
    </button>
  )
}

const MENU_SURFACE = "flex flex-col gap-0.5 rounded-xl bg-muted p-1.5 shadow-lg ring-0"

const MENU_ITEM =
  "h-8 gap-2.5 rounded-lg pr-2.5 pl-2.5 text-[13px] font-medium text-foreground/70 focus:bg-foreground/[0.07] focus:text-foreground data-open:bg-foreground/[0.07] data-open:text-foreground [&_svg]:stroke-2 [&_svg]:text-muted-foreground"

const THEME_OPTIONS: { value: Theme; label: string; icon: Icon }[] = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: Sun2Icon },
  { value: "dark", label: "Dark", icon: MoonStarsIcon },
]

function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={MENU_ITEM}>
        {resolvedTheme === "dark" ? <MoonStarsIcon /> : <Sun2Icon />}
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={cn("w-40", MENU_SURFACE)}>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEME_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value} className={cn(MENU_ITEM, "pr-8")}>
              <OptionIcon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function UserFooter({
  user,
  accounts,
  onLogout,
}: {
  user: SidebarData["user"]
  accounts: SidebarData["accounts"]
  onLogout: () => void
}) {
  const { sync } = useMailActions()
  const failing = accounts.filter((account) => account.syncError)

  return (
    <div className="border-t p-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-foreground/[0.04] data-[state=open]:bg-foreground/[0.06]">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground/[0.08] text-[13px] font-semibold text-foreground">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold text-foreground">{user.name}</span>
            {failing.length > 0 && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-destructive">
                <DangerTriangleIcon className="size-3 shrink-0" />
                <span className="truncate">
                  {failing.length === 1 ? `${failing[0]?.label} can't sync` : `${failing.length} accounts can't sync`}
                </span>
              </span>
            )}
          </span>
          <MenuDotsIcon className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className={cn("w-(--radix-dropdown-menu-trigger-width)", MENU_SURFACE)}
        >
          <DropdownMenuItem asChild className={MENU_ITEM}>
            <Link to="/settings">
              <SettingsIcon /> Accounts & settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM} onSelect={() => sync.mutate()}>
            <RefreshIcon /> Sync now
          </DropdownMenuItem>
          <ThemeMenu />
          <DropdownMenuItem className={MENU_ITEM} onSelect={onLogout}>
            <LogoutIcon /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
