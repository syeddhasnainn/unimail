import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { QueryClient, QueryKey } from "@tanstack/react-query"
import { toast } from "sonner"
import { CATEGORIES } from "@/lib/categories"
import type { Category } from "@/lib/categories"
import { mailKeys } from "@/lib/mail-queries"
import type { LoadedMessage, MessageListData, MessageRow } from "@/lib/mail-queries"
import { moveMessage, requestSync, setCategory, setFlag } from "@/server/mail.functions"

export type MoveTarget = "inbox" | "archive" | "trash" | "junk"

export type MessageRef = Pick<MessageRow, "id" | "seen" | "flagged" | "role" | "category">

type MessagePatch = Partial<Pick<MessageRow, "seen" | "flagged" | "category" | "categoryReason">>

type Snapshot = Array<[QueryKey, unknown]>

function patchMessage(queryClient: QueryClient, id: number, patch: MessagePatch | "remove") {
  queryClient.setQueriesData<MessageListData>({ queryKey: mailKeys.lists() }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            messages:
              patch === "remove"
                ? page.messages.filter((m) => m.id !== id)
                : page.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          })),
        }
      : data,
  )
  if (patch !== "remove") {
    queryClient.setQueryData<LoadedMessage>(mailKeys.message(id), (data) =>
      data ? { ...data, message: { ...data.message, ...patch } } : data,
    )
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}

function moveLabel(message: MessageRef, to: MoveTarget) {
  if (to === "trash") return message.role === "trash" ? "Deleted forever" : "Moved to trash"
  if (to === "junk") return "Reported as spam"
  return to === "archive" ? "Archived" : "Moved to inbox"
}

export function useMailActions() {
  const queryClient = useQueryClient()

  async function applyOptimistic(id: number, patch: MessagePatch | "remove"): Promise<Snapshot> {
    await queryClient.cancelQueries({ queryKey: mailKeys.all })
    const snapshot = queryClient.getQueriesData({ queryKey: mailKeys.all })
    patchMessage(queryClient, id, patch)
    return snapshot
  }

  function rollback(error: unknown, snapshot: Snapshot | undefined) {
    snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data))
    toast.error(errorMessage(error))
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: mailKeys.all })

  const setSeen = useMutation({
    mutationFn: ({ id, seen }: { id: number; seen: boolean }) => setFlag({ data: { id, flag: "seen", value: seen } }),
    onMutate: ({ id, seen }) => applyOptimistic(id, { seen }),
    onError: (error, _vars, snapshot) => rollback(error, snapshot),
    onSettled: refresh,
  })

  const setStarred = useMutation({
    mutationFn: ({ id, flagged }: { id: number; flagged: boolean }) =>
      setFlag({ data: { id, flag: "flagged", value: flagged } }),
    onMutate: ({ id, flagged }) => applyOptimistic(id, { flagged }),
    onError: (error, _vars, snapshot) => rollback(error, snapshot),
    onSettled: refresh,
  })

  const categorize = useMutation({
    mutationFn: ({ id, category }: { id: number; category: Category }) => setCategory({ data: { id, category } }),
    onMutate: ({ id, category }) => applyOptimistic(id, { category, categoryReason: "Set by you" }),
    onSuccess: (_result, { category }) =>
      toast(`Moved to ${CATEGORIES[category].title}. Other emails from this sender will follow.`),
    onError: (error, _vars, snapshot) => rollback(error, snapshot),
    onSettled: refresh,
  })

  const move = useMutation({
    mutationFn: ({ message, to }: { message: MessageRef; to: MoveTarget }) =>
      moveMessage({ data: { id: message.id, to } }),
    onMutate: ({ message }) => applyOptimistic(message.id, "remove"),
    onSuccess: (_result, { message, to }) => toast(moveLabel(message, to)),
    onError: (error, _vars, snapshot) => rollback(error, snapshot),
    onSettled: refresh,
  })

  const sync = useMutation({
    mutationFn: () => requestSync(),
    onSuccess: () => toast("Syncing all accounts…"),
    onError: (error) => toast.error(errorMessage(error)),
  })

  return { setSeen, setStarred, categorize, move, sync }
}
