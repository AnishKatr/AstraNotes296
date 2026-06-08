import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Lock, Mic, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { emptyTrash, listTrash, permanentDeleteNote, restoreNote } from '../services/notes'

function formatRelative(isoString) {
  if (!isoString) return ''
  const diffMs = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

const TYPE_ICON = {
  secure: Lock,
  voice: Mic,
  text: FileText,
}

const TYPE_LABEL = {
  secure: 'Encrypted note',
  voice: 'Voice note',
  text: undefined,
}

export default function TrashPage() {
  const [notes, setNotes] = useState([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Confirm dialogs
  const [confirmPermanent, setConfirmPermanent] = useState(null) // note id or null
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [acting, setActing] = useState(false)

  function load() {
    setLoading(true)
    listTrash({ limit: 50 })
      .then(data => {
        setNotes(data.notes)
        setTotal(data.total)
        setNextCursor(data.next_cursor)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function handleLoadMore() {
    setLoadingMore(true)
    listTrash({ limit: 50, cursor: nextCursor })
      .then(data => {
        setNotes(prev => [...prev, ...data.notes])
        setNextCursor(data.next_cursor)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoadingMore(false))
  }

  async function handleRestore(id) {
    setActing(true)
    try {
      await restoreNote(id)
      toast.success('Note restored')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActing(false)
    }
  }

  async function handlePermanentDelete() {
    if (!confirmPermanent) return
    setActing(true)
    try {
      await permanentDeleteNote(confirmPermanent)
      toast.success('Note permanently deleted')
      setConfirmPermanent(null)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActing(false)
    }
  }

  async function handleEmptyTrash() {
    setActing(true)
    try {
      await emptyTrash()
      toast.success('Trash emptied')
      setConfirmEmpty(false)
      setNotes([])
      setTotal(0)
      setNextCursor(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActing(false)
    }
  }

  const isEmpty = !loading && notes.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold">Trash</h1>
          {!loading && total > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {total} deleted {total === 1 ? 'note' : 'notes'}
            </p>
          )}
        </div>
        {total > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmEmpty(true)}
            disabled={acting || loading}
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Empty trash
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-8 text-center">
            <Trash2 className="w-10 h-10 opacity-20" aria-hidden="true" />
            <p className="text-sm">Trash is empty</p>
          </div>
        )}

        {!loading && notes.length > 0 && (
          <ul className="divide-y divide-border">
            {notes.map(note => {
              const Icon = TYPE_ICON[note.note_type] ?? FileText
              return (
                <li key={note.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <Icon
                    aria-label={TYPE_LABEL[note.note_type]}
                    className="w-4 h-4 text-muted-foreground shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{note.title || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">
                      Deleted {formatRelative(note.deleted_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(note.id)}
                      disabled={acting}
                      aria-label={`Restore ${note.title}`}
                      className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmPermanent(note.id)}
                      disabled={acting}
                      aria-label={`Delete ${note.title} permanently`}
                      className="text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete permanently
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {nextCursor && (
          <div className="p-3 text-center">
            <Button variant="link" size="sm" onClick={handleLoadMore} disabled={loadingMore} className="text-xs">
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>

      {/* Permanent-delete confirmation */}
      <Dialog
        open={confirmPermanent !== null}
        onOpenChange={open => !open && setConfirmPermanent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete permanently</DialogTitle>
            <DialogDescription>
              This note will be permanently deleted and cannot be recovered. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPermanent(null)} disabled={acting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={acting}>
              {acting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty trash confirmation */}
      <Dialog open={confirmEmpty} onOpenChange={open => !open && setConfirmEmpty(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty trash</DialogTitle>
            <DialogDescription>
              All {total} {total === 1 ? 'note' : 'notes'} in the trash will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmpty(false)} disabled={acting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEmptyTrash} disabled={acting}>
              {acting ? 'Deleting…' : 'Empty trash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
