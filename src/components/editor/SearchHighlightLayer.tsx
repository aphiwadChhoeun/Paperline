import type { PageState } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import { pdfRectToViewport, type ViewportLike } from '../../lib/geometry'
import { cn } from '../ui/utils'

interface SearchHighlightLayerProps {
  page: PageState
  viewport: ViewportLike
}

export function SearchHighlightLayer({
  page,
  viewport,
}: SearchHighlightLayerProps) {
  const matches = useEditorStore((state) => state.searchMatches)
  const activeId = useEditorStore((state) => state.activeSearchMatchId)
  const pageMatches = matches.filter((match) => match.pageId === page.id)

  if (pageMatches.length === 0) return null

  return (
    <div
      data-search-layer="true"
      className="pointer-events-none absolute inset-0 z-30"
      aria-hidden="true"
    >
      {pageMatches.flatMap((match) =>
        match.rects.map((rect, index) => {
          const box = pdfRectToViewport(rect, viewport)
          const active = match.id === activeId
          return (
            <div
              key={`${match.id}:${index}`}
              data-search-highlight="true"
              data-search-active={active ? 'true' : undefined}
              className={cn(
                'absolute rounded-[2px]',
                active
                  ? 'bg-amber-400/60 ring-1 ring-amber-500/80 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]'
                  : 'bg-amber-300/35',
              )}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
            />
          )
        }),
      )}
    </div>
  )
}
