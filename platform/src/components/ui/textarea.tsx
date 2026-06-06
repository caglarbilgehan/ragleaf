import * as React from "react"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        className={`
          flex min-h-[80px] w-full rounded-md border border-white/[0.1] bg-dark-700/50 px-3 py-2 text-sm text-gray-100
          placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 
          focus:border-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50
          ${className}
        `.trim()}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
