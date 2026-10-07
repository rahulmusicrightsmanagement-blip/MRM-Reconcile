// Derived views over one run's pipeline result: a unified "song", the review
// queue and the action list. Pure functions so every page shares one answer.
import type {
  FinalRow, IprsWork, Link, MasterSong, PipelineResult, PrsWork, TunecodeRow,
} from '../types'

export interface Song {
  key: string
  title: string
  origin: 'master' | 'iprs'
  final: FinalRow
  master: MasterSong | null
  iprs: IprsWork[]
  links: Link[]
  tunecode: TunecodeRow | null
  prs: PrsWork[]
}

export interface ReviewItem {
  id: string
  kind: 'choose' | 'confirm_title' | 'conflict'
  link: Link
  title: string
  why: string
}

export interface RunModel {
  songs: Song[]
  byKey: Map<string, Song>
  keyForWork: Map<string, string>
  works: Map<string, IprsWork>
  links: Map<string, Link>
  review: ReviewItem[]
  societies: string[]
}

export function buildModel(result: PipelineResult): RunModel {
  const works = new Map((result.iprs?.works ?? []).map((w) => [w.internal_no, w]))
  const masterByRow = new Map((result.master?.songs ?? []).map((s) => [s.row, s]))
  const links = new Map((result.mapping?.links ?? []).map((l) => [l.internal_no, l]))
  const tunecodes = new Map((result.tunecodes?.rows ?? []).map((r) => [r.key, r]))
  const prsByCode = new Map((result.prs?.works ?? []).map((w) => [w.code, w]))

  const songs: Song[] = (result.final?.rows ?? []).map((row) => {
    const tc = tunecodes.get(row.key) ?? null
    const prsCodes = tc?.societies.PRS?.codes ?? []
    return {
      key: row.key,
      title: row.title,
      origin: row.origin,
      final: row,
      master: row.master_row ? masterByRow.get(row.master_row) ?? null : null,
      iprs: row.iprs_works.map((id) => works.get(id)).filter((w): w is IprsWork => !!w),
      links: row.iprs_works.map((id) => links.get(id)).filter((l): l is Link => !!l),
      tunecode: tc,
      prs: prsCodes.map((c) => prsByCode.get(c)).filter((w): w is PrsWork => !!w),
    }
  })
  const byKey = new Map(songs.map((s) => [s.key, s]))
  const keyForWork = new Map<string, string>()
  for (const s of songs) for (const w of s.iprs) keyForWork.set(w.internal_no, s.key)

  const review: ReviewItem[] = []
  for (const l of result.mapping?.links ?? []) {
    if (l.state === 'review') {
      review.push({ id: l.internal_no, kind: 'choose', link: l, title: l.title, why: l.reason || 'More than one possible master song' })
    } else if (l.state === 'linked' && l.method !== 'Confirmed by reviewer') {
      if (l.method === 'Title + contributors') {
        review.push({ id: l.internal_no, kind: 'confirm_title', link: l, title: l.title, why: 'Linked by title and a shared contributor – no identifier in common' })
      } else if (l.reason) {
        review.push({ id: l.internal_no, kind: 'conflict', link: l, title: l.title, why: l.reason })
      }
    }
  }

  return {
    songs, byKey, keyForWork, works, links, review,
    societies: Object.keys(result.tunecodes?.rows[0]?.societies ?? {}),
  }
}

export function songForWork(model: RunModel, internalNo: string) {
  const key = model.keyForWork.get(internalNo)
  return key ? model.byKey.get(key) ?? null : null
}
