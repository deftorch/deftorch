# Fase D — Progress (upload multi-modal via R2)

Melanjutkan `rencana-pengembangan-deftorch-lanjutan.md`. Backend Fase D
(slice awal) selesai di sesi sebelumnya. Sejak itu, kode ini melewati satu
putaran perbaikan eksternal yang menutup gap terbesar yang tadinya di
"Yang sengaja TIDAK dikerjakan" — **frontend upload UI-nya sekarang ada**.
Lihat "Perbaikan eksternal" di bawah; setiap klaim di situ sudah
diverifikasi ulang terhadap kode aktual, bukan cuma dipercaya dari nama
file/komentarnya.

## Perbaikan eksternal (diverifikasi ulang)

1. **`hooks/useMediaUpload.ts` — menutup gap #1 di bawah ("belum ada UI
   picker").** Hook ini yang memutuskan, per file, jalur mana yang
   dipakai: gambar kecil (≤ `MEDIA_LIMITS.INLINE_MAX_BYTES`) tetap lewat
   base64 inline seperti semula (tidak butuh login, tidak ada perubahan
   perilaku); video/audio/dokumen/gambar besar lewat alur R2 penuh
   (presign → PUT langsung ke R2 dari browser → complete). Alur R2
   mewajibkan sesi login (`useAuthStore().session`), dilempar sebagai
   `MediaUploadAuthRequiredError` kalau tidak ada — konsisten dengan
   `media_assets` yang butuh `user_id` nyata untuk RLS.
2. **Terintegrasi di semua titik yang relevan, dicek satu-satu:**
   - `app/page.tsx` (`processFiles`) — validasi ukuran per-kategori
     (bukan lagi flat 10MB), blokir kirim pesan kalau masih ada upload
     `uploading`/`error`, upload paralel per-file (`Promise.allSettled`)
     supaya file kecil tidak nunggu file besar di batch yang sama.
   - `components/chat/ChatImagePreview.tsx` — render status
     uploading (spinner)/error (pesan) di atas thumbnail/ikon file.
   - `hooks/useChatSubmit.ts` — attachment dengan `fileUri` (hasil
     upload R2 besar yang sudah direlay ke Gemini File API) dikonversi
     ke `{fileUri, mimeType}`, dicek **sebelum** parsing `data:` URL
     supaya tidak nyoba parse string kosong untuk attachment R2 (yang
     memang tidak pernah punya `url` — bytes-nya tidak pernah balik ke
     browser by design).
   - `types/index.ts` — `ImageAttachment` diperluas dengan
     `uploadStatus`, `uploadError`, `mediaAssetId`, `fileUri`,
     `mimeType`, `category`, semuanya optional (attachment gambar kecil
     yang lama tidak kena dampak apapun).
3. **`lib/r2-client.ts` / `app/api/upload-media/*` — dua perbaikan
   teknis di jalur R2 itu sendiri**, sudah dicek konsisten:
   ContentLength ikut di-sign di presigned URL (sebelumnya
   `sizeBytes` di request cuma dicek sekali di awal, tidak ditegakkan
   di storage-nya), dan magic-byte check sekarang baca 64 byte pertama
   lewat Range request alih-alih download seluruh file (bisa 500MB
   untuk video) — dicek juga bahwa cabang upload-ke-Gemini yang
   membutuhkan file penuh ikut disesuaikan supaya tidak salah baca
   ukuran dari buffer 64-byte itu.
4. **`app/api/cleanup-media/route.ts` sudah ada** (ditulis di slice
   sebelumnya) — menutup Fase D item 6 (lifecycle cleanup) untuk sisi
   Supabase-nya; sisi R2 tetap manual lewat `R2_SETUP.md` §4.
5. Diverifikasi ulang: `npm install` + `tsc --noEmit` = 44 error, identik
   baseline (cuma nomor baris bergeser). Nol regresi dari perubahan ini.

## Sudah dikerjakan (backend, slice awal)

1. **`lib/magic-bytes.ts`** — validator signature diekstrak dari
   `app/api/upload-image/route.ts` (JPEG/PNG/GIF/WebP) dan diperluas ke
   PDF (`%PDF-`), MP4 (`ftyp` box di byte 4-7), WAV (`RIFF...WAVE`, sesuai
   Fase D item 3). **Dites langsung** (bukan cuma `tsc --noEmit`) — 7
   kasus termasuk disambiguasi WebP vs WAV (dua-duanya container RIFF,
   dibedakan dari tag di byte 8-11) dan data acak yang harus ditolak,
   semua lolos. Lihat transkrip kerja untuk detail test.
2. **`lib/r2-client.ts`** — wrapper `@aws-sdk/client-s3` (R2 kompatibel
   S3 API) untuk presigned PUT URL, baca object server-side, hapus object.
3. **`lib/gemini-file-upload.ts`** — upload ke Gemini File API pakai
   protokol "multipart" (single-request), bukan resumable chunked upload.
   **Trade-off yang sadar diambil dan ditulis di komentar file itu
   sendiri**: koneksi putus di tengah upload besar = mulai dari nol lagi,
   tidak ada resume. Cukup untuk cap `MEDIA_LIMITS` saat ini
   (500MB video / 100MB audio); kalau mulai sering gagal di produksi,
   protokol resumable adalah langkah lanjutannya, belum diimplementasikan
   di slice ini.
4. **`app/api/upload-media/presign/route.ts`** — endpoint pertama:
   verifikasi token (pola sama dengan `app/api/migrate/route.ts`),
   validasi `sizeBytes` terhadap `MEDIA_LIMITS`, generate presigned PUT
   URL, insert baris `media_assets` (`processing_status: 'uploading'`,
   `expires_at` = now + 30 hari).
5. **`app/api/upload-media/complete/route.ts`** — endpoint kedua: baca
   ulang bytes dari R2 (server-side, bukan percaya klaim klien), cek
   magic-byte cocok dengan `file_category` yang diklaim, kalau tidak
   cocok → hapus baris + object (bukan diam-diam diloloskan). Kalau lolos
   dan ukurannya di atas `MEDIA_LIMITS.INLINE_MAX_BYTES`, relay ke Gemini
   File API sekali, simpan `gemini_file_uri`/`gemini_file_expires_at`.
6. **`config/constants.ts`** — `FILE_UPLOAD_CONFIG` (frontend) ditulis
   ulang supaya **hanya** mendaftarkan format yang benar-benar divalidasi
   `magic-bytes.ts` (image/PDF/MP4/WAV) — sebelumnya berjanji
   doc/docx/csv/txt/md yang tidak pernah divalidasi ataupun diterima
   backend sama sekali (`app/api/upload-image/route.ts` hard-block
   apapun yang bukan `image/*`). `MEDIA_LIMITS` baru ditambahkan sebagai
   sumber kebenaran ukuran per kategori di backend.
7. **`app/api/chat/route.ts` — bug nyata ditemukan dan diperbaiki**:
   cabang Gemini sebelumnya menangani `img.url` dengan cara push part
   teks `[Image URL: ...]` — Gemini REST API **tidak bisa** fetch URL
   eksternal sendiri, jadi ini secara diam-diam tidak pernah benar-benar
   mengirim gambarnya ke model, cuma menyebut URL-nya sebagai teks. Fase
   D menambahkan field `fileUri` di schema `images[]`, dipakai untuk
   emit `fileData: { mimeType, fileUri }` — cara yang benar untuk
   referensi file yang sudah diupload ke Gemini File API. `img.url` lama
   dibiarkan ada sebagai fallback dengan komentar yang menjelaskan
   keterbatasannya, bukan dihapus diam-diam (masih dipakai jalur non-
   Gemini/AI SDK yang memang bisa fetch URL publik).
8. **`app/api/cleanup-media/route.ts`** — cron baru (pola timing-safe
   compare yang sama dengan `app/api/cleanup-images/route.ts` yang sudah
   ada), menghapus baris `media_assets` yang `expires_at`-nya lewat, plus
   best-effort hapus object R2-nya.
9. **`R2_SETUP.md`** — runbook manual: buat bucket, API token, CORS
   policy, Object Lifecycle Rule. Semua langkah ini butuh dashboard
   Cloudflare/`wrangler` dengan kredensial asli — tidak bisa dijalankan
   dari sandbox ini, jadi didokumentasikan sebagai langkah manual,
   bukan dipalsukan seolah-olah sudah beres.
10. `package.json` — `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
    ditambahkan. `npm install` + `tsc --noEmit` dijalankan: tetap 44 error
    baseline lama, nol baru dari seluruh Fase D.

## Yang sengaja TIDAK dikerjakan / masih terbuka

- **`app/api/upload-image/route.ts` (jalur gambar lama) belum diganti**
  untuk pakai R2 atau mewajibkan login — dua jalur upload sekarang hidup
  berdampingan (Supabase Storage untuk gambar kecil yang sudah ada sejak
  awal, R2 untuk multi-modal baru). Ini keputusan sadar, sudah dicek
  alasannya masuk akal (satu-satunya pemanggil endpoint itu adalah tool
  analisis gambar anonim yang berdiri sendiri, bukan bagian alur chat
  berauth) — lihat `FASE_C_PROGRESS.md` poin 8 di "Perbaikan eksternal".
- **Provisioning R2 asli (bucket, CORS, lifecycle rule)** — lihat
  `R2_SETUP.md`, ini langkah manual yang harus kamu jalankan sendiri
  dengan akun Cloudflare asli. Belum berubah dari sebelumnya.
- **Resumable upload ke Gemini File API** — `lib/gemini-file-upload.ts`
  masih pakai protokol multipart single-request (lihat poin 3 di atas),
  bukan resumable chunked. Trade-off sadar, bukan lupa dikerjakan.
- **Belum ada satu baris pun dari Fase D yang dites terhadap R2/Gemini
  File API nyata.** `lib/magic-bytes.ts` sudah dites logikanya secara
  terpisah (7 kasus, termasuk disambiguasi WebP vs WAV dan penolakan
  data acak — semua lolos), tapi endpoint presign/complete secara
  end-to-end — termasuk apakah `ContentLength` di presigned URL beneran
  ditegakkan R2 seperti S3 (lihat "Perbaikan eksternal" poin 3), dan
  apakah upload multipart ke Gemini File API benar-benar diterima —
  belum diverifikasi terhadap infra nyata. Sama seperti Fase C: butuh
  kredensial nyata untuk divalidasi, bukan sesuatu yang bisa
  disimulasikan di sini.
