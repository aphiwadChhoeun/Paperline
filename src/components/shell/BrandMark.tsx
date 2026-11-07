import { cn } from '../ui/utils'

interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 30 30"
      aria-hidden="true"
      className={cn('h-[30px] w-[30px] shrink-0', className)}
    >
      <rect width="30" height="30" rx="8.5" fill="#181817" />
      <path
        d="M10.75 8.5h5.6l3.9 3.9v9.1h-9.5V8.5Z"
        stroke="#f5f4ef"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M16.25 8.65v3.75h3.8" stroke="#f5f4ef" strokeWidth="1.15" />
      <path
        d="M13.3 14.8h4.4M13.3 17.4h3"
        stroke="#a1a8ff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
