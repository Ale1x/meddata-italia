import * as React from "react"
import { cn } from "@/lib/utils"

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="alert" className={cn("relative w-full rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive", className)} {...props} />
}
