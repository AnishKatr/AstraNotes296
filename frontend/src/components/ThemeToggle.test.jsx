import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function mockMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function renderToggle(defaultTheme = 'light') {
  return render(
    <ThemeProvider defaultTheme={defaultTheme}>
      <ThemeToggle />
    </ThemeProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('light', 'dark')
  mockMatchMedia(false)
})

describe('ThemeToggle', () => {
  it('renders a button with an aria-label', () => {
    renderToggle('light')
    expect(screen.getByRole('button', { name: /Theme:/i })).toBeInTheDocument()
  })

  it('cycles light → dark on click', () => {
    renderToggle('light')
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('cycles dark → system on click (system+light OS = light class)', () => {
    renderToggle('dark')
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('cycles system → light on click', () => {
    renderToggle('system')
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
