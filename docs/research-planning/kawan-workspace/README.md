# Kawan Workspace — riset & PRD susunan ulang

26 Oktober 2026. Riset balik supernala.com + benchmark kompetitor + stack search/file-gen,
lalu PRD disusun ulang ke framing workspace ala Supernala dengan engine tunggal.

| Dokumen | Isi |
|---|---|
| [RISET](<RISET.md>) | Verifikasi klaim Supernala (bundle publik + DevTools), benchmark Manus/LobeChat/OpenWebUI/ChatGPT, stack search & file gen |
| [PRD](<PRD.md>) | PRD versi 2: posisi, delta D1-D6, search chain, tahapan. R01-R11 kawan-next tetap berlaku |
| [SDD-BACKEND](<SDD-BACKEND.md>) | Spesifikasi D1/D2/D3/D4/D6: schema additive, kontrak TS, event kanonik step.*, tool schema, batas keamanan, tes |
| [SDD-FRONTEND](<SDD-FRONTEND.md>) | Spesifikasi D4/D5/D6: OnboardingFocusCard, aktivitas per langkah, RunMeteringSummary, i18n, aksesibilitas, tes |
| [IMPLEMENTATION-PLAN](<IMPLEMENTATION-PLAN.md>) | DAG WO final + keputusan pasca-review (kontrak step, egress gate, metering DTO) + acceptance |
| [SDD-EXECUTION](<SDD-EXECUTION.md>) | Model eksekusi otomatis: swarm agent per WO, worktree terisolasi, QA + test agent, auto-push gated `AUTO_PUSH=1`, tracking status |
| [PROMPT-RUN](<PROMPT-RUN.md>) | Prompt siap copy-paste untuk menjalankan seluruh DAG via subagent + worktree sampai WO-10 |

Keputusan pemilik 26 Okt: lanjut Kawan existing, hybrid UX workspace + engine tunggal,
search gratis. Revisi search (Tavily→Jina→readability menggantikan SearXNG+DDG primer)
dibuat atas delegasi penuh pemilik, tercatat di PRD §Search chain.

Paket [kawan-next](<../kawan-next/>) tetap referensi arsitektur (SDD, IMPLEMENTATION-PLAN,
ACCEPTANCE, DECISIONS); paket ini tidak mengubahnya.
