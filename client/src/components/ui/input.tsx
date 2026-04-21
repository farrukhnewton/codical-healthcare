import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          [
            "flex h-11 w-full rounded-xl",
            "border border-border/60",
            "bg-background/60 backdrop-blur-md",
            "px-4 py-2",
            "text-sm font-medium text-foreground",
            "placeholder:text-muted-foreground/70",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors",
          ].join(" "),
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
