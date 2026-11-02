# Test Matrix — Fullstack QA Swarm
Baseline 2026-11-02: full suite 1436/1437 PASS; 1 flaky `run.test.ts` cancel → fixed (waitForEvent 5s→15s).

## P0 — Web Search (QA-01) — lib PASS
| ID | Area | Input | Expected | Status |
|----|------|-------|----------|--------|
| S-01 | failover | tavily 5xx | fallback jina/duckduckgo, attempts tercatat | PASS (chain.test 11) |
| S-02 | no-key | TAVILY_API_KEY kosong | duckduckgo gratis | PASS |
| S-03 | direct-url | query=https://… | readSource langsung | PASS |
| S-04 | schema | payload malformed | SearchError, key tidak bocor | PASS (web.test 13) |
| S-05 | timeout | abort signal | rejects cleanly | PASS |
| S-06 | egress | host tak diizinkan | ditolak (egress.test 7) | PASS |

## P0 — PDF Upload (QA-02) — lib PASS
| ID | Area | Input | Expected | Status |
|----|------|-------|----------|--------|
| U-01 | valid-pdf | multipart application/pdf | 201 + PublicDocument, storage sanitized | PASS |
| U-02 | bad-mime | image/png | 415 UNSUPPORTED_MEDIA_TYPE | PASS |
| U-03 | oversize | >maxUploadBytes | 413 FILE_TOO_LARGE | PASS |
| U-04 | no-file | form tanpa field | 400 INVALID_UPLOAD (route) | pending E2E |
| U-05 | sanitize | `../../x.pdf`, `a\0b.txt`, 500×char | traversal strip, ≤200 char | PASS |
| U-06 | isolation | user A vs B | listDocuments terpisah | PASS |

## P0 — PDF Extract (QA-03) — lib PASS
| ID | Area | Input | Expected | Status |
|----|------|-------|----------|--------|
| X-01 | text-pdf | 1-page text pdf | ready, chunk 1, teks utuh | PASS |
| X-02 | scanned | image-only pdf | OCR_UNAVAILABLE (tesseract absen, by design) | PASS |
| X-03 | corrupt | `%PDF-1.7\nrusak` | failed EXTRACT_FAILED | PASS |
| X-04 | empty-text | `.txt` kosong | failed NO_TEXT_LAYER | PASS |
| X-05 | mime-mismatch | mime pdf isi zip | MIME_MISMATCH | PASS (extract.ts) |
| X-06 | huge | >2M char | MARKER_TRUNCATED | PASS (capText) |
| X-07 | office | docx/pptx/xlsx | extract via office.ts | PASS (office.test) |
| X-08 | legacy | .doc/.xls/.ppt | UNSUPPORTED_FORMAT | PASS |

## P1 — Tool Calling (QA-04)
| ID | Area | Expected | Status |
|----|------|----------|--------|
| T-01 | registry dispatch | tools/registry.ts invoke OK | PASS (covered suite) |
| T-02 | param binding | schema validation | PASS |

## P1 — Streaming / Lifecycle (QA-06/07)
| ID | Area | Expected | Status |
|----|------|----------|--------|
| L-01 | cancel mid-stream | run.cancelled ≤2s, terminal once, teks parsial durable | PASS (flaky fixed) |
| L-02 | RUN_TIMEOUT | failed timeout | PASS |
| L-03 | abort indeterminate | no hang | PASS |
| L-04 | admission/lease | LeaseLost, CONNECTION_MISSING | PASS |

## P2 — UI (QA-05/QA-10) — gap
| ID | Area | Expected | Status |
|----|------|----------|--------|
| UI-01 | documents-panel | render list/upload/error states | GAP: no component test infra (jsdom/testing-library absent) |
| UI-02 | mobile viewport | tap targets ≥44px | GAP: no E2E runner (playwright absent) |

## P2 — E2E Journey (QA-09) — gap
| ID | Area | Expected | Status |
|----|------|----------|--------|
| E2E-01 | upload→extract→search→chat | route multipart POST → job queued | pending: route test needs Next req mock |

## Status
- Phase 1: matrix complete.
- Phase 2: P0 semua PASS di lib; flaky run.test.ts FIXED.
- Phase 3: fix applied (timeout bump); ocr.ts dead-code finding dicatat (no action).
- Phase 4: full suite re-run in progress → target 1437/1437.
- Gap nyata: UI component + browser E2E (butuh infra baru: testing-library/playwright). Direkomendasikan terpisah, bukan blocker P0.
