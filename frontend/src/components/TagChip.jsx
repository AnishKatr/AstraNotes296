import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tagColorClasses } from '@/lib/tagColor'

export default function TagChip({ tag, onRemove, onClick, size = 'md' }) {
  const { bg, text } = tagColorClasses(tag)
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-0.5 gap-1'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium shrink-0',
        bg, text, sizeClasses,
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(tag) }}
          aria-label={`Remove tag ${tag}`}
          className={cn('rounded-full hover:opacity-70 focus:outline-none shrink-0', text)}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}
