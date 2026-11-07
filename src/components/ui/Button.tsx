import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-500 text-white shadow-[0_1px_2px_rgba(35,32,80,0.22)] hover:bg-accent-600 active:bg-accent-700',
  secondary:
    'border border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-muted hover:text-ink',
  ghost: 'text-muted hover:bg-surface-muted hover:text-ink',
  danger:
    'border border-[#f3c6c2] bg-[#fffafa] text-[#b42318] hover:border-[#eeaaa4] hover:bg-[#fef3f2]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-[11px]',
  md: 'h-8 px-3 text-[12px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'focus-ring inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

type IconButtonSize = 'sm' | 'md'

const iconSizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-6 w-6 rounded-md',
  md: 'h-8 w-8 rounded-lg',
}

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  label: string
  variant?: ButtonVariant
  size?: IconButtonSize
  active?: boolean
  children: ReactNode
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  className,
  type = 'button',
  children,
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'focus-ring inline-flex shrink-0 select-none items-center justify-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35',
        iconSizeClasses[size],
        variantClasses[variant],
        variant === 'ghost' && size === 'sm' && 'hover:bg-surface-muted',
        active && 'bg-accent-50 text-accent-600 hover:bg-accent-100',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
