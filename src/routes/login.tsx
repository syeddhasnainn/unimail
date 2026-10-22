import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { UnimailMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authQuery } from "@/lib/mail-queries"
import { login } from "@/server/auth.functions"

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const { authenticated } = await context.queryClient.query(authQuery())
    if (authenticated) throw redirect({ to: "/mail" })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState("")
  const signIn = useMutation({
    mutationFn: (value: string) => login({ data: { password: value } }),
    onSuccess: () => {
      queryClient.setQueryData(authQuery().queryKey, { authenticated: true })
      return navigate({ to: "/mail" })
    },
  })
  const error = signIn.error ? signIn.error.message || "Login failed" : null
  const pending = signIn.isPending || signIn.isSuccess

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    signIn.mutate(password)
  }

  return (
    <main className="grid min-h-svh place-items-center px-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <div className="mb-4 flex items-center gap-2 text-lg font-medium">
          <UnimailMark className="size-7 text-foreground" />
          Unimail
        </div>
        <Input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending || !password}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  )
}
