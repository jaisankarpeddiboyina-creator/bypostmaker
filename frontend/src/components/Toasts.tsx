// ============================================================
// Toasts.tsx
// ============================================================
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '../store/app'

export function Toasts() {
  const { toasts, removeToast } = useAppStore()
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && <CheckCircle size={15} color="var(--success)" />}
          {t.type === 'error' && <XCircle size={15} color="var(--error)" />}
          {t.type === 'info' && <Info size={15} color="var(--accent)" />}
          <span style={{ flex: 1, fontSize: 13 }}>{t.message}</span>
          <button className="btn-icon" onClick={() => removeToast(t.id)}><X size={12} /></button>
        </div>
      ))}
    </div>
  )
}
