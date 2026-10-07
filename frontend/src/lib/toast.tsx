import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

type Tone = 'good' | 'bad' | 'info'
interface Toast { id: number; text: string; tone: Tone }

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'good' ? <CheckCircle2 size={16} /> : t.tone === 'bad' ? <XCircle size={16} /> : <Info size={16} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
