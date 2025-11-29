import { Loader2 } from 'lucide-react'

export default function ReconnectingModal() {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-6 flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Reconnecting</h3>
          <p className="text-sm text-muted-foreground mt-1">Connection lost. Attempting to reconnect...</p>
        </div>
      </div>
    </div>
  )
}
