import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Circle, PartyPopper } from 'lucide-react'
import { Badge, Button, Card, DataTable, Drawer, Empty, Mono, Tabs } from '../../components/ui'
import type { Filter } from '../../components/ui'
import { api } from '../../lib/api'
import { TASK_STATES, TASK_TYPE, TASK_TYPES, fmtDate, isClosed, today, useClient } from '../../lib/client'
import type { TaskState, TaskT } from '../../types'

type View = 'active' | 'open' | 'in_progress' | 'submitted' | 'closed' | 'all'

export function TaskTypeBadge({ t }: { t: Pick<TaskT, 'type' | 'society'> }) {
  const meta = TASK_TYPE[t.type]
  return <span className="task-type"><Badge tone={meta.tone} icon={false}>{meta.label}</Badge><span className="where">{t.society === 'MASTER' ? 'Our master' : t.society}</span></span>
}

export function StateSelect({ task, onChange, disabled }: { task: TaskT; onChange: (s: TaskState) => void; disabled?: boolean }) {
  return (
    <select className={`state-select ${task.state}`} value={task.state} disabled={disabled} aria-label="Status"
      onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.value as TaskState)}>
      {TASK_STATES.map((s) => <option key={s.id} value={s.id} disabled={s.id === 'verified' && task.state !== 'verified'}>{s.label}</option>)}
    </select>
  )
}

export default function Tasks({ society }: { society?: string } = {}) {
  const { tasks, updateTasks, clientId } = useClient()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'active'
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }
  const [bulkOwner, setBulkOwner] = useState('')
  const [bulkDue, setBulkDue] = useState('')
  const type = params.get('type')
  const where = society ?? params.get('where')
  const all = tasks ?? []

  const inView = (t: TaskT, v: View) => v === 'all' ? true : v === 'closed' ? isClosed(t.state) : v === 'active' ? !isClosed(t.state) : t.state === v
  const scoped = all.filter((t) => (!type || t.type === type) && (!where || t.society === where))
  const rows = scoped.filter((t) => inView(t, view))
  const owners = [...new Set(all.map((t) => t.owner).filter(Boolean))]
  const filters: Filter<TaskT>[] = [
    { label: 'Owner', options: [...owners.map((o) => ({ id: o, label: o })), { id: '__none', label: 'Unassigned' }], test: (t, v) => v === '__none' ? !t.owner : t.owner === v },
    { label: 'Due', options: [{ id: 'overdue', label: 'Overdue' }, { id: 'none', label: 'No due date' }], test: (t, v) => v === 'none' ? !t.due_date : !!t.due_date && t.due_date < today() && !isClosed(t.state) },
  ]
  const typeCounts = useMemo(() => TASK_TYPES.map((tt) => ({ ...tt, n: all.filter((t) => t.type === tt.id && (!where || t.society === where) && !isClosed(t.state)).length })), [all, where])
  const places = [...new Set(all.map((t) => t.society))]

  if (!tasks) return <div className="loading"><span className="spinner" />Loading tasks…</div>
  if (!all.filter((t) => !society || t.society === society).length) return <Empty icon={<PartyPopper size={22} />} title="No tasks">Nothing needs registering, amending or fixing{society ? ` at ${society}` : ''}.</Empty>

  return (
    <div className="stack">
      <div className="type-filter">
        <button type="button" className={!type ? 'active' : ''} onClick={() => set('type', null)}>All task types<span>{all.filter((t) => !isClosed(t.state) && (!where || t.society === where)).length}</span></button>
        {typeCounts.filter((t) => t.n > 0 || type === t.id).map((t) => (
          <button key={t.id} type="button" className={type === t.id ? 'active' : ''} onClick={() => set('type', type === t.id ? null : t.id)}>
            <span className={`mix-dot ${t.tone}`} />{t.label}<span>{t.n}</span>
          </button>
        ))}
        <span className="grow" />
        {!society && (
          <select value={where ?? ''} onChange={(e) => set('where', e.target.value || null)} aria-label="Society">
            <option value="">All societies</option>
            {places.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      <Card flush>
        <div className="card-pad">
          <Tabs value={view} onChange={(v) => set('view', v)} tabs={[
            { id: 'active', label: 'To do', count: scoped.filter((t) => inView(t, 'active')).length },
            { id: 'open', label: 'Open', count: scoped.filter((t) => t.state === 'open').length },
            { id: 'in_progress', label: 'In progress', count: scoped.filter((t) => t.state === 'in_progress').length },
            { id: 'submitted', label: 'Submitted', count: scoped.filter((t) => t.state === 'submitted').length },
            { id: 'closed', label: 'Closed', count: scoped.filter((t) => isClosed(t.state)).length },
            { id: 'all', label: 'All', count: scoped.length },
          ]} />
        </div>
        <DataTable<TaskT> rows={rows} rowKey={(t) => String(t.id)} selectable filters={filters}
          onRowClick={(t) => set('task', String(t.id))}
          search={(t) => `${t.work.mrm_id} ${t.work.title} ${t.codes.join(' ')} ${t.detail.join(' ')} ${t.owner} ${t.note}`}
          empty={view === 'active' ? <span><PartyPopper size={16} /> Nothing left to do in this list.</span> : 'No tasks here.'}
          bulk={(sel, clear) => (
            <>
              <select defaultValue="" aria-label="Set status" onChange={async (e) => { if (e.target.value) { await updateTasks(sel.map((t) => t.id), { state: e.target.value as TaskState }); clear() } }}>
                <option value="">Set status…</option>
                {TASK_STATES.filter((s) => s.id !== 'verified').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input className="bulk-input" placeholder="Owner" value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} />
              <Button size="sm" disabled={!bulkOwner} onClick={async () => { await updateTasks(sel.map((t) => t.id), { owner: bulkOwner }); clear() }}>Assign</Button>
              <input type="date" className="bulk-input" value={bulkDue} onChange={(e) => setBulkDue(e.target.value)} aria-label="Due date" />
              <Button size="sm" disabled={!bulkDue} onClick={async () => { await updateTasks(sel.map((t) => t.id), { due_date: bulkDue }); clear() }}>Set due</Button>
            </>
          )}
          columns={[
            { key: 'work', header: 'Work', sort: (t) => t.work.title, render: (t) => (
              <div><strong>{t.work.title}</strong><span className="small muted block mono">{t.work.mrm_id}</span></div>
            ) },
            { key: 'task', header: 'Task', sort: (t) => t.type + t.society, render: (t) => <TaskTypeBadge t={t} /> },
            { key: 'codes', header: 'Tune code', render: (t) => <span className="small mono">{t.codes.join(', ') || '—'}</span> },
            { key: 'why', header: 'Why', render: (t) => <span className="small clamp">{t.detail[0]}{t.detail.length > 1 && <span className="muted"> (+{t.detail.length - 1})</span>}</span> },
            { key: 'owner', header: 'Owner', sort: (t) => t.owner, render: (t) => <span className="small">{t.owner || <span className="muted">—</span>}</span> },
            { key: 'due', header: 'Due', sort: (t) => t.due_date ?? '9999', render: (t) => (
              <span className={`small ${t.due_date && t.due_date < today() && !isClosed(t.state) ? 't-bad' : ''}`}>{t.due_date ? fmtDate(t.due_date) : <span className="muted">—</span>}</span>
            ) },
            { key: 'state', header: 'Status', sort: (t) => TASK_STATES.findIndex((s) => s.id === t.state), render: (t) => (
              <StateSelect task={t} onChange={(s) => updateTasks([t.id], { state: s })} />
            ) },
          ]} />
      </Card>
      <TaskDrawer taskId={params.get('task') ? Number(params.get('task')) : null} clientId={clientId} onClose={() => set('task', null)} />
    </div>
  )
}

/** One task: why it exists, its status, owner, due date, note and full history. */
export function TaskDrawer({ taskId, clientId, onClose }: { taskId: number | null; clientId: number; onClose: () => void }) {
  const { updateTasks, tasks } = useClient()
  const [task, setTask] = useState<TaskT | null>(null)
  const [note, setNote] = useState('')
  const summary = tasks?.find((t) => t.id === taskId)
  useEffect(() => {
    if (!taskId) { setTask(null); return }
    api.task(taskId).then((t) => { setTask(t); setNote(t.note) })
  }, [taskId, summary?.updated_at])
  if (!taskId) return null
  const save = async (patch: Parameters<typeof updateTasks>[1]) => { await updateTasks([taskId], patch) }
  return (
    <Drawer open onClose={onClose} width={620} title={task ? task.work.title : 'Loading…'}
      subtitle={task && <div className="drawer-meta"><TaskTypeBadge t={task} /><Mono>{task.work.mrm_id}</Mono></div>}>
      {task && (
        <div className="stack">
          <div className="task-fields">
            <label>Status<StateSelect task={task} onChange={(s) => save({ state: s })} /></label>
            <label>Owner<input defaultValue={task.owner} key={task.owner} placeholder="Assign…" onBlur={(e) => e.target.value !== task.owner && save({ owner: e.target.value })} /></label>
            <label>Due<input type="date" value={task.due_date ?? ''} onChange={(e) => save({ due_date: e.target.value || null })} /></label>
          </div>
          <section>
            <h4 className="section-title">Why this task exists</h4>
            <ul className="reasons">{task.detail.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="small muted">Tune code: <Mono>{task.codes.join(', ') || 'none'}</Mono> · found in report {fmtDate(task.opened_report)}
              {task.closed_report && <> · closed in report {fmtDate(task.closed_report)}</>}</p>
          </section>
          <section>
            <h4 className="section-title">Note</h4>
            <textarea className="note-area" rows={3} value={note} placeholder="e.g. Amendment filed on the IPRS portal, ref 1234"
              onChange={(e) => setNote(e.target.value)} onBlur={() => note !== task.note && save({ note })} />
          </section>
          <section>
            <h4 className="section-title">History</h4>
            <ol className="timeline">
              {(task.events ?? []).map((e, i) => (
                <li key={i} className={e.kind}>
                  {e.kind === 'auto_verified' ? <CheckCircle2 size={14} /> : <Circle size={10} />}
                  <div><span>{e.text}</span><time>{new Date(e.at).toLocaleString()}</time></div>
                </li>
              ))}
            </ol>
          </section>
          <Link className="btn default" to={`/clients/${clientId}/works/${task.work.id}`}>Open the work<ArrowUpRight size={14} /></Link>
        </div>
      )}
    </Drawer>
  )
}
