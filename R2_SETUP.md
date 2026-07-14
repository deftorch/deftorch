# Setup Cloudflare R2 — Fase D

Langkah-langkah ini **tidak bisa dijalankan dari sandbox ini** (butuh akun
Cloudflare + kredensial asli). Kode di `lib/r2-client.ts` dan
`app/api/upload-media/*` sudah siap begitu bucket ini ada.

## 1. Buat bucket

Dashboard Cloudflare → R2 → Create bucket. Atau via `wrangler`:

```bash
wrangler r2 bucket create deftorch-media
```

## 2. Buat API token (access key + secret key)

Dashboard R2 → **Manage R2 API Tokens** → Create API Token. Beri
permission **Object Read & Write**, dibatasi ke bucket `deftorch-media`
saja (jangan "Apply to all buckets").

Simpan 3 nilai ini ke `.env.local` (lihat `.env.local.example`):
- `R2_ACCOUNT_ID` — ada di URL dashboard R2 kamu
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME=deftorch-media`

## 3. Set CORS policy

Bucket butuh CORS supaya browser bisa `PUT` langsung pakai presigned URL
dari `/api/upload-media/presign`. Dashboard R2 → bucket → Settings →
CORS Policy, atau via `wrangler`/API:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-domain.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Ganti `https://your-domain.com` dengan domain production asli (lihat
`NEXT_PUBLIC_SITE_URL` di `.env.example`). **Jangan pakai `"*"` di
`AllowedOrigins`** — presigned URL sudah membatasi siapa yang bisa upload,
tapi CORS wildcard tetap memperluas permukaan serangan tanpa perlu.

## 4. Object Lifecycle Rules (auto-hapus file kedaluwarsa)

Fase D item 6 di roadmap: gantikan cron `cleanup-images` manual dengan
lifecycle rule bawaan R2. Dashboard R2 → bucket → Settings → Object
Lifecycle Rules → Add rule:

- **Rule name**: `expire-media-assets`
- **Prefix**: (kosong — berlaku ke seluruh bucket, karena semua object di
  bucket ini memang media upload, tidak ada campuran dengan hal lain)
- **Action**: Delete object
- **Condition**: Age since upload > 30 days (sesuaikan dengan kebijakan
  retensi yang diinginkan — 30 hari dipilih sebagai default yang wajar
  untuk chat attachment, bukan angka yang di-mandate dokumen desain)

**Penting**: lifecycle rule di sisi R2 ini menghapus **object di R2**,
bukan baris `media_assets` di Supabase. Baris metadata akan jadi
orphaned (mengarah ke object yang sudah tidak ada) kecuali ada job
terpisah yang membersihkan baris `media_assets` dengan `expires_at`
terlampaui juga — ini belum dibuat (lihat "Belum dikerjakan" di
`FASE_C_PROGRESS.md`/progress Fase D). Opsi paling simpel: set
`media_assets.expires_at` di kode aplikasi setiap kali insert row baru
(`now() + interval '30 days'`, sama dengan lifecycle rule di atas), lalu
tambah satu cron ringan (pola sama dengan `app/api/cleanup-images/route.ts`
yang sudah ada) yang `delete from media_assets where expires_at < now()`.
Kolom `expires_at` sudah ada di skema (`0001_schema.sql`) tapi tidak
pernah diisi oleh `app/api/upload-media/presign/route.ts` saat ini —
kolomnya siap, tinggal diisi.

## 5. Verifikasi

Setelah 1–4 selesai dan `.env.local` terisi:

```bash
npm run dev
```

Coba upload PDF/MP4/WAV lewat UI (setelah login — endpoint ini butuh
auth). Cek di dashboard R2 bahwa object muncul di bucket, dan di tabel
`media_assets` Supabase bahwa baris berubah dari `processing_status:
'uploading'` ke `'ready'`.
