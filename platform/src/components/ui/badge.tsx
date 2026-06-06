import * as React from "react"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: "border-transparent bg-primary-600 text-white hover:bg-primary-700",
      secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 bg-dark-600 text-gray-100",
      destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 bg-red-600 text-white",
      outline: "text-foreground border-white/[0.1] text-gray-300"
    }
    
    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className || ''}`}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
