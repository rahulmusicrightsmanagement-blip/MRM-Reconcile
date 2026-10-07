import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Circle, Minus } from 'lucide-react'
import { Card, Empty, Mono, StatusBadge } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, useClient } from '../../lib/client'
import { readWorkList } from '../../lib/worklist'
import { displayName } from '../../lib/names'
import type { Link as MapLink, WorkDetail } from '../../types'
import { RegBadge } from './Catalogue'

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 8 ? 'good' : score >= 5 ? 'warn' : 'bad'
  return <span className={`score ${tone}`}><b>{score}</b>/10</span>
}

function Evidence({ link }: { link: MapLink }) {
  if (!link.match) return null
  return (
    <div className="evidence-card">
      <div className="evidence-head">
        <div><strong>IPRS {link.internal_no}</strong> · {link.title}
          <div className="small muted">Linked to master row {link.master_row} by <b>{link.method}</b>{link.reason && ` · ${link.reason}`}</div></div>
        <ScoreBadge score={link.match.score} />
      </div>
      <ul className="points">
        {link.match.evidence.map((e) => (
          <li key={e.field}>
            <span className="pt-field">{e.field}</span>
            <span className={`pt-bar ${e.points > 0 ? 'plus' : e.points < 0 ? 'minus' : 'zero'}`}>
              <span style={{ width: `${Math.min(100, Math.abs(e.points) * 25)}%` }} />
            </span>
            <span className={`pt-num ${e.points > 0 ? 't-good' : e.points < 0 ? 't-bad' : 'muted'}`}>{e.points > 0 ? '+' : ''}{e.points}</span>
            <span className="small muted">{e.note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Back to the list this work was opened from, and Previous / Next through that list (also ← / → keys). */
function WorkNav({ workId, clientId }: { workId: number; clientId: number }) {
  const navigate = useNavigate()
  const list = readWorkList()
  const ids = list?.ids ?? []
  const i = ids.indexOf(workId)
  const prev = i > 0 ? ids[i - 1] : null
  const next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null
  const go = (id: number | null) => { if (id) navigate(`/clients/${clientId}/works/${id}`, { replace: true }) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      if (e.key === 'ArrowLeft' && prev) go(prev)
      if (e.key === 'ArrowRight' && next) go(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="work-nav">
      <button type="button" className="back-link link-btn" onClick={() => list?.back ? navigate(list.back) : history.back()}>
        <ArrowLeft size={14} />Back to {list?.label ?? 'list'}
      </button>
      <span className="grow" />
      {i >= 0 && ids.length > 1 && (
        <div className="wn-steps">
          <button type="button" className="btn sm" disabled={!prev} onClick={() => go(prev)} title="Previous (←)"><ChevronLeft size={15} />Previous</button>
          <span className="wn-pos"><b>{i + 1}</b> of {ids.length}{list?.label ? <span className="muted"> · {list.label}</span> : null}</span>
          <button type="button" className="btn sm" disabled={!next} onClick={() => go(next)} title="Next (→)">Next<ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  )
}

export default function WorkPage() {
  const { workId } = useParams()
  const { tasks, clientId } = useClient()
  const [work, setWork] = useState<WorkDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const version = tasks?.filter((t) => t.work.id === Number(workId)).map((t) => t.updated_at).join()
  useEffect(() => { api.work(Number(workId)).then(setWork).catch((e) => setError(e.message)) }, [workId, version])

  if (error) return <Empty title="Work not found">{error}</Empty>
  if (!work) return <div className="loading"><span className="spinner" />Loading…</div>
  const ids: [string, string[]][] = [['IPRS tune code', work.identifiers.IPRS ?? []], ['PRS tune code', work.identifiers.PRS ?? []],
    ['ISWC', work.identifiers.ISWC ?? []], ['ISRC', work.identifiers.ISRC ?? []]]
  const prsShown = work.sources.prs.length > 0 || work.credits.some((c) => c.sources.includes('PRS'))

  return (
    <div className="stack work-page">
      <WorkNav workId={Number(workId)} clientId={clientId} />
      <header className="work-head">
        <div>
          <h2>{work.title}</h2>
          <p className="muted"><Mono>{work.mrm_id}</Mono> · {work.origin === 'iprs' ? 'Added from the IPRS report' : `Our master row ${work.master_row ?? '—'}`}
            {work.alt_titles.length > 0 && <> · also “{work.alt_titles.join('”, “')}”</>}</p>
          <p className="small muted">{[work.category, work.language, work.duration].filter(Boolean).join(' · ')} · first seen {fmtDate(work.first_report)} · latest {fmtDate(work.last_report)}</p>
        </div>
      </header>

      <div className="soc-cards">
        {work.registration_detail.map((r) => (
          <div key={r.society} className={`soc-card ${r.status}`}>
            <div className="soc-card-head"><strong>{r.society}</strong><RegBadge status={r.status} /></div>
            <div className="small muted">{r.codes.length ? <>Tune code <Mono>{r.codes.join(', ')}</Mono></> : 'No tune code'}{r.found_by && ` · found by ${r.found_by}`}</div>
            {r.issues.length > 0 ? <ul className="reasons">{r.issues.map((i) => <li key={i.text}>{i.text}</li>)}</ul> : <p className="small">Registration agrees with our data.</p>}
          </div>
        ))}
      </div>


      <div className="grid-main">
        <Card title="Credits" description="One row per person across all sources – matched by IPI, then by name (word order and initials ignored).">
          <table className="kv-table credits">
            <thead><tr><th>Person</th><th>Role</th><th>IPI</th><th>IPRS share</th><th>Master</th>{prsShown && <th>PRS</th>}</tr></thead>
            <tbody>
              {work.credits.map((c) => {
                const partial = !(c.sources.includes('IPRS') && c.sources.includes('Master') && (!prsShown || c.sources.includes('PRS')))
                const mark = (on: boolean, label?: string) => on ? <span className="yes"><Check size={14} />{label}</span> : <span className="no"><Minus size={14} /></span>
                return (
                  <tr key={c.name + c.role} className={partial ? 'partial' : ''}>
                    <td>{displayName(c.name)}</td><td>{c.role}</td><td><Mono>{c.ipi || '—'}</Mono></td>
                    <td>{mark(c.sources.includes('IPRS'), c.share !== null && c.sources.includes('IPRS') ? `${c.share}%` : '')}</td>
                    <td>{mark(c.sources.includes('Master'), c.master_share != null ? `${c.master_share}%` : c.sources[0] === 'Master' && c.share != null ? `${c.share}%` : '')}</td>
                    {prsShown && <td>{mark(c.sources.includes('PRS'))}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Identifiers">
          <dl className="facts">
            {ids.map(([label, values]) => <Fragment key={label}><dt>{label}</dt><dd>{values.length ? values.map((v) => <div key={v}><Mono>{v}</Mono></div>) : <span className="muted">none</span>}</dd></Fragment>)}
          </dl>
          {work.sources.fills.length > 0 && <p className="small muted note-line">Filled into our master from IPRS: {work.sources.fills.map((f) => `${f.field} ${f.value}`).join(', ')}</p>}
        </Card>
      </div>

      {work.sources.links.length > 0 && (
        <Card title="Match evidence" description="Why this IPRS work was linked to our master: each field adds or removes points, out of 10. Identifiers are exact checks; a missing value counts as not comparable, never as a match.">
          <div className="stack">{work.sources.links.map((l) => <Evidence key={l.internal_no} link={l} />)}</div>
        </Card>
      )}

      <div className="grid-2">
        <Card title="Source records">
          <div className="stack small">
            {work.sources.iprs.map((w) => (
              <div key={w.internal_no}><b>IPRS report · work {w.internal_no}</b> <span className="muted">Excel rows {w.source_rows.join(', ')}</span>
                <div className="muted">{w.performer || '—'} · {w.production || '—'} · ISWC {w.iswc || '—'} · ISRC {w.isrc || '—'}</div></div>
            ))}
            {work.sources.master && (
              <div><b>Our master · row {work.sources.master.row}</b>
                <div className="muted">{work.sources.master.movie || '—'} · {work.sources.master.registrations.filter((r) => r.code).map((r) => `${r.society} ${r.code}${r.client_status ? ` (${r.client_status})` : ''}`).join(' · ') || 'no society codes'}</div></div>
            )}
            {work.sources.prs.map((w) => (
              <div key={w.code}><b>PRS works export · {w.code}</b><div className="muted">{w.writers.join(', ')} · {w.work_status}</div></div>
            ))}
            {work.sources.tunecode && Object.values(work.sources.tunecode.societies).map((s) => (
              <div key={s.society}><b>{s.society} check</b> <StatusBadge value={s.status} /></div>
            ))}
          </div>
        </Card>
        <Card title="History">
          <ol className="timeline">
            {work.events.map((e, i) => <li key={i}><Circle size={10} /><div><span>{e.text}</span><time>{new Date(e.at).toLocaleString()}</time></div></li>)}
          </ol>
        </Card>
      </div>
    </div>
  )
}
