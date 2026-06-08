import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Settings, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/lib/utils'
import { tagDotColor } from '@/lib/tagColor'
import { getTags, listNotes, listTrash } from '../services/notes'

function NavItem({ label, icon, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count != null && (
        <span
          className={cn(
            'text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums leading-none',
            active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function SidebarContent({ navigate, location, noteCount, trashCount, tags, onClose }) {
  const isNotesActive = location.pathname.startsWith('/notes')
  const isTrashActive = location.pathname.startsWith('/trash')
  const isSettingsActive =
    location.pathname.startsWith('/settings') || location.pathname.startsWith('/profile')

  const activeTag = new URLSearchParams(location.search).get('tag')

  function go(path) {
    navigate(path)
    onClose?.()
  }

  function goTag(tag) {
    navigate(`/notes?tag=${encodeURIComponent(tag)}`)
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full p-3 gap-1">
      {/* Logo + optional close (mobile drawer) */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-primary text-base leading-none" aria-hidden="true">✦</span>
          <span className="font-semibold text-sm text-foreground">AstraNotes</span>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close sidebar"
            className="h-6 w-6 text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* New note button */}
      <Button onClick={() => go('/notes/new')} className="w-full mb-2 gap-1.5" size="sm">
        <span className="text-base leading-none">+</span>
        New note
      </Button>

      {/* Primary nav */}
      <nav className="space-y-0.5">
        <NavItem
          label="All notes"
          icon={<FileText className="w-3.5 h-3.5 shrink-0" />}
          active={isNotesActive && !activeTag}
          count={noteCount}
          onClick={() => go('/notes')}
        />
        <NavItem
          label="Trash"
          icon={<Trash2 className="w-3.5 h-3.5 shrink-0" />}
          active={isTrashActive}
          count={trashCount || null}
          onClick={() => go('/trash')}
        />
      </nav>

      <Separator className="my-2" />

      {/* Tags section */}
      <div className="flex-1 overflow-auto min-h-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
          Tags
        </p>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 italic">No tags yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {tags.map(({ tag, count }) => {
              const isActive = activeTag === tag
              return (
                <li key={tag}>
                  <button
                    onClick={() => goTag(tag)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tagDotColor(tag) }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate text-left">{tag}</span>
                    <span className="tabular-nums">{count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Bottom: settings + theme toggle */}
      <div className="mt-auto space-y-0.5">
        <NavItem
          label="Settings"
          icon={<Settings className="w-3.5 h-3.5 shrink-0" />}
          active={isSettingsActive}
          onClick={() => go('/settings')}
        />
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [noteCount, setNoteCount] = useState(null)
  const [trashCount, setTrashCount] = useState(null)
  const [tags, setTags] = useState([])

  useEffect(() => {
    listNotes({ limit: 1 })
      .then(data => setNoteCount(data.total))
      .catch(() => {})
    listTrash({ limit: 1 })
      .then(data => setTrashCount(data.total))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getTags()
      .then(data => setTags(data.tags ?? []))
      .catch(() => {})
  }, [location.pathname, location.search])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-border bg-card overflow-hidden">
        <SidebarContent
          navigate={navigate}
          location={location}
          noteCount={noteCount}
          trashCount={trashCount}
          tags={tags}
        />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative w-64 bg-card border-r border-border flex flex-col overflow-auto shrink-0">
            <SidebarContent
              navigate={navigate}
              location={location}
              noteCount={noteCount}
              trashCount={trashCount}
              tags={tags}
              onClose={onClose}
            />
          </aside>
        </div>
      )}
    </>
  )
}
