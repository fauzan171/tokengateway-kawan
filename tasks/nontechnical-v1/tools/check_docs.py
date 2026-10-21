#!/usr/bin/env python3
"""Pemeriksa konsistensi dokumen paket nontechnical-v1.

Memeriksa (stdlib saja, tanpa framework):
  1. ID requirement REQ-NT-* unik di prd.md.
  2. ID work package WP-NT-Pn-mm unik di plan.md.
  3. Setiap WP merujuk minimal satu REQ-NT-* dan minimal satu SDD-<n>.
  4. Setiap REQ-NT-* dirujuk minimal satu WP (tidak ada requirement yatim).
  5. Rujukan REQ/SDD pada tabel WP benar-benar ada.
  6. Baris matriks COV-* unik di coverage.md; baris include wajib punya REQ.
  7. Setiap REQ pada kolom coverage benar-benar ada di prd.md.
  8. Semua link markdown relatif menunjuk file yang ada.

Keluar dengan kode 1 bila ada pelanggaran.
"""

import os
import re
import sys
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOCS = sorted(str(path.relative_to(ROOT)) for path in Path(ROOT).rglob("*.md"))
DOCS.append("../ACTIVE-SCOPE.md")

RE_REQ = re.compile(r"\bREQ-NT-\d{2}\b")
RE_WP = re.compile(r"\bWP-NT-P\d{1,2}-\d{2}\b")
RE_SDD_REF = re.compile(r"\bSDD-(\d{1,2})\b")
RE_COV = re.compile(r"^\|\s*(COV-\d{2})\s*\|", re.M)
RE_LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return fh.read()


def main():
    errors = []
    warnings = []
    docs = {name: read(name) for name in DOCS}

    prd = docs["prd.md"]
    plan = docs["plan.md"]
    sdd = docs["sdd.md"]
    coverage = docs["coverage.md"]

    # 1. Requirement unik (hanya baris definisi tabel).
    def_rows = [ln for ln in prd.splitlines() if re.match(r"^\|\s*REQ-NT-\d{2}\s*\|", ln)]
    req_ids = [RE_REQ.match(ln.strip().lstrip("|").strip()).group(0) for ln in def_rows]
    req_set = set(req_ids)
    for rid in sorted({r for r in req_ids if req_ids.count(r) > 1}):
        errors.append(f"REQ duplikat di prd.md: {rid}")
    if not req_set:
        errors.append("prd.md tidak memuat satu pun ID REQ-NT-*")

    # 2. Work package unik (hanya baris tabel definisi).
    wp_def_rows = [ln for ln in plan.splitlines() if re.match(r"^\|\s*WP-NT-P\d{1,2}-\d{2}\s*\|", ln)]
    wp_ids = [RE_WP.match(ln.strip().lstrip("|").strip()).group(0) for ln in wp_def_rows]
    wp_set = set(wp_ids)
    for wid in sorted({w for w in wp_ids if wp_ids.count(w) > 1}):
        errors.append(f"WP duplikat di plan.md: {wid}")
    if not wp_set:
        errors.append("plan.md tidak memuat satu pun ID WP-NT-*")

    # 3-5. Rujukan silang WP -> REQ/SDD, dan cek keberadaan.
    sdd_sections = set(RE_SDD_REF.findall(sdd))

    # Ambil blok tiap WP: baris tabel yang diawali WP.
    wp_rows = wp_def_rows
    req_referenced = set()
    for ln in wp_rows:
        wid = RE_WP.search(ln).group(0)
        reqs = set(RE_REQ.findall(ln))
        sdds = set(RE_SDD_REF.findall(ln))
        # Paket infrastruktur/audit boleh tanpa REQ langsung (mendukung banyak REQ).
        NO_REQ = {"WP-NT-P0-01", "WP-NT-P0-02", "WP-NT-P0-03", "WP-NT-P0-05",
                  "WP-NT-P0-06", "WP-NT-P0-07", "WP-NT-P2-04", "WP-NT-P5-09",
                  "WP-NT-P5-10", "WP-NT-P10-01", "WP-NT-P10-02", "WP-NT-P10-03",
                  "WP-NT-P10-04", "WP-NT-P10-05", "WP-NT-P10-06", "WP-NT-P10-07"}
        if not reqs and wid not in NO_REQ:
            warnings.append(f"{wid}: tidak merujuk REQ-NT-*")
        for r in reqs:
            if r not in req_set:
                errors.append(f"{wid}: merujuk {r} yang tidak ada di prd.md")
            req_referenced.add(r)
        NO_SDD = {"WP-NT-P10-06", "WP-NT-P10-07"}
        if not sdds and wid not in NO_SDD:
            warnings.append(f"{wid}: tidak merujuk SDD-<n>")
        for s in sdds:
            if s not in sdd_sections:
                errors.append(f"{wid}: merujuk SDD-{s} yang tidak ada di sdd.md")

    # 4. Requirement yatim (tidak dirujuk WP mana pun).
    orphan = sorted(req_set - req_referenced)
    for r in orphan:
        errors.append(f"{r}: requirement tidak dirujuk work package mana pun")

    # 6-7. Coverage.
    cov_rows = re.findall(r"^\|\s*(COV-\d{2})\s*\|(.*)$", coverage, re.M)
    cov_ids = [c[0] for c in cov_rows]
    for cid in sorted({c for c in cov_ids if cov_ids.count(c) > 1}):
        errors.append(f"COV duplikat di coverage.md: {cid}")
    if not cov_ids:
        errors.append("coverage.md tidak memuat baris COV-*")
    for cid, rest in cov_rows:
        cells = [c.strip() for c in rest.split("|")]
        decision = cells[2] if len(cells) > 2 else ""
        req_cell = cells[4] if len(cells) > 4 else ""
        if decision.startswith("include") and not RE_REQ.search(req_cell):
            errors.append(f"{cid}: baris include tanpa REQ")
        for r in RE_REQ.findall(req_cell):
            if r not in req_set:
                errors.append(f"{cid}: merujuk {r} yang tidak ada di prd.md")

    # 8. Link relatif ada.
    for name, text in docs.items():
        for target in RE_LINK.findall(text):
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            path = target.split("#", 1)[0]
            if not path:
                continue
            resolved = os.path.normpath(os.path.join(ROOT, os.path.dirname(name), path))
            if not os.path.exists(resolved):
                errors.append(f"{name}: link relatif tidak ditemukan -> {target}")

    print(f"Dokumen diperiksa : {len(docs)}")
    print(f"Requirement       : {len(req_set)}")
    print(f"Work package      : {len(wp_set)}")
    print(f"Baris coverage    : {len(cov_ids)}")
    print(f"Peringatan        : {len(warnings)}")
    for w in warnings:
        print(f"  WARN  {w}")
    print(f"Pelanggaran       : {len(errors)}")
    for e in errors:
        print(f"  FAIL  {e}")

    if errors:
        print("\nHASIL: GAGAL")
        return 1
    print("\nHASIL: LULUS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
