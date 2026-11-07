import { FileText, LayoutGrid, ListTree, Search, ShieldCheck } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { SidebarTab } from '../../types/editor'
import { Thumbnails } from '../editor/Thumbnails'
import { OutlinePanel } from '../editor/OutlinePanel'
import { SearchPanel } from '../editor/SearchPanel'
import { cn } from '../ui/utils'

type NavTab = Exclude<SidebarTab, 'comments'>

const TABS: Array<{ id: NavTab; label: string; icon: typeof LayoutGrid }> = [
  { id: 'thumbnails', label: 'Thumbnails', icon: LayoutGrid },
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'search', label: 'Search', icon: Search },
]

export function LeftSidebar() {
  const fileName = useEditorStore((state) => state.fileName)
  const pages = useEditorStore((state) => state.pages)
  const sidebarTab = useEditorStore((state) => state.sidebarTab)
  const setSidebarTab = useEditorStore((state) => state.setSidebarTab)
  const hasDocument = Boolean(fileName)

  const activeTab: NavTab = sidebarTab === 'outline' || sidebarTab === 'search' ? sidebarTab : 'thumbnails'

  return (
    <aside
      aria-label="Document navigator"
      className="flex w-[264px] shrink-0 flex-col border-r border-line bg-surface max-[1200px]:w-[246px]"
    >
      <div className="border-b border-line px-3 pt-3">
        <div className="flex items-center justify-between pb-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
            Navigator
          </span>
          <span className="text-[9.5px] tabular-nums text-faint">
            {hasDocument ? `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : '—'}
          </span>
        </div>
        <div role="tablist" aria-label="Navigator views" className="flex gap-0.5">
          {TABS.map((tab) => {
            const isActive = hasDocument && activeTab === tab.id
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                id={`sidebar-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-controls={`sidebar-panel-${tab.id}`}
                disabled={!hasDocument}
                onClick={() => setSidebarTab(tab.id)}
                className={cn(
                  'focus-ring relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-t-md border-b-2 px-1 text-[10.5px] font-medium transition-colors',
                  isActive
                    ? 'border-accent-500 text-ink'
                    : 'border-transparent text-muted hover:text-ink',
                  !hasDocument && 'cursor-not-allowed text-faint/70 hover:text-faint/70',
                )}
              >
                <TabIcon size={12} strokeWidth={1.9} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        id={`sidebar-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`sidebar-tab-${activeTab}`}
        className="min-h-0 flex-1 overflow-hidden"
      >
        {hasDocument ? (
          <div className="h-full overflow-hidden">
            {activeTab === 'thumbnails' ? <Thumbnails /> : null}
            {activeTab === 'outline' ? <OutlinePanel /> : null}
            {activeTab === 'search' ? <SearchPanel /> : null}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 px-7 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-muted text-faint">
              <FileText size={18} strokeWidth={1.6} />
            </span>
            <p className="text-[11px] font-medium text-ink-soft">No pages yet</p>
            <p className="text-[10px] leading-4 text-muted">
              Open a PDF to browse thumbnails, the outline, and full-text search.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2 text-[9.5px] leading-4 text-muted">
        <ShieldCheck size={12} strokeWidth={1.9} className="shrink-0 text-[#2f9e6e]" />
        <span>Local-first · edits stay in this browser</span>
      </div>
    </aside>
  )
}
