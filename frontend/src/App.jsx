import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppShell from './components/AppShell'
import NotesLayout from './components/NotesLayout'
import EmptyEditorPane from './components/EmptyEditorPane'
import NoteEditor from './pages/NoteEditor'
import TrashPage from './pages/TrashPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/notes" replace />} />
          <Route path="/notes" element={<NotesLayout />}>
            <Route index element={<EmptyEditorPane />} />
            <Route path=":id" element={<NoteEditor />} />
          </Route>
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Route>
      </Routes>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  )
}
