# Rencana Fase E — Testing & CI

## Yang sudah dikerjakan hari ini (bukan rencana — sudah selesai)

Sebelum bicara rencana ke depan, ada fakta penting yang saya temukan begitu benar-benar mencoba menjalankan `npx vitest run`: **seluruh test suite yang sudah ada (5 file, `route.test.ts` di `chat`/`image-analysis`/`gemini-analysis`/`cleanup-images`/`upload-image`) selama ini gagal 100% — bukan gagal assertion, tapi gagal total sebelum satu test pun sempat jalan.**

| Akar masalah | Fix |
|---|---|
| `test/setup.ts` direferensikan `vitest.config.ts` dan diimpor 2 file test, tapi **filenya tidak pernah ada** | Dibuat: setup MSW server + `beforeAll/afterEach/afterAll` |
| Tidak ada `GEMINI_API_KEY`/dst di environment test, jadi route gagal duluan sebelum sempat kena mock MSW | Dummy key untuk semua provider di `test/setup.ts` |
| Mock `@/lib/ssrf-guard` di 2 file test masih stub `isSafeUrl` (API lama), padahal route sudah pakai `safeFetch` sejak fix SSRF | Mock diperbarui ke `safeFetch` |
| 1 test di `chat/route.test.ts` menguji kontrak response **lama** (`res.json()` → `.candidates` langsung, mengharapkan teks `// renderer: p5` dari sistem canvas-renderer yang sudah dihapus di Fase B) | Ditulis ulang: mock SSE Gemini yang realistis, assert terhadap `text/event-stream` yang benar-benar dikembalikan sekarang |

**Hasil: 5 file, 19 test, semua hijau — tervalidasi nyata, bukan cuma "harusnya lolos".** Ditambah `.github/workflows/ci.yml` baru supaya kegagalan sekelas ini (test yang sudah lama diam-diam mati) tidak bisa terjadi lagi tanpa ketahuan — kalau CI ada dari awal, ini akan merah sejak commit pertama.

Pelajaran pentingnya: **"ada file `*.test.ts`" tidak sama dengan "ada test yang jalan".** Ini alasan kenapa langkah pertama rencana di bawah bukan "tulis test baru", tapi "pastikan CI benar-benar jalan duluan".

---

## Piramida testing untuk Deftorch ke depan

```
        /\
       /E2E\          <- sedikit, mahal, paling realistis (Playwright)
      /------\
     /Integr. \       <- Supabase lokal asli untuk RLS, medium jumlah
    /----------\
   /   Unit     \     <- banyak, cepat, logic murni (Vitest + MSW)
  /--------------\
```

### 1. Unit test (Vitest + MSW) — perluas yang sudah ada

Modul logic murni yang **belum tersentuh sama sekali (0% coverage)** dan seharusnya jadi prioritas berikutnya:

| Modul | Kenapa penting ditest |
|---|---|
| `lib/ai-providers.ts` (`resolveNonGeminiModel`) | Baru dari Fase B, belum ada test sama sekali — pastikan fallback ke OpenRouter, error message per-provider yang hilang key, JSON-mode flag per provider semuanya benar |
| `lib/magic-bytes.ts` (`detectFileSignature`) | Keamanan langsung — pastikan tiap signature (JPEG/PNG/GIF/WebP/PDF/MP4/WAV) dan kasus penolakan (signature tidak cocok kategori) terverifikasi eksplisit |
| `lib/rate-limiter.ts` | Termasuk regresi test untuk celah IP-spoofing yang sudah didokumentasikan — test harus **mengonfirmasi keterbatasannya**, bukan cuma jalur bahagia |
| `hooks/useMediaUpload.ts` (kategori/limit detection) | Testable murni tanpa network — pisahkan `detectCategory()` jadi exported function kalau belum, supaya bisa ditest terisolasi |
| `lib/store/chat-store.ts` (`applyRemoteMessageVersionUpsert`, `applyRemoteMessageUpsert`) | Logic patch state dari realtime — mudah salah index, gampang ditest dengan input palsu |

### 2. Integration test (Vitest + Supabase CLI lokal) — bagian paling penting yang hilang

Ini yang selama ini **tidak mungkin** saya lakukan dari sandbox ini — butuh Postgres asli dengan skema + RLS benar-benar diterapkan, bukan mock. `.github/workflows/ci.yml` yang baru saya buat sudah menyiapkan job `supabase-integration` untuk ini (pakai `supabase/setup-cli`), tapi test-nya sendiri **belum ditulis** — foldernya (`test/integration/`) masih perlu dibuat.

**3 test regresi prioritas tertinggi** — langsung menguji 3 bug yang kita temukan & perbaiki minggu lalu, supaya tidak pernah muncul lagi diam-diam:

1. **RLS privilege escalation** (`0006_fix_preset_child_rls_escalation.sql`): login sebagai user biasa, coba `INSERT` ke `composite_steps` dengan `composite_model_id` milik preset sistem → harus ditolak RLS (403/error), bukan berhasil.
2. **Migrate idempotency** (`app/api/migrate/route.ts`): jalankan migrate, potong di tengah (mock network failure di request ke-N), jalankan ulang → assert **semua** chat akhirnya tersimpan, bukan cuma yang berhasil di percobaan pertama.
3. **Presigned URL size enforcement** (`lib/r2-client.ts`): generate presigned URL untuk 1MB, coba PUT file 10MB ke situ → harus ditolak R2 (403), bukan berhasil ter-upload.

### 3. E2E (Playwright) — belum ada folder `test/e2e/` sama sekali

`playwright.config.ts` sudah ada dan menunjuk ke `test/e2e/`, tapi foldernya kosong — makanya di CI saya kasih `continue-on-error: true` untuk job ini (tidak realistis blokir merge PR untuk sesuatu yang belum pernah ditulis). Skenario prioritas begitu mulai ditulis:

1. Kirim chat sederhana ke Gemini (model default) → dapat balasan.
2. Attach gambar kecil → terkirim inline base64 (jalur cepat `useMediaUpload`).
3. Login → attach video besar → lihat status "Mengunggah..." → selesai → terkirim dengan `fileUri`.
4. Login dari device A, kirim chat → buka tab baru (device B) → chat muncul lewat Realtime tanpa reload.
5. Buat custom agent dengan model non-Gemini → toggle Search Grounding otomatis disable (regresi UI dari Fase A).

## Rekomendasi urutan pengerjaan

1. ~~Perbaiki test suite yang ternyata 100% mati~~ ✅ **selesai hari ini**
2. ~~Setup CI dasar (lint, typecheck, unit test, build)~~ ✅ **selesai hari ini** (`.github/workflows/ci.yml`)
3. Tulis 3 integration test regresi di atas (RLS, migrate idempotency, presigned size) — **prioritas berikutnya**, karena ini satu-satunya cara memverifikasi perbaikan Fase C/D benar-benar berfungsi di Postgres/R2 sungguhan, bukan cuma lolos `tsc`
4. Isi unit test untuk 5 modul di tabel bagian 1
5. Mulai `test/e2e/` dengan skenario #1–2 (paling murah, paling sering berubah kalau ada regresi)
6. Baru setelah itu, ubah `continue-on-error: true` di job E2E jadi wajib lolos untuk merge

## Yang tetap tidak bisa saya lakukan dari sandbox ini

CI yang saya buat akan jalan dengan Supabase **lokal** (`supabase start`, Docker, data sekali pakai) dan MSW untuk semua panggilan provider AI — sengaja begitu supaya CI tidak butuh biaya nyata dan tidak butuh credential asli siapapun. Tapi ini berarti CI **tidak** menggantikan kebutuhan tes manual terhadap Supabase **project produksi**, bucket R2 **asli**, dan Gemini File API **sungguhan** sebelum rilis — itu tetap harus dilakukan manual oleh kamu, minimal sekali, sebelum fitur-fitur Fase C/D ini benar-benar dipakai user nyata.
