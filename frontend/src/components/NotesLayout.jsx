import { Outlet, useMatch } from 'react-router-dom'
import { cn } from '@/lib/utils'
import NoteList from '../pages/NoteList'

export default function NotesLayout() {
  const editorMatch = useMatch('/notes/:id')
  const activeNoteId = editorMatch?.params?.id ?? null

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* List pane: full width on mobile when no note is open, fixed width on desktop */}
      <div
        className={cn(
          'flex-col overflow-hidden border-r border-border shrink-0',
          activeNoteId ? 'hidden md:flex md:w-56' : 'flex w-full md:w-56'
        )}
      >
        <NoteList activeNoteId={activeNoteId} />
      </div>

      {/* Editor pane: hidden on mobile until a note is selected */}
      <div
        className={cn(
          'flex-1 flex-col overflow-hidden min-w-0',
          activeNoteId ? 'flex' : 'hidden md:flex'
        )}
      >
        <Outlet />
      </div>
    </div>
  )
}
