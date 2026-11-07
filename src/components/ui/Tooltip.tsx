import type { ReactNode } from 'react'
import { cn } from './utils'

type TooltipSide = 'right' | 'left' | 'top' | 'bottom'

const sideClasses: Record<TooltipSide, string> = {
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
}

interface TooltipProps {
  label: string
  shortcut?: string
  side?: TooltipSide
  children: ReactNode
}

export function Tooltip({ label, shortcut, side = 'right', children }: TooltipProps) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-50 flex items-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-float transition-opacity duration-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          sideClasses[side],
        )}
      >
        {label}
        {shortcut ? (
          <kbd className="rounded border border-white/20 px-1 py-px font-sans text-[9px] font-normal text-white/70">
            {shortcut}
          </kbd>
        ) : null}
      </span>
    </span>
  )
}
