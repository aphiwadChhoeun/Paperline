import { useState, type FormEvent } from 'react'
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  TriangleExclamationPoint,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { Button } from './ui/Button'
import { Field, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

export function PasswordDialog() {
  const passwordRequired = useEditorStore((state) => state.passwordRequired)
  const passwordError = useEditorStore((state) => state.passwordError)
  const pendingFile = useEditorStore((state) => state.pendingFile)
  const submitPassword = useEditorStore((state) => state.submitPassword)
  const cancelPassword = useEditorStore((state) => state.cancelPassword)

  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    try {
      await submitPassword(password)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={passwordRequired}
      onClose={cancelPassword}
      labelledBy="password-title"
      describedBy="password-description"
      className="max-w-[404px]"
    >
      <form onSubmit={handleSubmit}>
        <div className="px-5 pb-4 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <Lock size={18} strokeWidth={1.8} />
          </span>
          <h2
            id="password-title"
            className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-ink"
          >
            This PDF is protected
          </h2>
          <p
            id="password-description"
            className="mt-1 text-[11.5px] leading-5 text-muted"
          >
            Enter the password to open{' '}
            <span className="font-medium text-ink-soft">
              {pendingFile?.name ?? 'this document'}
            </span>
            .
          </p>
        </div>

        <div className="space-y-3 px-5 pb-4">
          <Field label="Password" htmlFor="pdf-password">
            <div className="relative">
              <TextInput
                id="pdf-password"
                data-autofocus
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter the document password"
                autoComplete="current-password"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className="pr-9"
              />
              <button
                type="button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((current) => !current)}
                className="focus-ring absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {visible ? (
                  <EyeOff size={13} strokeWidth={1.9} />
                ) : (
                  <Eye size={13} strokeWidth={1.9} />
                )}
              </button>
            </div>
          </Field>

          {passwordError ? (
            <p
              id="password-error"
              role="alert"
              className="flex items-start gap-1.5 text-[10.5px] leading-4 text-[#b42318]"
            >
              <TriangleExclamationPoint
                size={13}
                strokeWidth={1.9}
                className="mt-px shrink-0"
              />
              {passwordError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="secondary" onClick={cancelPassword} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!password || submitting}>
            {submitting ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Lock size={13} strokeWidth={2} />
            )}
            {submitting ? 'Unlocking…' : 'Unlock PDF'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
