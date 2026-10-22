import Markdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

const heading = ({ children }: { children?: React.ReactNode }) => <p className="font-semibold">{children}</p>

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="break-all underline underline-offset-2">
      {children}
    </a>
  ),
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
}

type MarkdownNode = { type: string; children?: MarkdownNode[]; position?: { start: { offset?: number } } }

function remarkEmailBold() {
  return (tree: MarkdownNode, file: { value: unknown }) => {
    const source = String(file.value)
    const walk = (node: MarkdownNode) => {
      if (node.type === "emphasis" && source[node.position?.start.offset ?? -1] === "*") node.type = "strong"
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

const remarkPlugins = [remarkGfm, remarkBreaks, remarkEmailBold]

export function EmailMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "break-words [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-foreground/[0.06] [&_code]:px-1 [&_hr]:my-3 [&_hr]:border-border [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-foreground/80 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    >
      <Markdown remarkPlugins={remarkPlugins} components={components} disallowedElements={["img"]} unwrapDisallowed>
        {children}
      </Markdown>
    </div>
  )
}
