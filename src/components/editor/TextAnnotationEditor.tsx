import { useCallback, useEffect, useRef, useState } from 'react'
import type { TextAnnotation } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import { fontFamilyCss } from '../../lib/geometry'

interface TextAnnotationEditorProps {
  annotation: TextAnnotation
  scale: number
  onClose: () => void
}

function findAnnotation(id: string): TextAnnotation | null {
  for (const page of useEditorStore.getState().pages) {
    const annotation = page.annotations.find((item) => item.id === id)
    if (annotation?.type === 'text') return annotation
  }
  return null
}

/**
 * A seamless textarea that sits exactly where the text annotation is drawn.
 * Edits stay local until blur/Enter, so one history entry is recorded per
 * editing session instead of per keystroke.
 */
export function TextAnnotationEditor({
  annotation,
  scale,
  onClose,
}: TextAnnotationEditorProps) {
  const [text, setText] = useState(annotation.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const latestRef = useRef(annotation.text)
  const cancelledRef = useRef(false)
  latestRef.current = text

  const commit = useCallback(() => {
    const current = findAnnotation(annotation.id)
    if (current && current.text !== latestRef.current) {
      useEditorStore
        .getState()
        .updateAnnotation(annotation.id, { text: latestRef.current }, true)
    }
  }, [annotation.id])

  // Commit if the annotation is deselected before the textarea blurs.
  useEffect(() => {
    return () => {
      if (cancelledRef.current) return
      const current = findAnnotation(annotation.id)
      if (current && current.text !== latestRef.current) {
        useEditorStore
          .getState()
          .updateAnnotation(annotation.id, { text: latestRef.current }, true)
      }
    }
  }, [annotation.id])

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.focus({ preventScroll: true })
    if (annotation.text === 'New text') {
      element.select()
    } else {
      const end = element.value.length
      element.setSelectionRange(end, end)
    }
    // Only focus once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fontSize = annotation.fontSize * scale

  return (
    <textarea
      ref={textareaRef}
      value={text}
      spellCheck={false}
      wrap="soft"
      draggable={false}
      aria-label="Edit text annotation"
      className="h-full w-full resize-none border-0 bg-transparent p-0 outline-none"
      style={{
        fontFamily: fontFamilyCss(annotation.fontFamily),
        fontSize: `${fontSize}px`,
        lineHeight: 1.3,
        color: annotation.color,
        opacity: annotation.opacity,
        textAlign: annotation.align,
        caretColor: annotation.color,
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        userSelect: 'text',
      }}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        commit()
        onClose()
      }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          // Let the shell export, but make sure the latest inline text is in
          // the store before it builds the PDF.
          commit()
          return
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          commit()
          onClose()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancelledRef.current = true
          setText(annotation.text)
          latestRef.current = annotation.text
          onClose()
        }
      }}
    />
  )
}
