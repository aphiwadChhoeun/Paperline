import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn, safeHexColor } from './utils'

const inputClasses =
  'h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[12px] text-ink placeholder:text-faint transition-colors focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-100'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted"
      >
        <span>{label}</span>
      </label>
      {children}
      {hint ? <p className="text-[10px] leading-4 text-faint">{hint}</p> : null}
    </div>
  )
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...props} />
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  suffix?: string
}

export function NumberInput({ className, suffix, ...props }: NumberInputProps) {
  return (
    <div className="relative">
      <input
        type="number"
        className={cn(
          inputClasses,
          'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          suffix && 'pr-8',
          className,
        )}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-faint">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        inputClasses,
        'h-auto min-h-[72px] resize-none py-2 leading-5 focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-100',
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(inputClasses, 'cursor-pointer appearance-none pr-8', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}

interface ColorControlProps {
  label: string
  value: string
  onChange: (value: string) => void
  presets?: string[]
  allowCustom?: boolean
}

export function ColorControl({
  label,
  value,
  onChange,
  presets = [],
  allowCustom = true,
}: ColorControlProps) {
  const hex = safeHexColor(value)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.length > 0 ? (
        <div className="flex items-center gap-1.5">
          {presets.map((preset) => {
            const selected = preset.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={preset}
                type="button"
                aria-label={`${label}: ${preset}`}
                aria-pressed={selected}
                onClick={() => onChange(preset)}
                className={cn(
                  'focus-ring h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110',
                  selected && 'ring-2 ring-accent-400 ring-offset-1',
                )}
                style={{ backgroundColor: preset }}
              />
            )
          })}
        </div>
      ) : null}
      {allowCustom ? (
        <label className="focus-within:ring-2 focus-within:ring-accent-100 relative flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5">
          <span
            className="h-4 w-4 overflow-hidden rounded-full border border-black/10"
            style={{ backgroundColor: hex }}
          >
            <input
              type="color"
              value={hex}
              aria-label={`${label} custom color`}
              onChange={(event) => onChange(event.target.value)}
              className="h-full w-full cursor-pointer opacity-0"
            />
          </span>
          <span className="font-mono text-[10px] uppercase leading-none text-ink-soft">
            {value}
          </span>
        </label>
      ) : null}
    </div>
  )
}

interface RangeControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  onCommit?: () => void
  formatValue?: (value: number) => string
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  formatValue,
}: RangeControlProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
        <span className="text-[10px] font-medium tabular-nums text-ink-soft">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="ui-range h-1.5 w-full cursor-pointer rounded-full bg-line"
      />
    </div>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-ring flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
              selected
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(20,19,16,0.08)]'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label ? <span>{option.label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'focus-ring relative h-[18px] w-8 shrink-0 rounded-full border transition-colors',
        checked
          ? 'border-accent-500 bg-accent-500'
          : 'border-line-strong bg-surface-muted',
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[14px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
