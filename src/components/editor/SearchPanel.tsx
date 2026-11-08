import { useEffect, useRef, useState } from 'react'
import { FileSearch, LoaderCircle, Search, X } from 'lucide-react'
import type { SearchMatch } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import { searchDocument } from '../../lib/search'

function Snippet({ snippet, query }: { snippet: string; query: string }) {
  const needle = query.trim()
  if (!needle) return <>{snippet}</>
  const index = snippet.toLowerCase().indexOf(needle.toLowerCase())
  if (index < 0) return <>{snippet}</>
  return (
    <>
      {snippet.slice(0, index)}
      <mark className="rounded-[2px] bg-amber-100 px-0.5 text-ink">
        {snippet.slice(index, index + needle.length)}
      </mark>
      {snippet.slice(index + needle.length)}
    </>
  )
}

export function SearchPanel() {
  const pdf = useEditorStore((state) => state.pdf)
  const pages = useEditorStore((state) => state.pages)
  const activeSearchMatchId = useEditorStore((state) => state.activeSearchMatchId)
  const setSearchMatches = useEditorStore((state) => state.setSearchMatches)
  const focusSearchMatch = useEditorStore((state) => state.focusSearchMatch)
  const clearSearchHighlights = useEditorStore((state) => state.clearSearchHighlights)

  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState<SearchMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const pagesRef = useRef(pages)
  const pagesKey = pages.map((page) => `${page.id}:${page.sourceIndex}`).join('|')

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearched('')
      setLoading(false)
      setProgress({ done: 0, total: 0 })
      setError(null)
      clearSearchHighlights()
      return
    }
    if (!pdf) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    clearSearchHighlights()
    setProgress({ done: 0, total: pagesRef.current.length })

    const timeout = window.setTimeout(() => {
      void searchDocument(pdf, pagesRef.current, trimmed, {
        signal: controller.signal,
        onProgress: (done, total) => {
          if (!controller.signal.aborted) setProgress({ done, total })
        },
      })
        .then((found) => {
          if (controller.signal.aborted) return
          setResults(found)
          setSearchMatches(found)
          setSearched(trimmed)
          setLoading(false)
          setProgress({ done: pagesRef.current.length, total: pagesRef.current.length })
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return
          setError(reason instanceof Error ? reason.message : 'Search could not be completed.')
          setSearchMatches([])
          setLoading(false)
        })
    }, 260)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, pdf, pagesKey, clearSearchHighlights, setSearchMatches])

  useEffect(() => {
    return () => clearSearchHighlights()
  }, [clearSearchHighlights])

  const jumpToResult = (match: SearchMatch | undefined) => {
    if (!match) return
    focusSearchMatch(match.id)
  }

  const progressRatio =
    progress.total > 0 ? Math.min(1, Math.max(0, progress.done / progress.total)) : 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-1">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-2 py-1.5 focus-within:border-accent-300 focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent-500/15">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                jumpToResult(results[0])
                return
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setQuery('')
              }
            }}
            placeholder="Search document…"
            aria-label="Search document"
            className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-faint"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="focus-ring flex h-4 w-4 items-center justify-center rounded text-muted transition-colors hover:bg-black/[0.06] hover:text-ink-soft"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="space-y-2 px-0.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted" aria-live="polite">
              <LoaderCircle className="h-3 w-3 animate-spin text-accent-500" />
              <span>
                Searching
                {progress.total > 0
                  ? ` page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
                  : '…'}
              </span>
            </div>
            <div className="h-0.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-150"
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
              />
            </div>
          </div>
        ) : error ? (
          <p className="px-0.5 text-[11px] leading-relaxed text-red-500">{error}</p>
        ) : searched ? (
          <div className="space-y-1.5">
            <p className="px-0.5 text-[11px] text-muted" aria-live="polite">
              {results.length} {results.length === 1 ? 'match' : 'matches'} for{' '}
              <span className="font-medium text-ink-soft">“{searched}”</span>
            </p>
            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <FileSearch className="h-5 w-5 text-faint" />
                <p className="text-xs text-muted">No matches found on any page.</p>
              </div>
            ) : (
              results.map((match) => {
                const active = match.id === activeSearchMatchId
                return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => jumpToResult(match)}
                  aria-current={active ? 'true' : undefined}
                  className={[
                    'focus-ring w-full rounded-lg px-2 py-1.5 text-left transition-colors',
                    active ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-surface-muted',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center rounded-[3px] bg-accent-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.06em] text-accent-600">
                    Page {match.pageIndex + 1}
                  </span>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.45] text-ink-soft">
                    <Snippet snippet={match.snippet} query={searched} />
                  </p>
                </button>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 pb-12 text-center">
            <Search className="h-5 w-5 text-faint" />
            <p className="text-xs font-medium text-ink-soft">Search this document</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Find words and phrases across every page.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
