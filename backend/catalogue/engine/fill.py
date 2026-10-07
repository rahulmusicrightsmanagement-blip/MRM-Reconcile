"""Fill the master's IPRS columns (ISRC n · ISWC n · IPRS TUNECODE n · Client status · General Status ·
Purpose of amendment) from the IPRS report.

One master song keeps one row: every IPRS work linked to it goes into the next IPRS block (1, 2, 3 …).
Client status   – "Amend" when IPRS has the client's own credit wrong (missing, share, role, IPI, society).
General Status  – "Amend" when anything else on the registration is wrong (other writers, publishers,
                  shares, ISWC, share totals, the same ISWC on two works).
Both "Uploaded" when the registration is right; the reasons go into "Purpose of amendment".
Songs IPRS does not have get "Not registered"; songs the reviewer marks "Not our work" get that in both.
"""
import re

from .mapping import master_people
from .normalize import clean_text, same_party, title_similarity

UPLOADED, AMEND, NOT_REGISTERED, NOT_OUR_WORK = "Uploaded", "Amend", "Not registered", "Not our work"
# IPRS report problems that call for an amendment (others, e.g. a non-member publisher, are information only).
GENERAL_ISSUES = {"SHARE_TOTAL": "Shares do not total 100%", "DUPLICATE_ISWC": "Same ISWC on two IPRS works – ask IPRS to merge"}
GROUP_ROLE = {"authors": "Author", "composers": "Composer"}


def is_not_our_work(text):
    """'Not our work' as typed in masters, including the common typo 'Not Our Wok'."""
    return re.sub(r"[^a-z]", "", clean_text(text).lower()) in ("notourwork", "notourwok")


def _client_entries(people, client):
    return [c for c in people if same_party(c["name"], client["name"], c.get("ipi", ""), client.get("ipi_name_no", ""))]


def client_reasons(work, song, client):
    """What IPRS has wrong about the client's own credit on this work."""
    mine = _client_entries(work["contributors"], client)
    if not mine:
        return ["Client not credited at IPRS"]
    reasons = []
    c = mine[0]
    if not c["ipi"]:
        reasons.append("Client IPI missing at IPRS")
    elif client.get("ipi_name_no") and c["ipi"] != client["ipi_name_no"]:
        reasons.append(f"Client IPI {c['ipi']} at IPRS, expected {client['ipi_name_no']}")
    if c["society"] and c["society"].upper() != "IPRS":
        reasons.append(f"Client shown with society {c['society']} at IPRS")
    if song and song.get("has_credits"):
        for group, role in GROUP_ROLE.items():
            at_iprs = bool(_client_entries(work[group], client))
            in_master = bool(_client_entries(master_people(song, group), client))
            if at_iprs and not in_master:
                reasons.append(f"Client is {role} at IPRS, not in our master")
            elif in_master and not at_iprs:
                reasons.append(f"Client is {role} in our master, not at IPRS")
        ours = [p for g in ("authors", "composers") for p in _client_entries(song.get(g, []), client) if p["perf"] is not None]
        if ours and c["per_own"] is not None and abs(ours[0]["perf"] - c["per_own"]) > 0.05:
            reasons.append(f"Client share {c['per_own']:g}% at IPRS, {ours[0]['perf']:g}% in our master")
    return reasons


def general_reasons(work, comparison, client):
    """Everything else on the registration that should be amended."""
    reasons = []
    for f in (comparison or {}).get("fields", []):
        if f["result"] != "different" or f["field"] not in ("Authors", "Composers", "Publishers", "ISWC"):
            continue
        if f["field"] == "ISWC":
            reasons.append(f"ISWC {f['iprs']} at IPRS, {f['master']} in our master")
            continue
        # Drop the parts about the client – those belong to Client status.
        parts = []
        for part in (f["note"] or "").split(" · "):
            label, _, names = part.partition(": ")
            if label in ("Only in IPRS", "Only in master"):
                others = [n for n in names.split(", ") if n and not same_party(n, client["name"])]
                if others:
                    parts.append(f"{label}: {', '.join(others)}")
            elif part and not same_party(label, client["name"]):
                parts.append(part)
        if parts:
            reasons.append(f"{f['field']} – " + "; ".join(parts))
    for code in dict.fromkeys(work["issue_codes"]):
        if code in GENERAL_ISSUES:
            reasons.append(GENERAL_ISSUES[code])
    return reasons


def _block(slot, work, comparison, song, client, existing):
    c_reasons = client_reasons(work, song, client)
    g_reasons = general_reasons(work, comparison, client)
    return {"slot": slot, "internal_no": work["internal_no"], "title": work["title"],
            "isrc": work["isrc_valid"] or work["isrc"], "iswc": work["iswc_valid"] or work["iswc"],
            "client_status": AMEND if c_reasons else UPLOADED, "general_status": AMEND if g_reasons else UPLOADED,
            "client_reasons": c_reasons, "general_reasons": g_reasons,
            "purpose": "; ".join(c_reasons + g_reasons), "already_in_master": existing}


def fill_iprs_columns(iprs, master, mapping, final, client, not_our_work=(), slots=5):
    """Plan, per final-report song, what goes into each IPRS block. not_our_work: song keys the reviewer marked."""
    works = {w["internal_no"]: w for w in iprs["works"]}
    links = {l["internal_no"]: l for l in mapping["links"]}
    songs = {s["row"]: s for s in master["songs"]}
    flagged = set(not_our_work)
    pending_rows = {c["row"] for l in mapping["links"] if l["state"] == "review" for c in l["candidates"][:1]}
    rows = []
    for r in final["rows"]:
        song = songs.get(r["master_row"])
        existing = {}  # slot -> code already in the master's IPRS block
        master_flag = False
        for reg in (song or {}).get("registrations", []):
            if reg["society"] == "IPRS":
                if reg.get("code"):
                    existing[reg["slot"]] = reg["code"]
                master_flag = master_flag or is_not_our_work(reg.get("client_status", "")) or is_not_our_work(reg.get("general_status", ""))
        linked = [works[i] for i in r["iprs_works"] if i in works]
        # Exact-title registrations first, then versions; oldest IPRS number first.
        linked.sort(key=lambda w: (title_similarity(w["title"], r["title"]) < 100, int(w["internal_no"]) if w["internal_no"].isdigit() else 0))
        blocks, overflow = [], []
        used = {slot: code for slot, code in existing.items()}
        placed = {code: slot for slot, code in existing.items()}
        for w in linked:
            slot = placed.get(w["internal_no"])
            if slot is None:
                slot = next((n for n in range(1, slots + 1) if n not in used), None)
                if slot is None:
                    overflow.append(w["internal_no"])
                    continue
                used[slot] = w["internal_no"]
            comparison = links.get(w["internal_no"], {}).get("comparison")
            blocks.append(_block(slot, w, comparison, song, client, w["internal_no"] in placed))
        blocks.sort(key=lambda b: b["slot"])
        not_ours = r["key"] in flagged or master_flag
        if not_ours:
            for b in blocks:
                b.update(client_status=NOT_OUR_WORK, general_status=NOT_OUR_WORK, purpose="")
        if blocks:
            state = "not_our_work" if not_ours else "amend" if any(AMEND in (b["client_status"], b["general_status"]) for b in blocks) else "uploaded"
        elif r["master_row"] in pending_rows:
            state = "pending"
        else:
            state = "not_our_work" if not_ours else "not_registered"
        rows.append({"key": r["key"], "origin": r["origin"], "master_row": r["master_row"], "title": r["title"],
                     "state": state, "blocks": blocks, "overflow": overflow, "not_our_work": not_ours,
                     "marked_in_master": master_flag})
    summary = {s: sum(1 for x in rows if x["state"] == s) for s in ("uploaded", "amend", "not_registered", "not_our_work", "pending")}
    summary.update(blocks=sum(len(x["blocks"]) for x in rows), multi=sum(1 for x in rows if len(x["blocks"]) > 1),
                   overflow=sum(len(x["overflow"]) for x in rows),
                   client_amend=sum(1 for x in rows for b in x["blocks"] if b["client_status"] == AMEND),
                   general_amend=sum(1 for x in rows for b in x["blocks"] if b["general_status"] == AMEND))
    return {"rows": rows, "summary": summary, "slots": slots}

