import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Lock, Mic, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import TagChip from '../components/TagChip'
import { listNotes } from '../services/notes'

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'voice', label: 'Voice' },
  { value: 'secure', label: 'Secure' },
]

const PAGE_SIZE = 20

function formatRelativeShort(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}

function NoteCard({ note, active }) {
  const navigate = useNavigate()

  const Icon =
    note.note_type === 'secure' ? Lock
    : note.note_type === 'voice' ? Mic
    : FileText

  const iconLabel =
    note.note_type === 'secure' ? 'Encrypted note'
    : note.note_type === 'voice' ? 'Voice note'
    : undefined

  const preview =
    note.note_type === 'secure'
      ? ''
      : (note.body || '').split('\n')[0].slice(0, 80)

  const visibleTags = (note.tags || []).slice(0, 3)
  const extraTags = (note.tags || []).length - visibleTags.length

  return (
    <button
      onClick={() => navigate(`/notes/${note.id}`)}
      className={cn(
        'w-full text-left rounded-md p-2.5 transition-colors border',
        active
          ? 'bg-primary/10 border-primary/30'
          : 'border-transparent hover:bg-muted/60'
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          aria-label={iconLabel}
          className={cn(
            'w-3.5 h-3.5 mt-0.5 shrink-0',
            active ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <p
              className={cn(
                'text-sm font-medium truncate',
                active ? 'text-primary' : 'text-foreground'
              )}
            >
              {note.title || 'Untitled'}
            </p>
            {note.updated_at && (
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {formatRelativeShort(note.updated_at)}
              </span>
            )}
          </div>
          {preview && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
          )}
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {visibleTags.map(tag => (
                <TagChip key={tag} tag={tag} size="sm" />
              ))}
              {extraTags > 0 && (
                <span className="text-[10px] text-muted-foreground self-center">+{extraTags}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function NoteSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-md p-2.5 animate-pulse space-y-1.5">
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-2.5 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

export default function NoteList({ activeNoteId = null }) {
  const [searchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? null

  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [notes, setNotes] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Debounce: propagate inputValue to query after 300 ms of inactivity.
  useEffect(() => {
    const id = setTimeout(() => setQuery(inputValue.trim()), 300)
    return () => clearTimeout(id)
  }, [inputValue])

  // Fresh fetch whenever the committed query, type filter, or tag filter changes.
  useEffect(() => {
    setLoading(true)
    listNotes({
      q: query || undefined,
      type: typeFilter || undefined,
      tag: activeTag || undefined,
      limit: PAGE_SIZE,
    })
      .then(data => {
        setNotes(data.notes)
        setNextCursor(data.next_cursor)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [query, typeFilter, activeTag])

  function handleClear() {
    setInputValue('')
    setQuery('')
  }

  function handleLoadMore() {
    setLoadingMore(true)
    listNotes({
      q: query || undefined,
      type: typeFilter || undefined,
      tag: activeTag || undefined,
      limit: PAGE_SIZE,
      cursor: nextCursor,
    })
      .then(data => {
        setNotes(prev => [...prev, ...data.notes])
        setNextCursor(data.next_cursor)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoadingMore(false))
  }

  const isFiltering = query || typeFilter || activeTag
  const isEmpty = notes.length === 0 && !loading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search + filter header */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        {activeTag && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Tag:</span>
            <TagChip tag={activeTag} size="sm" />
          </div>
        )}
        <div className="relative">
          <Input
            type="text"
            placeholder="Search notes..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="pr-8 h-8 text-sm"
          />
          {inputValue && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        <div className="flex gap-1 flex-wrap">
          {TYPE_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={typeFilter === opt.value ? 'default' : 'ghost'}
              onClick={() => setTypeFilter(opt.value)}
              className="rounded-full px-2.5 text-xs h-6"
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Secure note contents are not searchable.
        </p>
      </div>

      {/* Scrollable note list */}
      <div className="flex-1 overflow-auto">
        {loading && <NoteSkeleton />}

        {isEmpty && (
          <p className="text-muted-foreground text-sm p-4 text-center">
            {isFiltering
              ? 'No notes match your search.'
              : 'No notes yet. Create one above.'}
          </p>
        )}

        {!loading && notes.length > 0 && (
          <ul className="p-2 space-y-0.5">
            {notes.map(note => (
              <li key={note.id}>
                <NoteCard note={note} active={note.id === activeNoteId} />
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="p-2 text-center">
            <Button
              variant="link"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
