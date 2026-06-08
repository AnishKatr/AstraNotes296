import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadAudio } from '../services/notes'

function formatElapsed(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

// NFR-02: check at render time so the disabled state is immediate.
function isRecordingSupported() {
  return typeof MediaRecorder !== 'undefined'
}

export default function VoiceRecorder({ noteId, audioFileId: initialAudioFileId, onUpload }) {
  const supported = isRecordingSupported()

  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [audioFileId, setAudioFileId] = useState(initialAudioFileId)

  const mrRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  useEffect(() => {
    setAudioFileId(initialAudioFileId)
  }, [initialAudioFileId])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mrRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await doUpload(blob)
      }

      mr.start()
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } catch (err) {
      setError(`Could not access microphone: ${err.message}`)
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    setRecording(false)
    mrRef.current?.stop()
  }

  async function doUpload(blob) {
    setUploading(true)
    setError(null)
    try {
      const updated = await uploadAudio(noteId, blob)
      setAudioFileId(updated.audio_file_id)
      onUpload?.(updated)
    } catch (err) {
      if (err.code === 'UNSUPPORTED_AUDIO_FORMAT') {
        setError('Unsupported audio format')
      } else if (err.code === 'AUDIO_TOO_LARGE') {
        setError('Recording is too large (max 10 MB)')
      } else {
        setError(err.message || 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-border rounded p-4 bg-card space-y-3">
      <div className="flex items-center gap-3">
        {!supported ? (
          <Button
            disabled
            aria-label="Record audio"
            title="Recording is not supported in this browser"
            variant="ghost"
            size="sm"
            className="text-muted-foreground cursor-not-allowed gap-2"
          >
            <Mic className="w-4 h-4" aria-hidden="true" />
            Record
          </Button>
        ) : recording ? (
          <>
            <span className="flex items-center gap-2 text-sm text-destructive font-medium">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" aria-hidden="true" />
              {formatElapsed(elapsed)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={stopRecording}
              aria-label="Stop recording"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive"
            >
              Stop
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={startRecording}
            disabled={uploading}
            aria-label="Record audio"
            className="text-primary border-primary/40 hover:bg-primary/10 hover:border-primary gap-2"
          >
            <Mic className="w-4 h-4" aria-hidden="true" />
            {uploading ? 'Uploading…' : 'Record'}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      {audioFileId && !recording && (
        <audio
          controls
          src={`/api/notes/${noteId}/audio`}
          aria-label="Voice recording playback"
          className="w-full"
        />
      )}
    </div>
  )
}
