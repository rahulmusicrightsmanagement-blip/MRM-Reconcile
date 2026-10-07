# MRM changelog

## 0.2.0 – 2026-10-07 (minor)
- Reports step: Verification (re-reads the generated master, Amend and Registration files and checks every step – counts, no duplicates, right rows, IPRS values, statuses, and that every changed cell is explained) and a spreadsheet preview of the final master with before/after and where each value came from; faster LNV report export

## 0.1.1 – 2026-10-07 (patch)
- Map with master on a master with empty society columns: missing ISWC/ISRC count as 'Filled in step 3' (not Fix our master), waiting works get a 'Needs your decision' tile and are no longer counted as Only in master; footer version updates live in the dev server

## 0.1.0 – 2026-10-07 (minor)
- New IPRS step 3 'Fill IPRS columns': fills ISRC/ISWC/IPRS TUNECODE/Client status/General Status/Purpose of amendment per block from the IPRS report (one row per song, extra registrations in blocks 2-5), Not registered / Not our work, Confirm all suggestions, empty-master title+writers matching

## 0.0.1 – 2026-10-07 (patch)
- Map with master: chosen IPRS values now show in the master column (Added / Replaced in master, with the old value struck through); renamed titles show in the song list

## 0.0.0 – 2026-10-07 (baseline)
- Versioning starts. Society workspaces (IPRS, PRS) with Upload → Map with master → Reports.
- Map with master: choose per field which value our master keeps (Keep IPRS / Keep master, or Add to master when our master is empty); "Add all missing to master".
- Updated master (LNV format) download in Map with master and in Reports, with every chosen value applied.
- Footer shows the app version.
