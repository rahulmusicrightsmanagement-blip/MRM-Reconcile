import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { Button, Card, FileDrop } from '../components/ui'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import type { ClientDetail, ClientRef } from '../types'

const STEPS = ['Client details', 'Our master', 'Societies']

export function Stepper({ steps, current, confirmed, onPick }: { steps: string[]; current: number; confirmed: number; onPick?: (n: number) => void }) {
  return (
    <ol className="stepper">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n <= confirmed
        const reachable = n <= confirmed + 1
        return (
          <li key={label} className={`${done ? 'done' : ''} ${n === current ? 'current' : ''}`}>
            <button type="button" disabled={!reachable || !onPick} onClick={() => onPick?.(n)}>
              <span className="stepper-dot">{done ? <Check size={13} /> : reachable ? n : <Lock size={11} />}</span>
              <span className="stepper-text"><small>Step {n}</small><b>{label}</b></span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Add a client: details → our master → societies. Each step is saved as soon as it is completed. */
export default function NewClient() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [client, setClient] = useState<ClientRef | null>(null)
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [form, setForm] = useState({ name: '', ipi: '', owner: '', due_date: '', home_society: 'IPRS' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chosen, setChosen] = useState<string[]>(['IPRS', 'PRS'])

  const saveDetails = async () => {
    setError(null); setBusy(true)
    try {
      const c = client
        ? (await api.updateClient(client.id, { name: form.name, owner: form.owner, due_date: form.due_date || null })).client
        : await api.createClient({ ...form, due_date: form.due_date || null })
      setClient(c)
      setStep(2)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const uploadMaster = async (file: File) => {
    setError(null); setBusy(true)
    try {
      setDetail(await api.uploadMaster(client!.id, file))
      toast('Master loaded', 'good')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const finish = async () => {
    setBusy(true)
    try {
      await api.addSocieties(client!.id, chosen)
      toast(`${client!.name} added`, 'good')
      navigate(`/clients/${client!.id}`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const confirmed = step - 1
  const m = detail?.master
  return (
    <AppShell trail={<span className="trail-name">Add client</span>}>
      <header className="page-header">
        <div><div className="eyebrow">New client</div><h1>Add a client</h1>
          <p className="lede">Three steps. After this the client gets one workspace per society – start with IPRS, then PRS, in any order.</p></div>
      </header>
      <Stepper steps={STEPS} current={step} confirmed={confirmed} onPick={(n) => n <= confirmed + 1 && (n === 1 || client) && setStep(n)} />

      {step === 1 && (
        <Card title="Client details" description="Who the client is. The IPI name number is used to check that every IPRS report you upload belongs to this client.">
          <div className="form-grid">
            <label>Client name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dhanya Suresh" autoFocus /></label>
            <label>IPI name number<input value={form.ipi} onChange={(e) => setForm({ ...form, ipi: e.target.value })} placeholder="e.g. 01076531558" disabled={!!client} /></label>
            <label>Home society
              <select value={form.home_society} onChange={(e) => setForm({ ...form, home_society: e.target.value })} disabled={!!client}>
                <option value="IPRS">IPRS (India)</option>
              </select>
            </label>
            <label>Owner<input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Team member handling the client" /></label>
            <label>Due date<input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          </div>
          {error && <div className="alert bad small">{error}</div>}
          <div className="wizard-actions">
            <Button variant="ghost" onClick={() => navigate('/')}>Cancel</Button>
            <Button variant="primary" disabled={!form.name.trim() || busy} onClick={saveDetails}>Save and continue<ArrowRight size={15} /></Button>
          </div>
        </Card>
      )}

      {step === 2 && client && (
        <Card title="Our master" description="The client's master (LNV report). It becomes the central catalogue: every society is compared against it. Upload it once – you can replace it later from the client page.">
          <FileDrop title="Upload our master (.xlsx)" hint="Drag the LNV report here or click to choose" accept=".xlsx,.xlsm"
            fileName={m?.name ?? null} busy={busy} onFile={uploadMaster} />
          {error && <div className="alert bad small">{error}</div>}
          {m && (
            <div className="master-check">
              <div className="mc-item"><b>{m.stats.songs}</b><span>songs</span></div>
              <div className="mc-item"><b>{m.stats.with_credits}</b><span>with writers filled in</span></div>
              <div className="mc-item"><b>{m.stats.columns}</b><span>columns read</span></div>
              <div className="mc-item"><b>{m.stats.societies?.length}</b><span>society blocks ({m.stats.societies?.join(', ')})</span></div>
              <div className={`mc-item ${m.stats.issues ? 'warn' : ''}`}><b>{m.stats.issues}</b><span>problems found in the master</span></div>
            </div>
          )}
          <div className="wizard-actions">
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setStep(1)}>Back</Button>
            <Button variant="primary" disabled={!m || busy} onClick={() => setStep(3)}>Continue<ArrowRight size={15} /></Button>
          </div>
        </Card>
      )}

      {step === 3 && client && detail && (
        <Card title="Societies to reconcile" description="Each society gets its own workspace and steps. You can add more later.">
          <div className="society-pick">
            {detail.available_societies.map((s) => {
              const on = chosen.includes(s.code)
              return (
                <button key={s.code} type="button" disabled={!s.available} className={`soc-option ${on ? 'on' : ''}`}
                  onClick={() => setChosen(on ? chosen.filter((c) => c !== s.code) : [...chosen, s.code])}>
                  <span className="soc-check">{on ? <Check size={14} /> : null}</span>
                  <span className="grow"><b>{s.name}</b><small>{s.country} · {s.kind}</small>
                    <small className="muted">{s.available ? `Needs: ${s.file}` : 'Coming soon'}</small></span>
                  {s.code === client.home_society && <span className="tag">home</span>}
                </button>
              )
            })}
          </div>
          {error && <div className="alert bad small">{error}</div>}
          <div className="wizard-actions">
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setStep(2)}>Back</Button>
            <Button variant="primary" disabled={!chosen.length || busy} onClick={finish}>Create client<Check size={15} /></Button>
          </div>
        </Card>
      )}
    </AppShell>
  )
}
