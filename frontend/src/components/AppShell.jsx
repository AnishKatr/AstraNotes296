import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Sidebar from './Sidebar'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Decorative macOS-style top chrome */}
      <div className="h-7 shrink-0 flex items-center px-3 gap-2 border-b border-border bg-card select-none">
        {/* Window dots (desktop) / hamburger (mobile) */}
        <div className="flex items-center gap-1.5">
          <span className="hidden md:block w-3 h-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
          <span className="hidden md:block w-3 h-3 rounded-full bg-[#febc2e]" aria-hidden="true" />
          <span className="hidden md:block w-3 h-3 rounded-full bg-[#28c840]" aria-hidden="true" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="md:hidden -ml-1.5 h-6 w-6 text-muted-foreground"
          >
            <Menu className="w-3.5 h-3.5" />
          </Button>
        </div>
        <span className="flex-1 text-center text-xs text-muted-foreground font-medium pointer-events-none">
          AstraNotes
        </span>
        {/* Spacer to balance the left side on desktop */}
        <div className="hidden md:block w-[54px]" aria-hidden="true" />
      </div>

      {/* App body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
