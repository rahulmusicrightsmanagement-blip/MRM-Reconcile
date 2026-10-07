import { useRef, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, UploadCloud, XCircle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { FileKind, RunPayload } from '../types'
import { Button } from './ui'

const KIND_NAME: Record<FileKind, string> = { iprs: 'IPRS work listing', master: 'Our master (LNV report)', prs: 'PRS works export' }

interface Dropped { name: string; state: 'uploading' | 'ok' | 'error'; kind?: FileKind; detail?: string }

function describe(kind: FileKind, p: RunPayload) {
  const r = p.result
  if (kind === 'iprs' && r.iprs) return `${r.iprs.client.name} · ${r.iprs.stats.works} works`
  if (kind === 'master' && r.master) return `${r.master.stats.songs} songs`
  if (kind === 'prs' && r.prs) return `${r.prs.stats.works} PRS works`
  return ''
}

/**
 * Drop every file at once – each one is recognised from its columns and all five steps run.
 * Calls onReady when the IPRS report and our master are both in (or the user opens it early).
 */
export function StartDrop({ clientId, onReady }: { clientId?: number; onReady: (p: RunPayload) => void }) {
  const [files, setFiles] = useState<Dropped[]>([])
  const [runId, setRunId] = useState<number | null>(null)
  const [last, setLast] = useState<RunPayload | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const handle = async (list: FileList | File[]) => {
    const incoming = Array.from(list)
    if (!incoming.length) return
    let id = runId
    if (id === null) {
      id = (await api.createRun({ client_id: clientId ?? null })).id
      setRunId(id)
    }
    setFiles((f) => [...f, ...incoming.map((x) => ({ name: x.name, state: 'uploading' as const }))])
    let latest = last
    // The IPRS report goes first so the client is known before the rest arrive.
    const ordered = [...incoming].sort((a, b) => Number(/csv$/i.test(a.name)) - Number(/csv$/i.test(b.name)))
    for (const file of ordered) {
      try {
        const res = await api.upload(id, 'auto', file)
        latest = res
        setFiles((f) => f.map((x) => x.name === file.name && x.state === 'uploading' ? { ...x, state: 'ok', kind: res.detected, detail: describe(res.detected, res) } : x))
      } catch (e) {
        setFiles((f) => f.map((x) => x.name === file.name && x.state === 'uploading' ? { ...x, state: 'error', detail: (e as ApiError).message } : x))
      }
    }
    setLast(latest)
    if (latest?.result.iprs && latest.result.master) onReady(latest)
  }

  const missing = (['iprs', 'master'] as FileKind[]).filter((k) => !(last?.result[k]))
  return (
    <div className="start-drop-wrap">
      <div
        className={`start-drop ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files) }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click() }}
        role="button" tabIndex={0} aria-label="Upload files"
      >
        <input ref={input} type="file" multiple hidden accept=".xlsx,.xlsm,.csv"
          onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value = '' }} />
        <UploadCloud size={30} />
        <strong>Drop the IPRS report, our master and the PRS export</strong>
        <span className="muted">or click to choose · all at once, any order · each file is recognised automatically</span>
      </div>
      {files.length > 0 && (
        <ul className="dropped">
          {files.map((f, i) => (
            <li key={i} className={f.state}>
              {f.state === 'uploading' ? <span className="spinner" /> : f.state === 'ok' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <div className="grow">
                <strong>{f.name}</strong>
                <span className="small muted block">{f.state === 'uploading' ? 'Reading…' : f.state === 'ok' ? `${KIND_NAME[f.kind!]} · ${f.detail}` : f.detail}</span>
              </div>
            </li>
          ))}
          {last && missing.length > 0 && files.every((f) => f.state !== 'uploading') && (
            <li className="waiting">
              <FileSpreadsheet size={18} />
              <div className="grow"><strong>Still needed: {missing.map((k) => KIND_NAME[k]).join(' and ')}</strong>
                <span className="small muted block">Drop it above to finish.</span></div>
              {last.result.iprs && <Button size="sm" onClick={() => onReady(last)}>Open anyway</Button>}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
