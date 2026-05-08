import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import NoteEditor from './pages/NoteEditor'
import NoteList from './pages/NoteList'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NoteList />} />
        <Route path="/notes/:id" element={<NoteEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
