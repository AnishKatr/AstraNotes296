import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function EmptyEditorPane() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8 text-muted-foreground">
      <FileText className="w-12 h-12 opacity-25" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">No note selected</p>
        <p className="text-sm mt-1">Pick a note from the list or create a new one.</p>
      </div>
      <Button onClick={() => navigate('/notes/new')}>New note</Button>
    </div>
  )
}
