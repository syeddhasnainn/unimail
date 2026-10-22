import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { deleteCookie, setCookie } from "@tanstack/react-start/server"
import { z } from "zod"
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, isAuthenticated } from "./auth.server"
import { safeEqual } from "./crypto.server"
import { env } from "./env.server"

export const authMiddleware = createMiddleware({ type: "function" }).server(({ next }) => {
  if (!isAuthenticated()) throw new Error("Unauthorized")
  return next()
})

export const getAuthState = createServerFn().handler(() => ({ authenticated: isAuthenticated() }))

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1) }))
  .handler(({ data }) => {
    if (!safeEqual(data.password, env.password)) throw new Error("Wrong password")
    setCookie(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    })
    return { ok: true }
  })

export const logout = createServerFn({ method: "POST" }).handler(() => {
  deleteCookie(SESSION_COOKIE, { path: "/" })
  return { ok: true }
})
