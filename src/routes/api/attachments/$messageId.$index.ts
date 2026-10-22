import { createFileRoute } from "@tanstack/react-router"
import { isAuthenticated } from "@/server/auth.server"
import { getAttachment } from "@/server/mail-actions.server"

export const Route = createFileRoute("/api/attachments/$messageId/$index")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isAuthenticated()) return new Response("Unauthorized", { status: 401 })
        const file = await getAttachment(Number(params.messageId), Number(params.index))
        const filename = encodeURIComponent(file.filename ?? "attachment")
        return new Response(new Uint8Array(file.content), {
          headers: {
            "content-type": file.contentType,
            "content-disposition": `attachment; filename*=UTF-8''${filename}`,
          },
        })
      },
    },
  },
})
