import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-xl text-sm font-bold",
    "transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
    "disabled:pointer-events-none disabled:opacity-50",
    "shadow-sm",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-sky-500/25",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25",
        outline:
          "border border-border/60 bg-background/50 text-foreground hover:bg-background/70",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        ghost:
          "text-foreground hover:bg-background/60",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
