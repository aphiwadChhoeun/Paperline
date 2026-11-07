import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const rounded = exponent === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)
  return `${rounded} ${units[exponent]}`
}

export function formatDimensions(width: number, height: number) {
  const inches = (value: number) => (value / 72).toFixed(value % 72 === 0 ? 0 : 1)
  return `${inches(width)} × ${inches(height)} in`
}

export function formatSavedAt(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) {
    const minutes = Math.round(diff / 60_000)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diff < 86_400_000) {
    const hours = Math.round(diff / 3_600_000)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

export const isApplePlatform =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)

export const modKeyLabel = isApplePlatform ? '⌘' : 'Ctrl'

export function shortcutLabel(key: string, shift = false): string {
  if (isApplePlatform) return `${shift ? '⇧' : ''}${modKeyLabel}${key}`
  return `${modKeyLabel}+${shift ? 'Shift+' : ''}${key}`
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.closest('[contenteditable="true"]') !== null
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function safeHexColor(value: string, fallback = '#181817'): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}
