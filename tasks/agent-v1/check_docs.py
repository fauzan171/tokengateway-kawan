#!/usr/bin/env python3
"""Cek kontrak dokumen agen: link, ID, dependency DAG dan traceability."""
from pathlib import Path
from collections import Counter
import re
import sys

ROOT = Path(__file__).resolve().parent
RULES = {
    'req': ('01-requirements-architecture.md', r'R-AG-\d{2}'),
    'wo': ('08-work-orders.md', r'WO-AG-P\d-\d{2}'),
    'ac': ('09-acceptance-verification.md', r'AC-AG-\d{2}'),
}


def check(root=ROOT):
    errors = []
    docs = {p: p.read_text(encoding='utf-8') for p in root.rglob('*.md')}
    sets, rows = {}, {}
    for kind, (name, pattern) in RULES.items():
        text = docs.get(root / name, '')
        found = re.findall(r'^\|\s*(' + pattern + r')\s*\|(.+)$', text, re.M)
        ids = [key for key, _ in found]
        sets[kind] = set(ids)
        rows[kind] = dict(found)
        if not ids:
            errors.append(f'{name}: definisi {kind} kosong')
        for key, count in Counter(ids).items():
            if count != 1:
                errors.append(f'{name}: duplikat {key}')
    for path, text in docs.items():
        for kind, (_, pattern) in RULES.items():
            for key in set(re.findall(r'\b' + pattern + r'\b', text)):
                if key not in sets[kind]:
                    errors.append(f'{path.name}: ID tidak dikenal {key}')
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            if re.match(r'^(https?://|mailto:|#)', link):
                continue
            target = link.split('#', 1)[0]
            if target and not (path.parent / target).exists():
                errors.append(f'{path.name}: link hilang {link}')
    owned_req, owned_ac, graph = set(), set(), {}
    for key, rest in rows['wo'].items():
        cells = [cell.strip() for cell in rest.split('|')]
        if len(cells) < 6:
            errors.append(f'{key}: kolom WO tidak lengkap')
            continue
        req = set(re.findall(RULES['req'][1], cells[1]))
        ac = set(re.findall(RULES['ac'][1], cells[4]))
        deps = set(re.findall(RULES['wo'][1], cells[3]))
        if not req or not ac or not re.search(r'SDD-AG-\d', cells[2]):
            errors.append(f'{key}: rujukan requirement/SDD/acceptance kosong')
        owned_req |= req
        owned_ac |= ac
        graph[key] = deps
        for dep in deps:
            if dep not in sets['wo'] or dep == key:
                errors.append(f'{key}: dependency tidak sah {dep}')
    for key in sorted(sets['req'] - owned_req):
        errors.append(f'{key}: tidak punya work order')
    for key in sorted(sets['ac'] - owned_ac):
        errors.append(f'{key}: tidak punya work order')
    visiting, visited = set(), set()

    def visit(key):
        if key in visiting:
            errors.append(f'dependency cycle: {key}')
            return
        if key in visited:
            return
        visiting.add(key)
        for dep in graph.get(key, set()):
            visit(dep)
        visiting.remove(key)
        visited.add(key)
    for key in graph:
        visit(key)
    for number in range(1, 10):
        chapters = [p for p in docs if p.name.startswith(f'{number:02d}-')]
        if len(chapters) != 1 or len(docs[chapters[0]].splitlines()) < 20:
            errors.append(f'bab {number:02d} hilang/duplikat/kosong')
    return docs, sets, errors


if __name__ == '__main__':
    docs, sets, errors = check()
    print(f'Dokumen: {len(docs)}, requirement: {len(sets["req"])}, '
          f'work order: {len(sets["wo"])}, acceptance: {len(sets["ac"])}')
    for error in errors:
        print(f'FAIL: {error}')
    print(f'HASIL: {"GAGAL" if errors else "LULUS"} ({len(errors)} pelanggaran)')
    sys.exit(bool(errors))
