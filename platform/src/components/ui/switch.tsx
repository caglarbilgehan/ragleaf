import * as React from "react"

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className = "", checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleClick}
        disabled={disabled}
        ref={ref}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent 
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-primary-600' : 'bg-dark-500'}
          ${className}
        `.trim()}
        {...props}
      >
        <span
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-dark-800/60 shadow-lg ring-0 transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `.trim()}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch }
