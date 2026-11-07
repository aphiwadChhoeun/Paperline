import type { CSSProperties } from 'react'
import type { FormField, FormValue, FormValues, PageState } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import type { ViewportLike } from '../../lib/geometry'
import { cn } from '../ui/utils'

interface FormLayerProps {
  page: PageState
  viewport: ViewportLike
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim()
}

function stringValue(value: FormValue | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

function arrayValue(value: FormValue | undefined): string[] {
  if (Array.isArray(value)) return value
  return typeof value === 'string' && value ? [value] : []
}

function fieldStyle(field: FormField, viewport: ViewportLike): CSSProperties {
  const [x, y] = viewport.convertToViewportPoint(
    field.rect.x,
    field.rect.y + field.rect.height,
  )
  return {
    left: x,
    top: y,
    width: field.rect.width * viewport.scale,
    height: field.rect.height * viewport.scale,
    transform: `rotate(${viewport.rotation}deg)`,
    transformOrigin: '0 0',
  }
}

function fieldFontSize(field: FormField, viewport: ViewportLike): number {
  return Math.max(9, Math.min(16, field.rect.height * viewport.scale * 0.46))
}

interface WidgetProps {
  field: FormField
  values: FormValues
  viewport: ViewportLike
  updateFormValue: (
    fieldName: string,
    value: FormValue,
    recordHistory?: boolean,
  ) => void
  commitTransient: () => void
}

function FormWidget({
  field,
  values,
  viewport,
  updateFormValue,
  commitTransient,
}: WidgetProps) {
  const value = values[field.fieldName]
  const inputClass =
    'h-full w-full rounded-[3px] border border-accent-500/35 bg-white/85 px-1.5 text-ink shadow-[0_1px_2px_rgba(20,19,16,0.06)] outline-none transition-colors focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-100 disabled:cursor-not-allowed disabled:bg-surface-muted/70 disabled:text-muted'
  const style = {
    fontSize: fieldFontSize(field, viewport),
  }

  if (field.type === 'text') {
    const text = stringValue(value)
    if (field.multiline) {
      return (
        <textarea
          value={text}
          disabled={field.readOnly}
          aria-label={field.fieldName}
          title={humanizeFieldName(field.fieldName)}
          placeholder={humanizeFieldName(field.fieldName)}
          style={style}
          className={cn(inputClass, 'resize-none py-0.5 leading-tight')}
          onChange={(event) =>
            updateFormValue(field.fieldName, event.target.value, false)
          }
          onBlur={commitTransient}
        />
      )
    }
    return (
      <input
        type="text"
        value={text}
        disabled={field.readOnly}
        aria-label={field.fieldName}
        title={humanizeFieldName(field.fieldName)}
        placeholder={humanizeFieldName(field.fieldName)}
        style={style}
        className={inputClass}
        onChange={(event) =>
          updateFormValue(field.fieldName, event.target.value, false)
        }
        onBlur={commitTransient}
      />
    )
  }

  if (field.type === 'checkbox') {
    return (
      <label
        className="flex h-full w-full cursor-pointer items-center justify-center"
        title={field.fieldName}
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={field.readOnly}
          aria-label={field.fieldName}
          className="h-[78%] w-[78%] cursor-pointer accent-[#5b5ce8] disabled:cursor-not-allowed"
          onChange={(event) =>
            updateFormValue(field.fieldName, event.target.checked, true)
          }
        />
      </label>
    )
  }

  if (field.type === 'radio') {
    const option = field.exportValue ?? field.buttonValue ?? ''
    return (
      <label
        className="flex h-full w-full cursor-pointer items-center justify-center"
        title={option || field.fieldName}
      >
        <input
          type="radio"
          name={`paperline-${field.fieldName}`}
          value={option}
          checked={stringValue(value) === option}
          disabled={field.readOnly}
          aria-label={option || field.fieldName}
          className="h-[78%] w-[78%] cursor-pointer accent-[#5b5ce8] disabled:cursor-not-allowed"
          onChange={() => updateFormValue(field.fieldName, option, true)}
        />
      </label>
    )
  }

  const options = field.options
  if (field.type === 'dropdown') {
    return (
      <select
        value={stringValue(value)}
        size={1}
        disabled={field.readOnly}
        aria-label={field.fieldName}
        title={field.fieldName}
        style={style}
        className={inputClass}
        onChange={(event) =>
          updateFormValue(field.fieldName, event.target.value, true)
        }
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  const selectedOptions = field.multiSelect
    ? arrayValue(value)
    : [stringValue(value)].filter(Boolean)

  return (
    <div
      role="listbox"
      aria-label={field.fieldName}
      aria-multiselectable={field.multiSelect || undefined}
      className={cn(
        'h-full w-full overflow-y-auto rounded-[3px] border border-accent-500/35 bg-white/85 py-0.5 shadow-[0_1px_2px_rgba(20,19,16,0.06)]',
        field.readOnly && 'cursor-not-allowed bg-surface-muted/70',
      )}
      style={{ fontSize: style.fontSize }}
    >
      {options.map((option) => {
        const active = selectedOptions.includes(option)
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={active}
            disabled={field.readOnly}
            title={option}
            onClick={() => {
              if (field.multiSelect) {
                const next = active
                  ? selectedOptions.filter((value) => value !== option)
                  : [...selectedOptions, option]
                updateFormValue(field.fieldName, next, true)
                return
              }
              updateFormValue(field.fieldName, option, true)
            }}
            className={cn(
              'flex w-full items-center px-1.5 py-0.5 text-left transition-colors disabled:cursor-not-allowed',
              active
                ? 'bg-accent-50 font-medium text-accent-700'
                : 'text-ink-soft hover:bg-surface-muted',
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

export function FormLayer({ page, viewport }: FormLayerProps) {
  const formFields = useEditorStore((state) => state.formFields)
  const formValues = useEditorStore((state) => state.formValues)
  const updateFormValue = useEditorStore((state) => state.updateFormValue)
  const commitTransient = useEditorStore((state) => state.commitTransient)
  const fields = formFields.filter((field) => field.pageId === page.id)

  if (fields.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-label="Form fields">
      {fields.map((field) => (
        <div
          key={field.id}
          className="pointer-events-auto absolute"
          style={fieldStyle(field, viewport)}
        >
          <FormWidget
            field={field}
            values={formValues}
            viewport={viewport}
            updateFormValue={updateFormValue}
            commitTransient={commitTransient}
          />
        </div>
      ))}
    </div>
  )
}
