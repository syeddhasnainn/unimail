import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type { InfiniteData } from "@tanstack/react-query"
import { listAccounts } from "@/server/accounts.functions"
import { getAuthState } from "@/server/auth.functions"
import { getDataVersion, getMessage, getSidebar, listMessages } from "@/server/mail.functions"
import type { Category } from "./categories"
import type { Folder } from "./folders"

export type MessageFilters = {
  folder: Folder
  account?: number
  category?: Category
  q?: string
}

export const mailKeys = {
  all: ["mail"] as const,
  sidebar: () => [...mailKeys.all, "sidebar"] as const,
  lists: () => [...mailKeys.all, "list"] as const,
  list: (filters: MessageFilters) => [...mailKeys.lists(), filters] as const,
  message: (id: number) => [...mailKeys.all, "message", id] as const,
}

export const authQuery = () =>
  queryOptions({
    queryKey: ["auth"],
    queryFn: () => getAuthState(),
    staleTime: 5 * 60_000,
  })

export const dataVersionQuery = () =>
  queryOptions({
    queryKey: ["data-version"],
    queryFn: () => getDataVersion(),
    staleTime: 0,
    refetchInterval: 4000,
  })

export const accountsQuery = () =>
  queryOptions({
    queryKey: ["accounts"],
    queryFn: () => listAccounts(),
  })

export const sidebarQuery = () =>
  queryOptions({
    queryKey: mailKeys.sidebar(),
    queryFn: () => getSidebar(),
  })

export const messageListQuery = (filters: MessageFilters) =>
  infiniteQueryOptions({
    queryKey: mailKeys.list(filters),
    queryFn: ({ pageParam }) =>
      listMessages({
        data: {
          folder: filters.folder,
          accountId: filters.account,
          category: filters.category,
          q: filters.q,
          before: pageParam,
        },
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => {
      const last = page.messages.at(-1)
      return page.hasMore && last ? new Date(last.date).getTime() : undefined
    },
  })

export const messageQuery = (id: number) =>
  queryOptions({
    queryKey: mailKeys.message(id),
    queryFn: () => getMessage({ data: { id } }),
  })

export type MessagePage = Awaited<ReturnType<typeof listMessages>>
export type MessageListData = InfiniteData<MessagePage, number | undefined>
export type MessageRow = MessagePage["messages"][number]
export type LoadedMessage = Awaited<ReturnType<typeof getMessage>>
export type SidebarData = Awaited<ReturnType<typeof getSidebar>>
