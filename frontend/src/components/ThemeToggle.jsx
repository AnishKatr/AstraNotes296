import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './ThemeProvider'

const CYCLE = ['light', 'dark', 'system']
const ICONS = { light: Sun, dark: Moon, system: Monitor }
const LABELS = { light: 'Light', dark: 'Dark', system: 'System' }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]
    setTheme(next)
  }

  const Icon = ICONS[theme] ?? Monitor

  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label={`Theme: ${LABELS[theme]}`}>
      <Icon className="h-4 w-4" />
    </Button>
  )
}
