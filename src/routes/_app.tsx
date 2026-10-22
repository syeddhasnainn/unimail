import { useEffect, useRef } from "react"
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { ComposeProvider } from "@/components/mail/compose"
import { Sidebar } from "@/components/mail/sidebar"
import { authQuery, dataVersionQuery, mailKeys, sidebarQuery } from "@/lib/mail-queries"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const { authenticated } = await context.queryClient.query(authQuery())
    if (!authenticated) throw redirect({ to: "/login" })
  },
  loader: ({ context }) => context.queryClient.query({ ...sidebarQuery(), staleTime: "static" }),
  component: AppLayout,
})

function AppLayout() {
  const { data: sidebar } = useSuspenseQuery(sidebarQuery())
  useLiveUpdates()

  return (
    <ComposeProvider accounts={sidebar.accounts}>
      <div className="flex h-svh p-2">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border bg-background">
          <Sidebar data={sidebar} />
          <main className="flex min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ComposeProvider>
  )
}

function useLiveUpdates() {
  const queryClient = useQueryClient()
  const { data: version } = useQuery(dataVersionQuery())
  const seen = useRef(version)

  useEffect(() => {
    if (version === undefined || version === seen.current) return
    if (seen.current !== undefined) queryClient.invalidateQueries({ queryKey: mailKeys.all })
    seen.current = version
  }, [queryClient, version])
}
