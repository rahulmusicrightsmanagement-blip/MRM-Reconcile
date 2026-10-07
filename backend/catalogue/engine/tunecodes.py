"""Step 5: look up each final-report song's tunecode per society.

Match        = tunecode found and the society's data agrees with our data
Amend        = tunecode found but the data differs (or the client is missing)
Registration = no tunecode found
Problems that sit in our own master are reported separately as master updates.
"""
from collections import defaultdict

from .master import codes_for
from .normalize import display_name, name_tokens, same_party, title_similarity

UNKNOWN_WRITER = frozenset({"unknown", "composer", "author"})

# Structured issue codes (the text in "reasons" is for people, these drive the task types):
# NOT_FOUND, CODE_NOT_IN_EXPORT, CLIENT_NOT_CREDITED, CREDITS_DIFFER, UNKNOWN_WRITER, ISWC_DIFFERS,
# DUPLICATE_REGISTRATION (two society IDs for one work – informational, does not change the status)


def _flag(result, code, text, affects_status=True):
    result["issues"].append({"code": code, "text": text})
    (result["reasons"] if affects_status else result["notes"]).append(text)
TITLE_LOOKUP_SCORE = 92


def _reference(row, songs_by_row, works_by_id, mapping_by_id):
    """Credits and identifiers we trust for a song: IPRS when linked, else the master."""
    song = songs_by_row.get(row["master_row"])
    iprs_works = [works_by_id[i] for i in row["iprs_works"]]
    writers, iswcs, titles = [], set(), [row["title"]]
    for w in iprs_works:
        writers += [c["name"] for c in w["authors"] + w["composers"]]
        if w["iswc_valid"]:
            iswcs.add(w["iswc_valid"])
        titles.append(w["title"])
    if song:
        iswcs.update(song["iswcs"])
        if not writers:
            writers = [p["name"] for p in song.get("authors", []) + song.get("composers", [])]
    unique = []
    for name in writers:
        if not any(same_party(name, u) for u in unique):
            unique.append(name)
    return {"song": song, "iprs_works": iprs_works, "writers": unique, "iswcs": iswcs, "titles": titles,
            "comparisons": [mapping_by_id[i].get("comparison") for i in row["iprs_works"] if i in mapping_by_id]}


def _iprs_status(row, ref, client, iprs_codes):
    song = ref["song"]
    result = {"society": "IPRS", "codes": row["iprs_works"], "method": "", "reasons": [], "notes": [], "issues": [], "master_updates": []}
    if row["origin"] == "iprs":
        result.update(status="Match", method="Added from IPRS report")
        result["master_updates"].append("New song – add to master with IPRS tunecode " + row["iprs_works"][0])
        return result
    unknown_codes = [c for c in codes_for(song, "IPRS") if c not in iprs_codes]
    if not ref["iprs_works"]:
        if unknown_codes:
            result.update(status="Amend", codes=unknown_codes, method="Master tunecode")
            _flag(result, "CODE_NOT_IN_EXPORT", f"IPRS code {', '.join(unknown_codes)} is in the master but not in the client's IPRS report – client may not be credited")
        else:
            result.update(status="Registration")
            _flag(result, "NOT_FOUND", "No IPRS tunecode found")
        return result

    result["method"] = "IPRS report"
    for work, comp in zip(ref["iprs_works"], ref["comparisons"]):
        if client.get("ipi_name_no") and not any(c["ipi"] == client["ipi_name_no"] for c in work["contributors"]):
            _flag(result, "CLIENT_NOT_CREDITED", f"{work['internal_no']}: client not credited")
        for f in (comp or {}).get("fields", []):
            if f["field"] in ("Authors", "Composers", "Publishers", "ISWC") and f["result"] == "different":
                _flag(result, "ISWC_DIFFERS" if f["field"] == "ISWC" else "CREDITS_DIFFER",
                      f"{work['internal_no']} {f['field']}: {f['note'] or 'IPRS ' + f['iprs'] + ' vs master ' + f['master']}")
            if f["result"] == "ipi_mismatch":
                result["master_updates"].append(f"Check IPI numbers: {f['note']}")
            if f["result"] == "missing_master" and f["field"] in ("Authors", "Composers", "Publishers", "ISWC"):
                result["master_updates"].append(f"Fill {f['field'].lower()} from IPRS {work['internal_no']}: {f['iprs']}")
    if unknown_codes:
        _flag(result, "CODE_NOT_IN_EXPORT", f"Master also lists IPRS code {', '.join(unknown_codes)} which is not in the IPRS report")
    iswcs = [w["iswc_valid"] for w in ref["iprs_works"] if w["iswc_valid"]]
    if len(iswcs) != len(set(iswcs)):
        dupes = [w["internal_no"] for w in ref["iprs_works"] if iswcs.count(w["iswc_valid"]) > 1]
        _flag(result, "DUPLICATE_REGISTRATION", f"IPRS works {', '.join(dupes)} share one ISWC – ask IPRS to merge them", affects_status=False)
    for fill in row["fills"]:
        result["master_updates"].append(f"Add {fill['field']} {fill['value']} to master")
    result["status"] = "Amend" if result["reasons"] else "Match"
    return result


def _prs_status(row, ref, client, prs, prs_by_code, used_codes):
    song = ref["song"]
    result = {"society": "PRS", "codes": [], "method": "", "reasons": [], "notes": [], "issues": [], "master_updates": []}
    master_codes = list(dict.fromkeys(codes_for(song, "PRS"))) if song else []
    found = [prs_by_code[c] for c in master_codes if c in prs_by_code]
    method = "Master tunecode"
    if not found and ref["iswcs"]:
        found = [w for w in prs["works"] if w["iswc_valid"] and w["iswc_valid"] in ref["iswcs"]]
        method = "ISWC"
    if not found:
        best = 0
        for w in prs["works"]:
            score = max(title_similarity(t, w["title"]) for t in ref["titles"])
            if score >= TITLE_LOOKUP_SCORE and score >= best:
                found = ([] if score > best else found) + [w]
                best = score
        method = "Title (please confirm)"
    missing_codes = [c for c in master_codes if c not in prs_by_code]

    if not found:
        if missing_codes:
            result.update(status="Amend", codes=missing_codes, method="Master tunecode")
            _flag(result, "CODE_NOT_IN_EXPORT", f"PRS code {', '.join(missing_codes)} is in the master but not in the client's PRS works list – client may not be credited")
        else:
            result.update(status="Registration")
            _flag(result, "NOT_FOUND", "No PRS tunecode found")
        return result

    result["method"] = method
    result["codes"] = [w["code"] for w in found]
    for w in found:
        used_codes.add(w["code"])
        writers = w["writers"]
        if client.get("name") and not any(same_party(client["name"], x) for x in writers):
            _flag(result, "CLIENT_NOT_CREDITED", f"{w['code']}: client not credited (writers: {', '.join(writers) or 'none'})")
        unknown = [x for x in writers if name_tokens(x) <= UNKNOWN_WRITER]
        if unknown:
            _flag(result, "UNKNOWN_WRITER", f"{w['code']}: 'Unknown Composer Author' listed")
        if ref["writers"]:
            extra = [x for x in writers if x not in unknown and not any(same_party(x, r) for r in ref["writers"])]
            missing = [r for r in ref["writers"] if not any(same_party(r, x) for x in writers)]
            if extra:
                _flag(result, "CREDITS_DIFFER", f"{w['code']}: writers not in our data: {', '.join(extra)}")
            if missing:
                text = f"{w['code']}: our writers missing at PRS: {', '.join(display_name(m) for m in missing)}"
                if prs.get("writer_columns") and len(writers) >= prs["writer_columns"]:
                    # The export only has this many WRITER columns, so the rest may simply be cut off.
                    result["notes"].append(text + f" (export shows only {prs['writer_columns']} writers)")
                else:
                    _flag(result, "CREDITS_DIFFER", text)
        if w["iswc_valid"] and ref["iswcs"] and w["iswc_valid"] not in ref["iswcs"]:
            _flag(result, "ISWC_DIFFERS", f"{w['code']}: PRS ISWC {w['iswc']} differs from ours")
        if song and w["code"] not in master_codes:
            result["master_updates"].append(f"Add PRS tunecode {w['code']} to master")
    if missing_codes:
        result["master_updates"].append(f"Master PRS code {', '.join(missing_codes)} not in PRS export – check it")
    result["status"] = "Amend" if result["reasons"] else "Match"
    return result


def search_tunecodes(iprs, master, mapping, final, prs=None, societies=("IPRS", "PRS")):
    """Check the societies asked for. A society workspace checks one society at a time."""
    check_iprs = "IPRS" in societies
    check_prs = bool(prs) and "PRS" in societies
    works_by_id = {w["internal_no"]: w for w in iprs["works"]}
    songs_by_row = {s["row"]: s for s in master["songs"]}
    mapping_by_id = {l["internal_no"]: l for l in mapping["links"]}
    iprs_codes = set(works_by_id)
    prs_by_code = {w["code"]: w for w in prs["works"]} if prs else {}
    master_issue_rows = defaultdict(list)
    for issue in master["issues"]:
        master_issue_rows[issue["row"]].append(issue["message"])

    results, used_prs = [], set()
    client = iprs["client"]
    for row in final["rows"]:
        ref = _reference(row, songs_by_row, works_by_id, mapping_by_id)
        checked = {}
        if check_iprs:
            checked["IPRS"] = _iprs_status(row, ref, client, iprs_codes)
        if check_prs:
            checked["PRS"] = _prs_status(row, ref, client, prs, prs_by_code, used_prs)
        master_updates = [u for s in checked.values() for u in s["master_updates"]]
        if check_iprs:  # problems inside our master are raised once, with the home-society check
            master_updates += master_issue_rows.get(row["master_row"], [])
        results.append({"key": row["key"], "origin": row["origin"], "master_row": row["master_row"],
                        "title": row["title"], "societies": checked, "master_updates": master_updates})

    summary = {}
    for society in (["IPRS"] if check_iprs else []) + (["PRS"] if check_prs else []):
        counts = defaultdict(int)
        for r in results:
            counts[r["societies"][society]["status"]] += 1
        summary[society] = {k: counts.get(k, 0) for k in ("Match", "Amend", "Registration")}
    summary["master_updates"] = sum(1 for r in results if r["master_updates"])
    unused = [{"code": w["code"], "title": w["title"], "writers": w["writers"]}
              for w in (prs["works"] if prs else []) if w["code"] not in used_prs]
    return {"rows": results, "summary": summary, "prs_not_in_report": unused}
