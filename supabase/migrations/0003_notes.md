# Catatan migrasi Fase C

## `api_key_credentials` — Opsi A dipakai
Tabel dibuat (untuk kesiapan skema di masa depan) tapi **kode saat ini
tidak menulis atau membaca tabel ini sama sekali**. BYOK tetap
sepenuhnya client-side di `localStorage`, persis seperti sebelum Fase C.
Ini sesuai rekomendasi default di `rancangan-database-deftorch.md` bagian 4:
kunci API tidak pernah menyentuh database, jadi kebocoran database tidak
ikut membocorkan API key user.

Kalau nanti Opsi B (sinkron API key lintas perangkat) diaktifkan:
tidak cukup cuma menambah endpoint. `encrypted_key` wajib dienkripsi
dengan `ENCRYPTION_SECRET` yang hanya ada di server, dan **hapus dulu**
policy `for all` di `0002_rls.sql` untuk tabel ini — ganti dengan policy
yang mengizinkan user melihat metadata (`provider`, `is_active`,
`updated_at`) tapi tidak pernah mengembalikan `encrypted_key` ke client.
Dekripsi hanya boleh terjadi di `app/api/chat/route.ts` pakai
`SUPABASE_SERVICE_ROLE_KEY`.

## Cara menjalankan migrasi ini
Proyek belum punya Supabase CLI project yang ter-link. Untuk apply:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Atau langsung lewat SQL Editor di dashboard Supabase, urutan:
`0001_schema.sql` → `0002_rls.sql`.

## Yang belum dikerjakan setelah slice ini
- Rewiring `chat-store.ts`/`settings-store.ts` supaya sumber data utama
  pindah ke Supabase (Realtime/polling), `localStorage` jadi cache saja.
  Slice ini baru menyediakan skema + auth + migrate endpoint; store lama
  masih 100% localStorage seperti sebelumnya sampai langkah ini dikerjakan.
- `app/api/migrate/route.ts` di slice ini melakukan bulk insert tapi
  belum dipanggil otomatis dari UI — perlu di-hook ke event
  `onAuthStateChange` = `SIGNED_IN` pertama kali (lihat TODO di file itu).
