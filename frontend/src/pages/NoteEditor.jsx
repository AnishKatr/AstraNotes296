import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Clock, Download, FileDown, Printer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import MarkdownPreview from '../components/MarkdownPreview'
import TagEditor from '../components/TagEditor'
import VersionHistoryPanel from '../components/VersionHistoryPanel'
import VoiceRecorder from '../components/VoiceRecorder'
import { exportMarkdown, exportPdf } from '@/lib/exportNote'
import { createNote, deleteNote, getNote, updateNote } from '../services/notes'

export default function NoteEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()

  const previewRef = useRef(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState([])
  const [isSecure, setIsSecure] = useState(false)
  const [isVoice, setIsVoice] = useState(false)
  const [noteType, setNoteType] = useState('text')
  const [audioFileId, setAudioFileId] = useState(null)
  const [decryptionFailed, setDecryptionFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saveCount, setSaveCount] = useState(0)

  useEffect(() => {
    if (isNew) {
      setTitle('')
      setBody('')
      setTags([])
      setIsSecure(false)
      setIsVoice(false)
      setNoteType('text')
      setAudioFileId(null)
      setDecryptionFailed(false)
      setShowHistory(false)
      return
    }
    getNote(id)
      .then(note => {
        setTitle(note.title)
        setBody(note.body ?? '')
        setTags(note.tags ?? [])
        setNoteType(note.note_type)
        setIsSecure(note.note_type === 'secure')
        setAudioFileId(note.audio_file_id ?? null)
      })
      .catch(err => {
        if (err.code === 'DECRYPTION_FAILED') {
          setDecryptionFailed(true)
        } else {
          toast.error(err.message)
        }
      })
  }, [id, isNew])

  async function handleSave() {
    setSaving(true)
    try {
      if (isNew) {
        const note_type = isVoice ? 'voice' : isSecure ? 'secure' : 'text'
        const note = await createNote({ title, body, note_type, tags })
        navigate(`/notes/${note.id}`, { replace: true })
      } else {
        await updateNote(id, { title, body, tags })
        setSaveCount(c => c + 1)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false)
    try {
      await deleteNote(id)
      navigate('/notes')
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handleRestore(restoredNote) {
    setTitle(restoredNote.title)
    setBody(restoredNote.body ?? '')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-2">
        {/* Left: mobile back button + tag editor */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/notes')}
            aria-label="Back to notes"
            className="md:hidden shrink-0 gap-1 text-muted-foreground px-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {!isNew && isSecure && (
            <Badge variant="secondary" className="shrink-0">Encrypted</Badge>
          )}
          {!isNew && noteType === 'voice' && (
            <Badge variant="secondary" className="shrink-0">Voice</Badge>
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <TagEditor tags={tags} setTags={setTags} disabled={saving} />
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex gap-2 items-center shrink-0">
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(h => !h)}
              aria-label="Version history"
              aria-pressed={showHistory}
              title="Version history"
              className={
                showHistory
                  ? 'border border-primary text-primary bg-primary/10'
                  : 'border border-border text-muted-foreground'
              }
            >
              <Clock className="w-4 h-4" />
            </Button>
          )}
          {!isNew && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Export note"
                  title="Export"
                  className="border border-border text-muted-foreground"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => exportMarkdown(title, body)}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportPdf(title, previewRef.current?.innerHTML ?? '')}>
                  <Printer className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {decryptionFailed ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-destructive text-sm">This note could not be decrypted.</p>
        </div>
      ) : (
        <>
          {/* Title row */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <Input
              type="text"
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-xl font-semibold border-0 border-b rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
            />
          </div>

          {/* New note options */}
          {isNew && (
            <div className="flex flex-wrap gap-4 px-4 pb-3 shrink-0">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSecure}
                  onChange={e => {
                    setIsSecure(e.target.checked)
                    if (e.target.checked) setIsVoice(false)
                  }}
                  className="rounded border-border accent-[hsl(var(--primary))] focus:ring-ring"
                />
                Mark as Secure (encrypted)
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isVoice}
                  onChange={e => {
                    setIsVoice(e.target.checked)
                    if (e.target.checked) setIsSecure(false)
                  }}
                  className="rounded border-border accent-[hsl(var(--primary))] focus:ring-ring"
                />
                Voice note
              </label>
            </div>
          )}

          {/* Voice recorder */}
          {!isNew && noteType === 'voice' && (
            <div className="px-4 pb-3 shrink-0">
              <VoiceRecorder
                noteId={id}
                audioFileId={audioFileId}
                onUpload={updated => setAudioFileId(updated.audio_file_id)}
              />
            </div>
          )}

          {/* Editor + preview + history panel */}
          <div className="flex flex-1 min-h-0 gap-0">
            <div className="flex flex-col md:flex-row flex-1 gap-0 border border-border rounded-none overflow-hidden min-h-0 border-l-0 border-r-0">
              <Textarea
                aria-label="Markdown editor"
                placeholder="Write your note in Markdown…"
                value={body}
                onChange={e => setBody(e.target.value)}
                className="flex-1 p-4 text-sm font-mono resize-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 rounded-none min-h-0 h-full border-b md:border-b-0 md:border-r border-border"
              />
              <div ref={previewRef} className="flex-1 p-4 overflow-auto bg-card">
                <MarkdownPreview content={body} />
              </div>
            </div>

            {!isNew && showHistory && (
              <VersionHistoryPanel
                noteId={id}
                isSecure={isSecure}
                onRestore={handleRestore}
                onClose={() => setShowHistory(false)}
                refreshKey={saveCount}
              />
            )}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={open => !open && setShowDeleteConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              This note will be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
