# Desain Database (Supabase / Postgres)

| | |
| --- | --- |
| Status | Draft v1 — untuk ditinjau sebelum dibuat migration |
| Acuan | `docs/PRD.md` (Draft v3), konvensi di `README.md` § Database conventions |

Konvensi yang dipakai: nama tabel jamak `snake_case` (bahasa Inggris), PK
`id uuid default gen_random_uuid()`, FK `<tabel_tunggal>_id`, `created_at` di
semua tabel, `updated_at` di tabel yang bisa diedit. **RLS aktif di semua tabel.**

## 1. Glosarium (istilah lapangan → nama tabel)

| Istilah | Tabel |
| --- | --- |
| Pengguna aplikasi | `profiles` |
| Penjahit / anak jahit | `tailors` |
| Rekening / e-wallet penjahit | `tailor_payment_accounts` |
| Tukang potong | `cutters` |
| Produk / model (kode produk) | `products` |
| Bahan | `fabrics` |
| Warna bahan | `fabric_colors` |
| Ukuran (MIDI, …) | `sizes` |
| Tarif upah S/M/L | `wage_rates` |
| WO | `work_orders` |
| Baris WO per ukuran × warna (+ hasil potong) | `work_order_items` |
| Kartu jahit (kertas 6×10) | `sewing_cards` |
| Pemeriksaan finishing | `inspections` |
| Usulan potongan rusak permanen | `deduction_proposals` |
| Kasbon, cicilan, kerugian (buku kasbon) | `cash_advance_entries` |
| Periode gajian (Senin–Sabtu) | `payroll_periods` |
| Gaji per penjahit per periode | `payroll_lines` |
| Tambahan gaji (THR, bonus) | `payroll_additions` |
| Riwayat impor | `import_batches`, `legacy_wage_records`, `legacy_deposit_records` |
| Jejak perubahan | `audit_logs` |
| Anti tap-ganda | `idempotency_keys` |
| Kalibrasi printer | `print_settings` |

## 2. Diagram relasi

```mermaid
erDiagram
  profiles ||--o{ audit_logs : "actor"
  tailors ||--o{ tailor_payment_accounts : has
  tailors ||--o{ sewing_cards : holds
  tailors ||--o{ cash_advance_entries : ledger
  tailors ||--o{ payroll_lines : paid
  products ||--o{ work_orders : for
  fabrics ||--o{ fabric_colors : has
  fabrics ||--o{ work_orders : uses
  cutters ||--o{ work_orders : cuts
  work_orders ||--o{ work_order_items : "size x color"
  sizes ||--o{ work_order_items : ""
  fabric_colors ||--o{ work_order_items : ""
  work_order_items ||--o{ sewing_cards : "split into"
  sewing_cards ||--o{ inspections : "checked (per round)"
  inspections ||--o| deduction_proposals : "defective"
  payroll_periods ||--o{ payroll_lines : contains
  payroll_lines ||--o{ sewing_cards : "pays"
  payroll_lines ||--o{ cash_advance_entries : "disburses / repays"
  payroll_lines ||--o{ deduction_proposals : "applies"
  payroll_lines ||--o{ payroll_additions : ""
  import_batches ||--o{ legacy_wage_records : ""
  import_batches ||--o{ legacy_deposit_records : ""
```

## 3. Enum

| Enum | Nilai |
| --- | --- |
| `app_role` | `production_head`, `finishing_head`, `warehouse`, `owner`, `cutter`, `tailor` |
| `tailor_status` | `active`, `left` |
| `payment_account_type` | `bank`, `ewallet` |
| `wage_category` | `S`, `M`, `L` |
| `change_status` | `changed` (ADA PERUBAHAN), `follow_sample` (TIDAK ADA PERUBAHAN / IKUT SAMPEL) |
| `work_order_status` | `draft`, `cutting`, `sewing`, `done`, `cancelled` |
| `sewing_card_status` | `taken`, `submitted`, `paid`, `cancelled` |
| `inspection_status` | `pending`, `in_repair`, `done` |
| `deduction_decision` | `pending`, `deduct`, `waive` |
| `cash_advance_entry_type` | `opening_balance`, `advance`, `repayment`, `write_off` |
| `payroll_period_status` | `open`, `locked` |
| `payroll_line_status` | `draft`, `paid` |
| `import_source` | `tailor_data`, `weekly_deposit` |

Semua nominal uang bertipe **`bigint` (Rupiah utuh)**, selalu `>= 0`; arah
(tambah/kurang) ditentukan oleh jenis kolom/entri, bukan tanda minus.
Tanggal kerja (`*_on`) bertipe `date` dalam WIB; waktu kejadian (`*_at`)
bertipe `timestamptz`.

## 4. Tabel

### 4.1 Pengguna

**`profiles`**

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK, FK → `auth.users.id` |
| username | text | unik, lowercase, `^[a-z0-9_]{3,20}$` |
| display_name | text | not null |
| role | app_role | not null, default `production_head` |
| is_active | boolean | default true |
| created_at, updated_at | timestamptz | |

Dibuat otomatis oleh trigger `handle_new_user()` (lihat README § Authentication).

### 4.2 Master data

**`tailors`** — penjahit

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| code | text | **unik**, not null — kode penjahit (mis. `29`) |
| name | text | not null |
| phone | text | null |
| status | tailor_status | default `active` |
| left_on | date | wajib jika `status = left` |
| notes | text | |
| profile_id | uuid | FK → profiles, null (untuk login penjahit nanti) |
| created_at, updated_at | timestamptz | |

Index trigram (`pg_trgm`) pada `name` → peringatan nama mirip (DIDI/DINDI).

**`tailor_payment_accounts`** — rekening / e-wallet

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| tailor_id | uuid | FK → tailors |
| account_type | payment_account_type | |
| provider | text | mis. `SeaBank`, `DANA` |
| account_number | text | disimpan hanya digit (spasi dibuang) |
| account_holder | text | atas nama |
| is_active | boolean | **unik parsial**: satu rekening aktif per penjahit |
| created_at | timestamptz | |
| deactivated_at | timestamptz | null |

Rekening lama tidak dihapus, hanya dinonaktifkan (riwayat). Index biasa pada
`account_number` → peringatan "nomor sudah dipakai penjahit lain".

**`cutters`** — tukang potong: `id`, `name` (unik), `is_active`, `created_at`, `updated_at`.

**`products`**

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| code | text | **unik** (case-insensitive) — mis. `W-133 BLS` |
| name | text | null |
| wage_category | wage_category | null boleh saat dibuat; **wajib** sebelum dipakai di WO |
| sample_photo_public_id | text | Cloudinary public id |
| is_active | boolean | |
| created_at, updated_at | timestamptz | |

**`fabrics`** — `id`, `name` (unik, mis. `BLACK SWAN`), `is_active`, timestamps.
**`fabric_colors`** — `id`, `fabric_id`, `name`; unik (`fabric_id`, lower(`name`)).
**`sizes`** — `id`, `name` (unik, mis. `MIDI`), `sort_order`.

**`wage_rates`** — tarif per kategori, tidak pernah ditimpa

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| wage_category | wage_category | |
| amount | bigint | > 0 (S = 20.000, M = 25.000, L = 30.000) |
| effective_from | date | unik bersama `wage_category` |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | |

Fungsi `wage_rate_on(category, date)` → tarif yang berlaku pada tanggal itu.

### 4.3 Work order

**`work_orders`**

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| number | text | **unik**; default `WO_<kode_produk>`, `_2`, `_3` bila sudah ada; bisa diedit |
| ordered_on | date | tanggal WO |
| product_id | uuid | FK → products (kategori wajib terisi) |
| pattern_code | text | kode pola |
| fabric_id | uuid | FK → fabrics |
| fabric_combination | text | kombinasi, mis. `ORB` |
| cutter_id | uuid | FK → cutters |
| change_status | change_status | |
| change_notes | text | wajib jika `changed` |
| additional_info | text | info lebih lanjut |
| sample_photo_public_id | text | null = pakai foto produk |
| status | work_order_status | diperbarui oleh fungsi, bukan diisi manual |
| created_by | uuid | FK → profiles |
| created_at, updated_at | timestamptz | |

**`work_order_items`** — satu baris per ukuran × warna di WO

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| work_order_id | uuid | FK |
| size_id | uuid | FK → sizes |
| fabric_color_id | uuid | FK → fabric_colors (harus milik bahan WO) |
| cut_quantity | integer | null sebelum dipotong, lalu > 0 |
| created_at, updated_at | timestamptz | |

Unik (`work_order_id`, `size_id`, `fabric_color_id`).

### 4.4 Kartu jahit, pemeriksaan, potongan

**`sewing_cards`** — satu kartu = satu penjahit × satu ukuran × satu warna

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| number | text | **unik**, mis. `KJ-2610-0042` (isi QR) |
| work_order_item_id | uuid | FK |
| tailor_id | uuid | FK (penjahit harus `active`) |
| quantity | integer | > 0 |
| taken_on | date | tanggal ambil |
| wage_category | wage_category | **snapshot** dari produk |
| wage_rate | bigint | **snapshot** dari `wage_rate_on()` |
| wage_amount | bigint | generated: `quantity × wage_rate` |
| status | sewing_card_status | `taken → submitted → paid` |
| submitted_on | date | diisi saat setor |
| submitted_incomplete | boolean | default false — disetor belum 100% selesai |
| remaining_notes | text | sisa pekerjaan |
| remaining_delivered_on | date | saat sisa diserahkan |
| inspection_status | inspection_status | default `pending` |
| collected_at | timestamptz | scan pengumpulan Sabtu |
| payroll_line_id | uuid | FK → payroll_lines; **satu kartu hanya bisa masuk satu gajian** |
| warning_override_reason | text | alasan saat peringatan duplikat dikonfirmasi |
| print_count | integer | jumlah cetak (cetak ulang = nomor sama) |
| created_by | uuid | FK → profiles |
| created_at, updated_at | timestamptz | |

Aturan yang dijaga database (trigger/constraint):

- Σ `quantity` kartu aktif per `work_order_item` ≤ `cut_quantity`.
- `submitted_on` wajib jika status `submitted`/`paid`; `payroll_line_id` wajib jika `paid`.
- Kartu `paid` tidak bisa diubah jumlah/tarifnya.

**`inspections`** — pemeriksaan finishing, bisa beberapa putaran

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| sewing_card_id | uuid | FK |
| round | smallint | 1 = pemeriksaan awal, 2+ = setelah perbaikan; unik bersama kartu |
| inspected_on | date | |
| ok_quantity | integer | ≥ 0 |
| repairable_quantity | integer | ≥ 0 — dikembalikan ke penjahit |
| defective_quantity | integer | ≥ 0 — rusak permanen |
| notes | text | |
| created_by | uuid | |
| created_at | timestamptz | |

Putaran 1: total ≤ `quantity` kartu. Putaran n: total = `repairable_quantity`
putaran sebelumnya. `inspection_status` kartu diperbarui otomatis.

**`deduction_proposals`** — usulan potongan rusak permanen

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| inspection_id | uuid | FK, **unik** (satu usulan per pemeriksaan) |
| tailor_id | uuid | FK |
| quantity | integer | = `defective_quantity` |
| amount | bigint | `quantity × wage_rate` kartu |
| decision | deduction_decision | default `pending` |
| decision_notes | text | keputusan owner (dicatat Kepala Produksi di fase 1) |
| decided_at | timestamptz | |
| decided_by | uuid | |
| payroll_line_id | uuid | diisi saat dipotong di gajian |
| created_at, updated_at | timestamptz | |

### 4.5 Kasbon

**`cash_advance_entries`** — buku kasbon (ledger), satu baris per kejadian

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| tailor_id | uuid | FK |
| entry_type | cash_advance_entry_type | `opening_balance` (impor), `advance` (kasbon baru), `repayment` (cicilan), `write_off` (kerugian) |
| amount | bigint | > 0 |
| entry_on | date | |
| payroll_line_id | uuid | `advance` → saat ditransfer Sabtu; `repayment` → saat dipotong gajian; null = manual |
| notes | text | |
| import_batch_id | uuid | null kecuali dari impor |
| created_by | uuid | |
| created_at | timestamptz | |

Sisa kasbon = Σ(`opening_balance` + `advance`) − Σ(`repayment` + `write_off`),
tersedia di view `tailor_advance_balances`. Trigger menolak cicilan/kerugian
yang membuat sisa < 0. Baris tidak pernah diedit/dihapus; koreksi = entri baru.

### 4.6 Gajian

**`payroll_periods`**

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| starts_on | date | Senin |
| pay_on | date | **unik**, Sabtu (`starts_on + 5`) |
| status | payroll_period_status | `open → locked` |
| locked_at, locked_by | | |
| created_at | timestamptz | |

**`payroll_lines`** — satu baris per penjahit per periode

| Kolom | Tipe | Aturan |
| --- | --- | --- |
| id | uuid | PK |
| payroll_period_id | uuid | FK; unik bersama `tailor_id` |
| tailor_id | uuid | FK |
| gross_wage | bigint | Σ `wage_amount` kartu |
| advance_repayment | bigint | cicilan minggu ini (≤ sisa kasbon, ≤ gross) |
| deduction_total | bigint | Σ usulan potongan `deduct` |
| addition_total | bigint | Σ `payroll_additions` |
| new_advance_total | bigint | Σ kasbon baru yang ikut ditransfer |
| transfer_amount | bigint | generated: gross − cicilan − potongan + tambahan + kasbon baru (≥ 0) |
| account_provider, account_number, account_holder | text | **snapshot** rekening saat dikunci |
| status | payroll_line_status | `draft → paid` |
| paid_at, paid_by | | |
| created_at, updated_at | timestamptz | |

**`payroll_additions`** — `id`, `payroll_line_id`, `kind` (`thr`, `bonus`, `other`),
`amount` (> 0), `notes`, `created_by`, `created_at`.

### 4.7 Impor data lama

**`import_batches`** — `id`, `source` (import_source), `file_name`,
`file_sha256` (index → peringatan file sama diimpor ulang), `summary` (jsonb:
jumlah baris, dilewati, peringatan), `created_by`, `created_at`.

**`legacy_wage_records`** — riwayat upah mingguan dari `DATA_ANAK_JAIT.xlsx`:
`id`, `import_batch_id`, `tailor_id`, `pay_on`, `wage` (bigint), `created_at`;
unik (`tailor_id`, `pay_on`). Kasbon & bayar dari file yang sama masuk ke
`cash_advance_entries` (atau sebagai satu `opening_balance`, dipilih di wizard).

**`legacy_deposit_records`** — riwayat setoran dari `SETORAN_JAIT_*.xlsx`:
`id`, `import_batch_id`, `tailor_id`, `pay_on` (Sabtu minggu tsb, dipetakan
di wizard), `weekday` (1 = Senin … 6 = Sabtu), `wage_category`, `quantity`,
`unit_rate`, `created_at`; unik (`tailor_id`, `pay_on`, `weekday`, `wage_category`).

### 4.8 Pendukung

**`audit_logs`** — `id`, `table_name`, `record_id`, `action`
(`insert`/`update`/`delete`), `old_data` jsonb, `new_data` jsonb, `reason`,
`actor_id`, `created_at`. Trigger di tabel uang & kartu: `sewing_cards`,
`inspections`, `deduction_proposals`, `cash_advance_entries`, `payroll_*`,
`wage_rates`, `tailor_payment_accounts`.

**`idempotency_keys`** — `key` (uuid PK, dikirim klien per aksi), `profile_id`,
`operation`, `response` jsonb, `created_at`. Aksi yang sama dengan key yang
sama mengembalikan hasil pertama, bukan membuat data baru.

**`print_settings`** — `id`, `document_type` (unik: `sewing_card`,
`work_order_card`, `thp`, `transfer_list`), `offset_top_mm`, `offset_left_mm`,
`updated_at`.

## 5. View

| View | Isi |
| --- | --- |
| `tailor_advance_balances` | Sisa kasbon per penjahit |
| `outstanding_sewing_cards` | Kartu belum disetor, disetor belum selesai, dan sedang diperbaiki, + umur hari |
| `weekly_deposit_grid` | Per periode × penjahit × kategori × hari (Senin–Sabtu) — tampilan seperti sheet setoran lama |
| `work_order_progress` | Per WO: dipotong, dibagi, disetor, OK, rusak |
| `thp_rows` | Data THP per WO (penjahit, kode, jumlah, tgl ambil, hasil pemeriksaan) |

## 6. Fungsi transaksi (dipanggil dari Edge Function)

Semua perubahan status dilakukan oleh fungsi Postgres yang **mengunci baris**
(`select … for update`) dan memeriksa status, sehingga duplikat ditolak di
database, bukan hanya di layar. Error dikembalikan dengan kode yang jelas
(mis. `CARD_ALREADY_SUBMITTED` + waktu & pencatat sebelumnya) agar aplikasi
bisa menampilkan pemberitahuan sesuai PRD § 5.10.

| Fungsi | Tugas |
| --- | --- |
| `create_work_order(...)` | Buat WO + item; usulkan nomor unik |
| `record_cut_result(item_id, qty)` | Catat hasil potong |
| `issue_sewing_cards(...)` | Buat kartu; cek sisa hasil potong; peringatan jika penjahit masih pegang kartu / kartu serupa masih berjalan |
| `submit_sewing_card(number, on, incomplete, notes)` | Setor; tolak jika sudah disetor |
| `record_inspection(...)` | Catat pemeriksaan; buat usulan potongan jika ada rusak permanen |
| `decide_deduction(id, decision, notes)` | Catat keputusan owner |
| `record_cash_advance(...)` | Kasbon baru / cicilan manual / kerugian |
| `mark_card_collected(number)` | Scan pengumpulan Sabtu; tidak berefek jika sudah |
| `build_payroll(pay_on)` | Susun/ hitung ulang draft gajian periode |
| `lock_payroll(period_id)` | Kunci + snapshot rekening; tandai kartu `paid` |
| `mark_payroll_line_paid(line_id)` | Tandai sudah ditransfer; tolak jika sudah |
| `tailor_name_similarity(name)` | Daftar penjahit dengan nama mirip |

## 7. RLS & akses

- RLS aktif di semua tabel. Helper `current_app_role()` membaca `profiles.role`.
- **Fase 1**: `production_head` boleh `select` semua tabel; `insert/update`
  untuk master data. Tabel uang & kartu (`sewing_cards`, `inspections`,
  `deduction_proposals`, `cash_advance_entries`, `payroll_*`) **hanya bisa
  diubah lewat fungsi di § 6**, bukan `insert/update` langsung.
- `audit_logs`, `cash_advance_entries`: tidak ada `update`/`delete` untuk siapa pun.
- Fase 2: `finishing_head` → `record_inspection`, set kategori produk;
  `warehouse` → ACC; `owner` → baca semua + `decide_deduction`;
  `tailor` → baca data dirinya sendiri saja.

## 8. Asumsi yang perlu dikonfirmasi

1. **THR / bonus** — sheet ACUNG di `DATA_ANAK_JAIT.xlsx` punya kolom THR.
   Desain ini menampungnya sebagai `payroll_additions` (ikut ditransfer
   Sabtu). Betul THR dibayar lewat gajian mingguan?
2. **Setor di hari Minggu** (jika pernah terjadi) masuk periode Senin–Sabtu berikutnya.
3. **Nomor kartu** berformat `KJ-<TahunBulan>-<urut>` (mis. `KJ-2610-0042`).
