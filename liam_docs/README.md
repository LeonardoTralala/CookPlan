# 📚 liam_docs — Dokumentasi Lengkap Pengembangan CookPlan AI

> Single source of truth untuk seluruh pengerjaan fitur AI Generate Foodplan & Foodprep CookPlan.
> Dibuat & dikelola sepanjang fase pengembangan — dari awal sampai akhir, tanpa ada yang miss.

---

## 🎯 Apa Ini?

Folder ini adalah **buku sejarah hidup** project CookPlan. Setiap keputusan, setiap fase,
setiap baris arsitektur dicatat di sini. Siapa pun anggota tim bisa baca dari `README.md`
ini, navigasi ke bagian yang relevan, dan langsung paham tanpa perlu bertanya.

**Tujuan utama proyek:** Membangun fitur **Generate Foodplan & Foodprep berbasis AI**
(provider-agnostic, bisa ganti model sesuka hati), lengkap dengan database resep dan
sistem order via WhatsApp — sesuai target MVP PKM-K 2026.

---

## 🗺️ Peta Navigasi

### 00 — OVERVIEW (Mulai di sini)
| Dokumen | Isi |
|---------|-----|
| [00-vision.md](./00-OVERVIEW/00-vision.md) | Visi proyek, status saat ini, goal MVP |
| [01-decisions-log.md](./00-OVERVIEW/01-decisions-log.md) | Semua keputusan arsitektur (ADR) |
| [02-glossary.md](./00-OVERVIEW/02-glossary.md) | Istilah teknis & domain |
| [03-progress-tracker.md](./00-OVERVIEW/03-progress-tracker.md) | Checklist hidup progress |

### 01 — ARCHITECTURE
| Dokumen | Isi |
|---------|-----|
| [00-system-overview.md](./01-ARCHITECTURE/00-system-overview.md) | Diagram arsitektur full |
| [01-tech-stack.md](./01-ARCHITECTURE/01-tech-stack.md) | Stack teknologi |
| [02-data-flow.md](./01-ARCHITECTURE/02-data-flow.md) | Flow input → AI → output |
| [03-database-schema.md](./01-ARCHITECTURE/03-database-schema.md) | ERD & relasi tabel |
| [04-ai-integration-design.md](./01-ARCHITECTURE/04-ai-integration-design.md) | Adapter AI provider-agnostic |
| [05-security-model.md](./01-ARCHITECTURE/05-security-model.md) | Auth, RLS, secrets, rate limit |
| [06-folder-structure.md](./01-ARCHITECTURE/06-folder-structure.md) | Struktur folder kode |

### 02 — SETUP
| Dokumen | Isi |
|---------|-----|
| [00-local-environment.md](./02-SETUP/00-local-environment.md) | Install prerequisites |
| [01-supabase-local-init.md](./02-SETUP/01-supabase-local-init.md) | Supabase CLI commands |
| [02-env-configuration.md](./02-SETUP/02-env-configuration.md) | .env vs .env.local, secrets |
| [03-first-run.md](./02-SETUP/03-first-run.md) | Step pertama kali jalan |
| [04-troubleshooting.md](./02-SETUP/04-troubleshooting.md) | Error umum & solusi |

### 03 — PHASES (Pengerjaan bertahap)
| Fase | Folder | Fokus |
|------|--------|-------|
| Roadmap | [00-roadmap.md](./03-PHASES/00-roadmap.md) | Timeline & dependency |
| Phase 0 | [phase-0-local-setup/](./03-PHASES/phase-0-local-setup/) | Setup environment lokal |
| Phase 1 | [phase-1-database-foundation/](./03-PHASES/phase-1-database-foundation/) | Skema DB + RLS + seed |
| Phase 2 | [phase-2-reactivate-app/](./03-PHASES/phase-2-reactivate-app/) | Service layer + routing |
| Phase 3 | [phase-3-edge-function-ai/](./03-PHASES/phase-3-edge-function-ai/) | Edge Function + AI |
| Phase 4 | [phase-4-ui-generate-flow/](./03-PHASES/phase-4-ui-generate-flow/) | UI generate + manual edit |
| Phase 5 | [phase-5-order-via-wa/](./03-PHASES/phase-5-order-via-wa/) | Order via WhatsApp |
| Phase 6 | [phase-6-admin-ui/](./03-PHASES/phase-6-admin-ui/) | Admin UI + role |
| Phase 7 | [phase-7-mobile-responsive/](./03-PHASES/phase-7-mobile-responsive/) | Mobile responsive (fokus) |
| Phase 8 | [phase-8-testing-polish/](./03-PHASES/phase-8-testing-polish/) | Testing & polish |
| Phase 11 | [phase-11-regenerate-day/](./03-PHASES/phase-11-regenerate-day/) | Regenerate menu harian + catatan |

### 04 — REFERENCE
| Dokumen | Isi |
|---------|-----|
| [00-database-schema-full.md](./04-REFERENCE/00-database-schema-full.md) | SQL final semua tabel |
| [01-rls-policies-full.md](./04-REFERENCE/01-rls-policies-full.md) | Semua RLS policy |
| [02-edge-functions-api.md](./04-REFERENCE/02-edge-functions-api.md) | Spec API Edge Functions |
| [03-frontend-services-api.md](./04-REFERENCE/03-frontend-services-api.md) | API service layer |
| [04-prompt-library.md](./04-REFERENCE/04-prompt-library.md) | Template prompt AI |
| [05-json-schemas.md](./04-REFERENCE/05-json-schemas.md) | Schema input/output |
| [06-error-codes.md](./04-REFERENCE/06-error-codes.md) | Daftar error code |
| [07-tailwind-tokens.md](./04-REFERENCE/07-tailwind-tokens.md) | Design tokens |
| [08-supabase-cli-cheatsheet.md](./04-REFERENCE/08-supabase-cli-cheatsheet.md) | Cheatsheet CLI |

### 05 — OPERATIONS
| Dokumen | Isi |
|---------|-----|
| [00-local-dev-workflow.md](./05-OPERATIONS/00-local-dev-workflow.md) | Daily dev flow |
| [01-database-backup-restore.md](./05-OPERATIONS/01-database-backup-restore.md) | Backup & restore DB |
| [02-future-production-deploy.md](./05-OPERATIONS/02-future-production-deploy.md) | Panduan deploy ke prod (untuk frontend & deploy berikutnya) |
| [03-incident-runbook.md](./05-OPERATIONS/03-incident-runbook.md) | Runbook insiden |
| [04-cost-monitoring.md](./05-OPERATIONS/04-cost-monitoring.md) | Monitoring biaya AI |
| [05-prod-deploy-2026-06-11.md](./05-OPERATIONS/05-prod-deploy-2026-06-11.md) | Report deploy backend prod pertama (Edge Functions + audit) |
| [06-schema-drift-audit-2026-06-11.md](./05-OPERATIONS/06-schema-drift-audit-2026-06-11.md) | Audit & remediasi drift skema prod |

---

## 🚦 Status Proyek Saat Ini

Lihat [03-progress-tracker.md](./00-OVERVIEW/03-progress-tracker.md) untuk status real-time.

**Mode pengembangan:** Phase 0–8 dikerjakan 100% LOCAL (Supabase CLI). **Phase 9
(2026-06-11): backend ter-deploy ke production** (`phdbbiydrjwxlehdfubh`) —
Edge Functions `generate-plan` & `admin-providers` ACTIVE, audit drift skema
selesai, end-to-end test passing. Frontend Vercel & admin role setup masih
pending tim.

---

## 📖 Konvensi Dokumen

Setiap dokumen fase punya frontmatter status:

```yaml
---
phase: <nomor>
status: not-started | in-progress | done | blocked
last-updated: YYYY-MM-DD
estimated-effort: <durasi>
dependencies: [fase lain]
---
```

Bahasa: **Indonesia santai** (konsisten dengan `docs/` existing).

---

*Dokumentasi ini dikelola oleh Liam (AI pair-programmer) bersama tim CookPlan.*
