// The list a work page was opened from, so it can step to the previous / next work in that list.
const KEY = 'mrm-worklist'

export interface WorkList { ids: number[]; label: string; back: string }

export function saveWorkList(list: WorkList) {
  try { sessionStorage.setItem(KEY, JSON.stringify(list)) } catch { /* storage unavailable: no prev/next */ }
}

export function readWorkList(): WorkList | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as WorkList : null
  } catch {
    return null
  }
}
