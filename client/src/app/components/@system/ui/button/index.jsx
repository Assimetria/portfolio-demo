import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/app/lib/@system/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-brand-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-brand-primary text-brand-text-on-primary hover:bg-brand-primary/90",
        destructive: "bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90",
        outline: "border border-brand-border bg-brand-bg hover:bg-brand-surface-hover hover:text-brand-text",
        secondary: "bg-brand-surface text-brand-text hover:bg-brand-surface-hover",
        ghost: "hover:bg-brand-surface-hover hover:text-brand-text",
        link: "text-brand-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-9 rounded-md px-3 text-sm",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, iconLeft, iconRight, loading = false, fullWidth = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && "w-full",
          !asChild && (iconLeft || iconRight || loading) && "gap-2",
          className
        )}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : iconLeft ? (
              <span className="inline-flex shrink-0">{iconLeft}</span>
            ) : null}
            {children}
            {!loading && iconRight && (
              <span className="inline-flex shrink-0">{iconRight}</span>
            )}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
