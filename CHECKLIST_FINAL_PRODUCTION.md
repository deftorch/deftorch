# Checklist Final Sebelum Production — Deftorch

Semua kode di `deftorch-fase-cd-fixed.zip` sudah lolos `tsc --noEmit` (0 error) dan `vitest run` (19/19). Checklist ini adalah **langkah-langkah yang cuma bisa kamu lakukan sendiri** — butuh kredensial/infra asli yang tidak tersedia di sandbox tempat saya bekerja. Centang berurutan, jangan lompat — beberapa langkah bergantung pada langkah sebelumnya.

---

## 1. Provisioning infrastruktur

- [ ] Buat project Supabase baru (atau pakai yang sudah ada)
- [ ] Buat bucket Cloudflare R2, ikuti `R2_SETUP.md` — termasuk **CORS** (izinkan `PUT` dari domain kamu) dan **lifecycle rule** untuk auto-hapus file kedaluwarsa
- [ ] Isi `.env.local` dengan kredensial **asli** (bukan dummy key seperti di `test/setup.ts`):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `GEMINI_API_KEY` (atau `GEMINI_API_KEY_1..N` untuk rotasi)
  - [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
  - [ ] `CRON_TOKEN` — generate baru (`openssl rand -hex 32`), **jangan** pakai nilai contoh
  - [ ] Opsional: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`
- [ ] Pastikan `.env.local` **tidak ter-commit** ke git (`.gitignore` sudah cover ini, tinggal dipastikan)

## 2. Migrasi database

- [ ] `supabase link` ke project asli
- [ ] `supabase db push` — jalankan migration **0001 sampai 0007 berurutan**. Perhatikan khusus:
  - [ ] `0006_fix_preset_child_rls_escalation.sql` harus jalan setelah `0002_rls.sql` (memperbaiki policy yang dibuat di sana)
  - [ ] `0007_message_versions_realtime.sql` harus jalan sebelum kamu mengetes Realtime untuk riwayat edit pesan
- [ ] Cek di Supabase Dashboard → Database → Replication: pastikan `chats`, `messages`, `message_versions`, `agents`, `composite_models`, `composite_steps`, `composite_router_rules`, `workflows`, `workflow_nodes` semuanya masuk publication `supabase_realtime`

## 3. Build & install verifikasi nyata

- [ ] `npm install` bersih (di environment kamu sendiri, akses internet normal)
- [ ] `npm run build` — **ini belum pernah saya buktikan sukses** (di sandbox saya terhambat akses `fonts.googleapis.com` yang diblokir kebijakan jaringan sandbox, bukan soal kode). Wajib dicoba sungguhan di sini.
- [ ] `npm run lint` bersih
- [ ] `npm run start` (setelah build) — buka di browser, pastikan halaman utama render tanpa error console

## 4. Test manual wajib — fungsional inti

- [ ] Signup akun baru → login → cek row baru muncul di tabel `profiles`
- [ ] Chat lokal (belum login) → login → **migrate** jalan → cek chat muncul di tabel `chats`/`messages` Supabase
- [ ] Buka 2 tab/device berbeda, login akun sama → edit chat di satu tab → **muncul live di tab lain** tanpa reload (Realtime)
- [ ] Edit/regenerate sebuah pesan → cek versi lama muncul juga di tab lain (validasi `message_versions` realtime dari `0007`)
- [ ] **Cek kolom token di tabel `messages`** — kirim beberapa chat, pastikan `prompt_tokens`/`completion_tokens`/`total_tokens` terisi angka asli, **bukan 0 terus** (ini validasi langsung untuk bug `tokens` yang baru diperbaiki)

## 5. Test manual wajib — keamanan (validasi ulang 3 bug yang kita perbaiki)

- [ ] **RLS preset**: login sebagai user biasa (bukan service role), coba `INSERT` langsung ke `composite_steps` dengan `composite_model_id` milik preset sistem (`user_id IS NULL`) lewat Supabase client — **harus ditolak** (`insufficient_privilege`, kode 42501)
- [ ] **Presigned URL size**: generate presigned URL untuk file 1MB, coba `PUT` file yang jauh lebih besar ke situ — **harus ditolak** R2 (403)
- [ ] **Migrate idempotency**: putus koneksi internet di tengah proses migrate (atau simulasikan lewat DevTools throttling), lalu login ulang — pastikan sisa chat yang belum ter-migrate **akhirnya tersimpan semua**, bukan diam-diam dianggap "sudah selesai"

## 6. Test manual wajib — fitur multi-provider & multi-modal

- [ ] Chat dengan model Gemini default → dapat balasan
- [ ] Chat dengan model GPT-4o/Claude/Llama/DeepSeek (BYOK atau server key) → pastikan **langsung** ke provider, cek log tidak lewat OpenRouter kecuali memang model tidak dikenal
- [ ] Custom agent dengan model Gemini + toggle Search Grounding aktif → tanya sesuatu yang butuh info terkini → cek hasil benar-benar dari pencarian
- [ ] Custom agent dengan model **non-Gemini** → pastikan toggle Search Grounding/Code Execution **otomatis nonaktif** di form (regresi Fase A)
- [ ] Toggle "Force Structured JSON" pada agent → cek output benar-benar JSON valid
- [ ] Upload gambar kecil (<4MB) tanpa login → tetap jalan (jalur inline base64)
- [ ] Login → upload video/audio/dokumen besar → lihat status "Mengunggah..." → selesai → pesan terkirim dengan referensi file, bukan base64 raksasa
- [ ] Workflow dengan node tipe `tool` **dan** node tipe `agent` → pastikan keduanya benar-benar memanggil model (bukan simulasi `setTimeout`)

## 7. Test manual wajib — akun & privasi

- [ ] Settings → Danger Zone → "Delete My Account" → konfirmasi → cek:
  - [ ] Row di `auth.users` benar-benar hilang
  - [ ] File di bucket R2 milik user itu **benar-benar terhapus**, bukan cuma row `media_assets`-nya
- [ ] Cron cleanup (`/api/cleanup-images`) jalan dengan `CRON_TOKEN` yang benar, ditolak dengan token salah

## 8. CI/CD

- [ ] Push `.github/workflows/ci.yml` ke repo GitHub asli
- [ ] Tambahkan secrets yang dibutuhkan job `supabase-integration` kalau mau itu jalan penuh
- [ ] Pastikan job `static-checks` (lint + typecheck + unit test + build) **hijau**
- [ ] Awasi job `supabase-integration` dan `e2e` — keduanya masih `continue-on-error: true` karena belum pernah tervalidasi jalan sungguhan. Begitu kamu saksikan hijau beneran sekali, hapus `continue-on-error` supaya wajib lolos untuk merge ke depannya

## 9. Keputusan produk yang masih terbuka (bukan bug, tapi perlu kamu putuskan)

- [ ] **BYOK cloud sync**: saat ini API key tetap client-only (Opsi A, tidak ada tabel `api_key_credentials`). Putuskan apakah tetap begini atau mau tambah sinkronisasi lintas perangkat (Opsi B, butuh enkripsi server-side)
- [ ] **GDPR data export**: baru ada "hapus akun", belum ada "unduh semua data saya" — putuskan apakah ini prioritas sebelum rilis publik
- [ ] **E2E test**: folder `test/e2e/` masih kosong — putuskan kapan mulai diisi (5 skenario prioritas sudah didaftar di `FASE_E_PLAN.md`)

## 10. Terakhir

- [ ] Baca ulang `README.md` sekali lagi — pastikan tidak ada klaim fitur yang sudah usang (kita sudah beberapa kali menemukan dokumentasi ketinggalan dari kode aktual sepanjang proyek ini)
- [ ] Commit semua ke git dengan riwayat yang jelas kalau belum — sandbox saya tidak menyimpan versi historis, jadi titik ini sebaiknya jadi baseline git resmi pertama

---

**Catatan jujur:** checklist ini saya susun dari seluruh temuan sepanjang percakapan kita — bukan template generik. Kalau ada satu saja item di bagian 5 dan 6 yang gagal saat dites manual, jangan lanjut ke rilis — balik ke saya dengan detail errornya, saya bisa bantu telusuri lagi.
