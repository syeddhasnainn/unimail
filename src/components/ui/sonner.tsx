import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/lib/theme"
import {
  CheckCircleIcon,
  CloseCircleIcon,
  DangerTriangleIcon,
  InfoCircleIcon,
  RefreshIcon,
} from "@solar-icons/react/linear"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" />,
        info: <InfoCircleIcon className="size-4" />,
        warning: <DangerTriangleIcon className="size-4" />,
        error: <CloseCircleIcon className="size-4" />,
        loading: <RefreshIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
