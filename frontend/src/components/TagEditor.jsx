import { useEffect, useRef, useState } from 'react'
import { getTags } from '../services/notes'
import TagChip from './TagChip'

const MAX_TAGS = 10

export default function TagEditor({ tags = [], setTags, disabled = false }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [allTags, setAllTags] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    getTags()
      .then(data => setAllTags((data.tags ?? []).map(t => t.tag)))
      .catch(() => {})
  }, [])

  function filtered() {
    const q = input.trim().toLowerCase()
    if (!q) return []
    return allTags.filter(t => t.includes(q) && !tags.includes(t)).slice(0, 6)
  }

  function addTag(raw) {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    setTags([...tags, tag])
    setInput('')
    setShowSuggestions(false)
  }

  function removeTag(tag) {
    setTags(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      setTags(tags.slice(0, -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const activeSuggestions = filtered()

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
      {tags.map(tag => (
        <TagChip
          key={tag}
          tag={tag}
          onRemove={disabled ? undefined : removeTag}
        />
      ))}
      {!disabled && tags.length < MAX_TAGS && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Add tag…"
            aria-label="Add tag"
            className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border bg-transparent text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary w-24"
          />
          {showSuggestions && activeSuggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[120px]"
            >
              {activeSuggestions.map(s => (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => addTag(s)}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
