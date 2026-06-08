import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8 text-muted-foreground">
      <Settings className="w-12 h-12 opacity-25" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">Settings</p>
        <p className="text-sm mt-1">App settings will appear here in a future update.</p>
      </div>
    </div>
  )
}
