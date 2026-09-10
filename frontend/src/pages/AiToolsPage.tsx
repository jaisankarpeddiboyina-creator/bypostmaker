import { Link } from 'react-router-dom'
import { PLATFORMS } from '@@config/platforms'
import { PlatformIcon } from '../components/PlatformIcon'

export default function AiToolsPage() {
  return (
    <div className="ai-tools-page min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">AI Tools</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {PLATFORMS.map((platform) => (
            <Link
              key={platform.id}
              to={`/ai-tools/${platform.id}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors shadow-sm text-sm font-medium"
            >
              <PlatformIcon id={platform.id} size={20} useBrandColor />
              <span>{platform.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
