"use client"

import { useAppearance } from "@/components/providers/appearance-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { mode } = useAppearance()

  return (
    <Sonner
      theme={mode}
      className="toaster group"
      icons={{
        success: (
          // Only the icon carries the color. The toast stays plain, so the message reads the same in every theme.
          <CircleCheckIcon className="text-success size-4" />
        ),
        info: (
          <InfoIcon className="text-info size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="text-warning size-4" />
        ),
        error: (
          <OctagonXIcon className="text-destructive size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
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
