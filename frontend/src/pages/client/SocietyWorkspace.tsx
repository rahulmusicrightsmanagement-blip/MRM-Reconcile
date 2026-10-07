import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Ban, Check, CheckCheck, CircleCheckBig, Download, FileSpreadsheet, Plus, RotateCcw, Trash2, UploadCloud, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Empty, Mono, StatusBadge } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, useClient } from '../../lib/client'
import { samePerson } from '../../lib/names'
import { RunProvider, useRun } from '../../lib/run'
import { useToast } from '../../lib/toast'
import type { Song } from '../../lib/model'
import type { FillBlock, FillRow, FillState, PrsWork, RunSummary, SocietySummary } from '../../types'
import { Stepper } from '../NewClient'
import { GapsTab, ImportTab, MapTab, OneLineTab, ReviewTab, TunecodeTab } from '../run/Panels'
import { VerifyAndPreview } from './Verify'

/** /clients/:id/societies/:society – one society's own space: its steps, its tasks, its reports. */
export default function SocietyWorkspace() {
  const { society = '' } = useParams()
  const { detail, refresh, clientId } = useClient()
  const [params] = useSearchParams()
  const s = detail?.societies.find((x) => x.code === society)
  if (!detail) return null
  if (!s) return <Empty title={`${society} is not set up for this client`}>Add it from the client page.</Empty>
  const reports = detail.reports.filter((r) => r.society === society)
  const runId = Number(params.get('report')) || s.report?.id
  if (!runId) return <StartReport s={s} clientId={clientId} onDone={refresh} />
  return (
    <RunProvider key={runId} runId={runId} onChange={refresh}>
      <Workspace s={s} reports={reports} />
    </RunProvider>
  )
}

/** Drop zone that creates a report for this society (if needed) and uploads its file. */
function SocietyDrop({ s, runId, onUploaded }: { s: SocietySummary; runId?: number; onUploaded: (runId: number) => void }) {
  const { clientId } = useClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const handle = async (file: File) => {
    setBusy(true); setError(null)
    try {
      const id = runId ?? (await api.startReport(clientId, s.code, date)).id
      await api.upload(id, 'auto', file)
      onUploaded(id)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      {!runId && <label className="inline-label">Report date<input type="date" className="inline-input date" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
      <div className={`start-drop ${over ? 'over' : ''}`} role="button" tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
        onClick={() => input.current?.click()}>
        <input ref={input} type="file" hidden accept=".xlsx,.xlsm,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }} />
        {busy ? <span className="spinner" /> : <UploadCloud size={30} />}
        <strong>{busy ? 'Checking the file…' : `Drop the ${s.meta.file || s.code + ' export'}`}</strong>
        <span className="muted">The file's format is checked before anything is saved. Only {s.code} files are accepted here.</span>
      </div>
      {error && <div className="alert bad small">{error}</div>}
    </div>
  )
}

function StartReport({ s, clientId, onDone }: { s: SocietySummary; clientId: number; onDone: () => Promise<void> }) {
  const navigate = useNavigate()
  return (
    <div className="stack">
      <SocietyHeader s={s} />
      <Card title={`Start ${s.meta.name}`} description={`${s.steps.length} steps: ${s.steps.join(' → ')}. Each one is confirmed before the next opens.`}>
        <SocietyDrop s={s} onUploaded={async (id) => { await onDone(); navigate(`/clients/${clientId}/societies/${s.code}?report=${id}`) }} />
      </Card>
    </div>
  )
}

function SocietyHeader({ s, right }: { s: SocietySummary; right?: ReactNode }) {
  return (
    <div className="soc-head">
      <div><div className="eyebrow">{s.meta.kind} · {s.meta.country}</div><h2>{s.meta.name}</h2></div>
      <span className="grow" />
      {right}
    </div>
  )
}

function Workspace({ s, reports }: { s: SocietySummary; reports: RunSummary[] }) {
  const { payload, loading, error, updateRun, runId } = useRun()
  const { clientId, refresh } = useClient()
  const [params, setParams] = useSearchParams()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v) }
    setParams(n)
  }
  if (loading && !payload) return <div className="loading"><span className="spinner" />Loading {s.code}…</div>
  if (error || !payload) return <Empty title="Could not open this report">{error}</Empty>
  const run = payload.run
  const steps = run.steps
  const confirmed = run.completed_at ? steps.length : Math.min(run.confirmed_step, steps.length)
  const hasFile = !!run.files[s.code.toLowerCase() as 'iprs' | 'prs']
  const ready = !!payload.result.tunecodes
  const step = !hasFile ? 1 : Math.min(Number(params.get('step')) || Math.min(confirmed + 1, steps.length), steps.length)

  const next = async () => {
    await updateRun({ confirmed_step: Math.max(run.confirmed_step, step) })
    set({ step: String(step + 1) })
  }
  const complete = async (done: boolean) => {
    await updateRun({ completed: done, confirmed_step: done ? steps.length : run.confirmed_step })
    toast(done ? `${s.code} marked complete` : `${s.code} reopened`, 'good')
  }

  return (
    <div className="stack">
      <SocietyHeader s={s} right={
        <div className="report-pick">
          {reports.length > 1 && (
            <select value={runId} onChange={(e) => set({ report: e.target.value, step: null })} aria-label="Report">
              {reports.map((x) => <option key={x.id} value={x.id}>Report {fmtDate(x.report_date)}{x.completed_at ? ' · completed' : ''}</option>)}
            </select>
          )}
          <span className="small muted">Report of {fmtDate(run.report_date)}</span>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(!adding)}>New report</Button>
          <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)} aria-label="Delete report" title="Delete this report" />
        </div>
      } />
      {adding && (
        <Card title={`New ${s.code} report`} description="Next period's file. Works keep their IDs, decisions carry over, and fixes this report confirms are verified automatically.">
          <SocietyDrop s={s} onUploaded={async (id) => { setAdding(false); await refresh(); navigate(`/clients/${clientId}/societies/${s.code}?report=${id}`) }} />
        </Card>
      )}
      {run.completed_at && (
        <div className="alert good-alert"><CircleCheckBig size={18} /><span className="grow"><b>{s.meta.name} is complete</b> for the report of {fmtDate(run.report_date)}.</span>
          <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => complete(false)}>Reopen</Button></div>
      )}

      <Stepper steps={steps} current={step} confirmed={hasFile ? confirmed : 0} onPick={(n) => set({ step: String(n) })} />

      {!hasFile ? (
        <Card title={`Upload the ${s.code} file`}><SocietyDrop s={s} runId={runId} onUploaded={async () => { await refresh(); navigate(0) }} /></Card>
      ) : !ready ? (
        <Empty title="Waiting for our master">Upload the client's master on the client page – this society is compared against it.</Empty>
      ) : (
        <>
          {steps[step - 1] === 'Upload file & check headers' && (s.code === 'IPRS' ? <IprsUploadStep s={s} /> : <PrsUploadStep s={s} />)}
          {steps[step - 1] === 'Map with master' && (s.code === 'IPRS' ? <IprsMapStep /> : <PrsMatch />)}
          {steps[step - 1] === 'Fill IPRS columns' && <FillStep onBack={() => set({ step: String(step - 1) })} />}
          {steps[step - 1] === 'Reports' && <ReportsStep s={s} />}
          <div className="step-footer">
            {step > 1 && <Button variant="ghost" onClick={() => set({ step: String(step - 1) })}>Back</Button>}
            <span className="grow small muted">Step {step} of {steps.length} · {steps[step - 1]}</span>
            {step < steps.length ? (
              <Button variant="primary" onClick={next}>{step <= run.confirmed_step ? 'Next step' : 'Confirm & continue'}<ArrowRight size={15} /></Button>
            ) : run.completed_at ? <Badge tone="good">Completed</Badge> : (
              <Button variant="primary" icon={<Check size={15} />} onClick={() => complete(true)}>Mark {s.code} complete</Button>
            )}
          </div>
        </>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete this report?" confirmLabel="Delete report" onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { await api.deleteRun(runId); toast('Report deleted', 'good'); setConfirmDelete(false); await refresh(); navigate(`/clients/${clientId}/societies/${s.code}`) }}>
        <p>The {s.code} report of {fmtDate(run.report_date)} and its review decisions are removed. The catalogue and task history stay.</p>
      </ConfirmDialog>
    </div>
  )
}

function CheckList({ checks }: { checks: { label: string; passed: boolean; detail: string }[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.label} className={c.passed ? 'ok' : 'fail'}>
          {c.passed ? <CircleCheckBig size={16} /> : <XCircle size={16} />}
          <div><strong>{c.label}</strong><span className="small muted">{c.detail}</span></div>
        </li>
      ))}
    </ul>
  )
}

function FileLine({ s }: { s: SocietySummary }) {
  const { payload, runId } = useRun()
  const { refresh } = useClient()
  const navigate = useNavigate()
  const [replace, setReplace] = useState(false)
  const f = payload!.run.files[s.code.toLowerCase() as 'iprs' | 'prs']!
  return (
    <Card title="File" actions={<Button size="sm" onClick={() => setReplace(!replace)}>{replace ? 'Cancel' : 'Replace file'}</Button>}>
      <p className="file-line"><FileSpreadsheet size={16} /><b>{f.name}</b><span className="muted small">uploaded {new Date(f.uploaded_at).toLocaleString()}</span></p>
      {replace && <SocietyDrop s={s} runId={runId} onUploaded={async () => { await refresh(); navigate(0) }} />}
    </Card>
  )
}

/* ---------------- Step 1 · Upload file & check headers ---------------- */

function IprsUploadStep({ s }: { s: SocietySummary }) {
  const { payload } = useRun()
  const iprs = payload!.result.iprs!
  const errors = iprs.issues.filter((i) => i.severity === 'error').length
  const warnings = iprs.issues.filter((i) => i.severity === 'warning').length
  return (
    <div className="stack">
      <div className="grid-2">
        <FileLine s={s} />
        <Card title="Header check" description="The fixed IPRS column format."><CheckList checks={iprs.checks} /></Card>
      </div>
      <div className="master-check">
        <div className="mc-item"><b>{iprs.stats.works}</b><span>works in the report</span></div>
        <div className="mc-item"><b>{iprs.stats.contributor_rows}</b><span>rows, turned into one line per work</span></div>
        <div className="mc-item"><b>{iprs.cleanup.length}</b><span>cells cleaned (spaces, numbers, split names)</span></div>
        <div className={`mc-item ${errors ? 'bad' : ''}`}><b>{errors}</b><span>errors in the data</span></div>
        <div className={`mc-item ${warnings ? 'warn' : ''}`}><b>{warnings}</b><span>warnings (missing ISWC / ISRC / IPI…)</span></div>
      </div>
      <details className="more-detail"><summary>See the data issues, clean-up log and one-line works</summary>
        <div className="stack"><ImportTab /><OneLineTab /></div>
      </details>
    </div>
  )
}

function PrsUploadStep({ s }: { s: SocietySummary }) {
  const { payload } = useRun()
  return (
    <div className="stack">
      <div className="grid-2">
        <FileLine s={s} />
        <Card title="Header check" description="The PRS works export columns."><CheckList checks={payload!.result.prs!.checks ?? []} /></Card>
      </div>
      <PrsUpload />
    </div>
  )
}

/* ---------------- Step 2 · Map with master ---------------- */

function IprsMapStep() {
  const { model, confirmAll, busy } = useRun()
  const review = model?.review.length ?? 0
  // The suggested master song of every waiting work: the current link, else the top candidate.
  const suggested = (model?.review ?? []).map((i) => ({ internal_no: i.id, master_row: i.link.master_row ?? i.link.candidates[0]?.row }))
    .filter((x): x is { internal_no: string; master_row: number } => !!x.master_row)
  return (
    <div className="stack">
      {review > 0 && <Card title={`${review} match${review === 1 ? '' : 'es'} need your decision`} description="Linked without full proof. Confirm or reject – your decision is remembered for every later report."
        actions={suggested.length > 0 && <Button variant="primary" size="sm" icon={<CheckCheck size={15} />} disabled={!!busy} onClick={() => confirmAll(suggested)}>Confirm all {suggested.length} suggestions</Button>}><ReviewTab /></Card>}
      <MapTab />
      <details className="more-detail"><summary>See the songs added from IPRS and the gaps filled in our master</summary><GapsTab /></details>
    </div>
  )
}

/* ---------------- Step 3 · Fill IPRS columns ---------------- */

const FILL_FILTERS: { id: FillState | 'all'; label: string; tone: string; explain: string }[] = [
  { id: 'all', label: 'All songs', tone: '', explain: 'Every song of the final master and what goes into its IPRS columns. One song keeps one row – each IPRS registration of it fills the next IPRS block (1, 2, 3 …).' },
  { id: 'uploaded', label: 'Uploaded', tone: 'good', explain: 'Registered at IPRS and the registration agrees with our master – Client status and General Status "Uploaded".' },
  { id: 'amend', label: 'Amend', tone: 'warn', explain: 'Registered, but something is wrong. Client status "Amend" = the client\'s own credit (missing, share, role, IPI). General Status "Amend" = other writers, publishers, shares, ISWC, or one ISWC on two works. The reason goes into "Purpose of amendment".' },
  { id: 'not_registered', label: 'Not registered', tone: 'bad', explain: 'No IPRS registration found – block 1 gets "Not registered". These are in the Registration report.' },
  { id: 'not_our_work', label: 'Not our work', tone: '', explain: 'Songs you marked "Not our work" (or already marked so in the master) – both statuses "Not our work", nothing to amend.' },
  { id: 'pending', label: 'Waiting', tone: 'brand', explain: 'A possible IPRS registration still waits for your decision in "Map with master". Nothing is written for these until you decide.' },
]

function BlockLine({ b }: { b: FillBlock }) {
  return (
    <div className="fill-block">
      <span className="fb-slot">{b.slot}</span>
      <span className="mono">{b.internal_no}</span>
      <span className="mono small muted">{b.iswc || 'no ISWC'} · {b.isrc || 'no ISRC'}</span>
    </div>
  )
}

const statusTone = (v: string) => v === 'Uploaded' ? 'good' : v === 'Amend' ? 'warn' : v === 'Not registered' ? 'bad' : 'neutral'

function FillStep({ onBack }: { onBack: () => void }) {
  const { payload, exportUrl, flagSongs, busy } = useRun()
  const [filter, setFilter] = useState<FillState | 'all'>('all')
  const fill = payload!.result.fill
  if (!fill) return <Empty title="Nothing to fill yet">Upload the IPRS report and our master first.</Empty>
  const sm = fill.summary
  const rows = fill.rows.filter((r) => filter === 'all' || r.state === filter)
  const count = (id: FillState | 'all') => id === 'all' ? fill.rows.length : sm[id]
  const current = FILL_FILTERS.find((f) => f.id === filter)!
  return (
    <div className="stack">
      <div className="explain"><div>The IPRS columns of our master (from <b>ISRC 1</b> onwards: ISRC · ISWC · IPRS TUNECODE · Client status · General Status · Purpose of amendment)
        are filled from the IPRS report, using the links from "Map with master". A song IPRS has registered more than once keeps <b>one row</b> and
        fills block 1, 2, 3 … Columns IPRS does not report (Society No, Production ID, distribution dates, ENJW, ICE key) stay as they are.</div></div>
      {sm.pending > 0 && (
        <div className="alert warn-alert"><span className="grow"><b>{sm.pending} song{sm.pending === 1 ? '' : 's'} wait for your decision</b> in "Map with master" – their IPRS columns are not filled until you confirm or reject the suggested IPRS work.</span>
          <Button size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>Back to Map with master</Button></div>
      )}
      <div className="master-check">
        <div className="mc-item"><b>{sm.blocks}</b><span>IPRS blocks filled</span></div>
        <div className="mc-item"><b>{sm.multi}</b><span>songs with 2+ IPRS registrations (one row each)</span></div>
        <div className={`mc-item ${sm.client_amend ? 'warn' : ''}`}><b>{sm.client_amend}</b><span>Client status: Amend</span></div>
        <div className={`mc-item ${sm.general_amend ? 'warn' : ''}`}><b>{sm.general_amend}</b><span>General Status: Amend</span></div>
        {sm.overflow > 0 && <div className="mc-item bad"><b>{sm.overflow}</b><span>registrations with no free IPRS block</span></div>}
      </div>
      <div className="map-filters fill-filters" role="tablist">
        {FILL_FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`${f.tone} ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            <b>{count(f.id)}</b><span>{f.label}</span>
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <p className="filter-explain grow">{current.explain}</p>
        <a className="btn primary sm" href={exportUrl('final')}><Download size={14} />Download master with IPRS columns filled</a>
      </div>
      <Card flush>
        <DataTable<FillRow> rows={rows} rowKey={(r) => r.key} search={(r) => `${r.title} ${r.blocks.map((b) => `${b.internal_no} ${b.iswc} ${b.isrc}`).join(' ')}`}
          selectable bulk={(sel, clear) => (
            <>
              <Button size="sm" icon={<Ban size={14} />} disabled={!!busy} onClick={async () => { await flagSongs(sel.map((r) => r.key), true); clear() }}>Mark {sel.length} Not our work</Button>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={async () => { await flagSongs(sel.map((r) => r.key), false); clear() }}>Remove Not our work</Button>
            </>
          )}
          columns={[
            { key: 'title', header: 'Song', sort: (r) => r.title, render: (r) => <div><strong>{r.title}</strong><span className="small muted block">{r.master_row ? `master row ${r.master_row}` : 'new row – added from IPRS'}</span></div> },
            { key: 'blocks', header: 'IPRS blocks (block · tune code · ISWC · ISRC)', sort: (r) => r.blocks.length, render: (r) => r.blocks.length
              ? <div>{r.blocks.map((b) => <BlockLine key={b.slot} b={b} />)}{r.overflow.length > 0 && <Badge tone="bad">{r.overflow.length} more – no free block</Badge>}</div>
              : r.state === 'pending' ? <Badge tone="brand" icon={false}>waiting for your decision</Badge> : <span className="muted small">block 1: status only</span> },
            { key: 'client', header: 'Client status', render: (r) => <StatusList r={r} pick={(b) => b.client_status} /> },
            { key: 'general', header: 'General Status', render: (r) => <StatusList r={r} pick={(b) => b.general_status} /> },
            { key: 'nw', header: '', render: (r) => r.marked_in_master ? <span className="small muted">marked in master</span> : r.state === 'pending' ? null : (
              <Button size="sm" variant={r.not_our_work ? 'default' : 'ghost'} disabled={!!busy} onClick={(e) => { e.stopPropagation(); flagSongs([r.key], !r.not_our_work) }}>
                {r.not_our_work ? 'Undo Not our work' : 'Not our work'}</Button>) },
          ]}
          expand={(r) => r.blocks.length ? (
            <table className="kv-table">
              <thead><tr><th>Block</th><th>IPRS TUNECODE</th><th>ISWC</th><th>ISRC</th><th>Client status</th><th>General Status</th><th>Purpose of amendment</th></tr></thead>
              <tbody>{r.blocks.map((b) => (
                <tr key={b.slot}><td>{b.slot}{b.already_in_master && <span className="tag">already in master</span>}</td><td><Mono>{b.internal_no}</Mono><span className="small muted block">{b.title}</span></td>
                  <td><Mono>{b.iswc || '—'}</Mono></td><td><Mono>{b.isrc || '—'}</Mono></td>
                  <td><Badge tone={statusTone(b.client_status)} icon={false}>{b.client_status}</Badge></td>
                  <td><Badge tone={statusTone(b.general_status)} icon={false}>{b.general_status}</Badge></td>
                  <td className="small">{[...b.client_reasons.map((x) => `Client: ${x}`), ...b.general_reasons].map((x) => <div key={x}>{x}</div>)}{!b.purpose && <span className="muted">—</span>}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="small muted">{r.state === 'pending' ? 'Decide the suggested IPRS work in "Map with master" first.' : `No IPRS registration – block 1 gets Client status and General Status "${r.not_our_work ? 'Not our work' : 'Not registered'}".`}</p>} />
      </Card>
    </div>
  )
}

function StatusList({ r, pick }: { r: FillRow; pick: (b: FillBlock) => string }) {
  if (!r.blocks.length) {
    if (r.state === 'pending') return <span className="muted">—</span>
    return <Badge tone={r.not_our_work ? 'neutral' : 'bad'} icon={false}>{r.not_our_work ? 'Not our work' : 'Not registered'}</Badge>
  }
  return <div className="status-list">{r.blocks.map((b) => <Badge key={b.slot} tone={statusTone(pick(b))} icon={false}>{r.blocks.length > 1 ? `${b.slot}: ` : ''}{pick(b)}</Badge>)}</div>
}

/* ---------------- Step 4 · Reports ---------------- */

const REPORT_FILES: Record<string, { name: string; label: string; hint: string; count?: 'Amend' | 'Registration' }[]> = {
  IPRS: [
    { name: 'step2', label: 'IPRS one-line', hint: 'The IPRS report as one row per work, with every writer, publisher and share' },
    { name: 'amend_lnv', label: 'Amend report (LNV format)', hint: 'Songs registered at IPRS whose registration differs from ours – in our master format, reason in "Purpose of amendment"', count: 'Amend' },
    { name: 'registration_lnv', label: 'Registration report (LNV format)', hint: 'Songs with no IPRS tune code – in our master format, ready to register', count: 'Registration' },
    { name: 'final', label: 'Master with IPRS columns filled (LNV)', hint: 'Our full master: IPRS blocks (ISRC, ISWC, tune code, Client / General status, Purpose of amendment) filled, missing songs added in green, and the values you chose in "Map with master"' },
  ],
  PRS: [
    { name: 'amend_lnv', label: 'Amend report (LNV format)', hint: 'Songs registered at PRS whose registration differs from ours – reason in "Purpose of amendment"', count: 'Amend' },
    { name: 'registration_lnv', label: 'Registration report (LNV format)', hint: 'Songs with no PRS tune code – in our master format, ready to register', count: 'Registration' },
  ],
}

function ReportsStep({ s }: { s: SocietySummary }) {
  const { exportUrl, payload } = useRun()
  const counts = (payload!.result.tunecodes?.summary[s.code] ?? {}) as Record<string, number>
  return (
    <div className="stack">
      <div className="report-files three">
        {(REPORT_FILES[s.code] ?? []).map((f) => (
          <a key={f.name} className="report-file" href={exportUrl(f.name)}>
            <FileSpreadsheet size={26} />
            <span className="grow"><b>{f.label}{f.count && <span className="rf-count">{counts[f.count] ?? 0} songs</span>}</b><small>{f.hint}</small></span>
            <Download size={18} />
          </a>
        ))}
      </div>
      {s.code === 'IPRS' && <VerifyAndPreview />}
      <details className="more-detail"><summary>See the tune-code status of every song</summary><TunecodeTab /></details>
    </div>
  )
}

/* ---------------- PRS step 1: the export and its format check ---------------- */

function PrsUpload() {
  const { payload } = useRun()
  const { detail } = useClient()
  const prs = payload!.result.prs!
  const name = detail?.client.name ?? ''
  const credited = (w: PrsWork) => w.writers.some((x) => samePerson(x, name))
  const withIswc = prs.works.filter((w) => w.iswc_valid).length
  return (
    <div className="stack">
      <div className="explain"><div>The client's PRS "my works" export – one row per PRS tune code. It was checked for the TITLE / TUNECODE / WRITER / PUBLISHER columns before it was saved.
        {prs.writer_columns > 0 && <> This export shows at most <b>{prs.writer_columns} writers</b> per work, so longer writer lists are cut off – that is not treated as an error.</>}</div></div>
      <div className="master-check">
        <div className="mc-item"><b>{prs.works.length}</b><span>PRS works</span></div>
        <div className="mc-item"><b>{prs.works.filter(credited).length}</b><span>credit {name}</span></div>
        <div className={`mc-item ${prs.works.length - prs.works.filter(credited).length ? 'warn' : ''}`}><b>{prs.works.length - prs.works.filter(credited).length}</b><span>do not credit the client</span></div>
        <div className="mc-item"><b>{withIswc}</b><span>with an ISWC</span></div>
      </div>
      <Card flush title="PRS works">
        <DataTable<PrsWork> rows={prs.works} rowKey={(w) => w.code} search={(w) => `${w.code} ${w.title} ${w.writers.join(' ')}`}
          filters={[{ label: 'Client', options: [{ id: 'yes', label: 'Credits the client' }, { id: 'no', label: 'Client missing' }], test: (w, v) => credited(w) === (v === 'yes') }]}
          columns={[
            { key: 'code', header: 'Tune code', render: (w) => <Mono>{w.code}</Mono>, sort: (w) => w.code },
            { key: 'title', header: 'Title', render: (w) => <strong>{w.title}</strong>, sort: (w) => w.title },
            { key: 'writers', header: 'Writers', render: (w) => <span className="small">{w.writers.join(', ')}</span> },
            { key: 'client', header: 'Client', render: (w) => credited(w) ? <Badge tone="good">credited</Badge> : <Badge tone="bad">missing</Badge> },
            { key: 'iswc', header: 'ISWC', render: (w) => <span className="small mono">{w.iswc || '—'}</span> },
            { key: 'pub', header: 'Publishers', render: (w) => <span className="small">{w.publishers.join(', ') || '—'}</span> },
          ]} />
      </Card>
    </div>
  )
}

/* ---------------- PRS step 2: which catalogue work each PRS registration belongs to ---------------- */

function PrsMatch() {
  const { model, payload, openSong } = useRun()
  const tc = payload!.result.tunecodes!
  const found = (s: Song) => s.tunecode?.societies.PRS
  const strength = (method: string) => method === 'Master tunecode' || method === 'ISWC' ? 'exact' : method ? 'title' : 'none'
  const rows = model!.songs
  const counts = { exact: rows.filter((s) => strength(found(s)?.method ?? '') === 'exact').length, title: rows.filter((s) => strength(found(s)?.method ?? '') === 'title').length }
  return (
    <div className="stack">
      <div className="explain"><div>Every work in our catalogue is looked up in the PRS export: first by the <b>PRS tune code</b> stored in our master, then by <b>ISWC</b>, then by <b>title</b>.
        Tune code and ISWC are exact matches; a title match should be checked by eye.
        {payload!.result.iprs ? ' The catalogue includes the songs and identifiers the IPRS check added.' : ' IPRS has not been checked yet, so the catalogue is our master alone.'}</div></div>
      <div className="master-check">
        <div className="mc-item"><b>{rows.length}</b><span>catalogue works</span></div>
        <div className="mc-item"><b>{counts.exact}</b><span>matched by tune code / ISWC</span></div>
        <div className={`mc-item ${counts.title ? 'warn' : ''}`}><b>{counts.title}</b><span>matched by title – check</span></div>
        <div className={`mc-item ${rows.length - counts.exact - counts.title ? 'bad' : ''}`}><b>{rows.length - counts.exact - counts.title}</b><span>not found at PRS</span></div>
        <div className="mc-item"><b>{tc.prs_not_in_report.length}</b><span>PRS works not in our catalogue</span></div>
      </div>
      <Card flush title="Catalogue ↔ PRS">
        <DataTable<Song> rows={rows} rowKey={(s) => s.key} onRowClick={(s, vis) => openSong(s.key, vis.map((v) => v.key), 'PRS matching')} search={(s) => `${s.title} ${found(s)?.codes.join(' ')}`}
          filters={[{ label: 'Match', options: [{ id: 'exact', label: 'Tune code / ISWC' }, { id: 'title', label: 'Title only' }, { id: 'none', label: 'Not found' }], test: (s, v) => strength(found(s)?.method ?? '') === v }]}
          columns={[
            { key: 'title', header: 'Our work', render: (s) => <div><strong>{s.title}</strong>{s.origin === 'iprs' && <span className="tag">added by IPRS</span>}</div>, sort: (s) => s.title },
            { key: 'code', header: 'PRS tune code', render: (s) => <Mono>{found(s)?.codes.join(', ') || '—'}</Mono> },
            { key: 'by', header: 'Matched by', render: (s) => { const m = found(s)?.method ?? ''; const k = strength(m)
              return k === 'none' ? <Badge tone="bad">not found</Badge> : <Badge tone={k === 'exact' ? 'good' : 'warn'}>{m.replace(' (please confirm)', '')}</Badge> } },
            { key: 'status', header: 'Result', render: (s) => found(s) ? <StatusBadge value={found(s)!.status} /> : '—' },
          ]} />
      </Card>
      {tc.prs_not_in_report.length > 0 && (
        <Card flush title={`PRS works not in our catalogue (${tc.prs_not_in_report.length})`} description="Registered at PRS with the client, but no work in our catalogue points to them – check whether they belong in the master.">
          <DataTable rows={tc.prs_not_in_report} rowKey={(w) => w.code} search={(w) => `${w.code} ${w.title}`}
            columns={[
              { key: 'code', header: 'Tune code', render: (w) => <Mono>{w.code}</Mono> },
              { key: 'title', header: 'Title', render: (w) => <strong>{w.title}</strong>, sort: (w) => w.title },
              { key: 'writers', header: 'Writers', render: (w) => <span className="small">{w.writers.join(', ')}</span> },
            ]} />
        </Card>
      )}
    </div>
  )
}

