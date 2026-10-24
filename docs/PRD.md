# PRD — Aplikasi Produksi Gamis Maryam

| | |
| --- | --- |
| Status | Draft v1 — untuk dibahas |
| Pengguna utama | Kepala Produksi (fase 1) |
| Platform | Web app mobile-first (PWA), tetap nyaman di tablet & PC |
| Stack | Mengikuti `README.md` (Vite + React + TanStack + Supabase + Edge Function BFF) |

## 1. Latar belakang

Kepala Produksi brand **Maryam** setiap hari mengerjakan empat dokumen secara
manual di Excel dan kertas:

| Dokumen saat ini | Isi | Masalah |
| --- | --- | --- |
| **Kartu WO** (kertas 12×16 cm) | Tanggal, tukang potong, kode produk, size, bahan, ADA/TIDAK ADA PERUBAHAN, info lanjutan, foto sampel | Diketik ulang tiap WO; kode pola belum ada |
| **Kertas laporan anak jahit** (6×10 cm) | Tgl, T.Potong, Model, Jumlah, T.Jahit, Kode, Warna, TTD | Ditulis tangan per penjahit |
| **THP** (`CONT_THP.xlsx`) | Kode barang, tgl proses, tukang potong, bahan & kombinasi, size; per penjahit: kode, jumlah, tgl ambil; kolom finishing (selesai, diterima, OK/RUSAK, keterangan) dan ACC gudang | Data yang sama diketik ulang dari kartu |
| **Setoran jahit** (`SETORAN_JAIT_<BULAN>.xlsx`) | Per minggu: per penjahit × kategori S/M/L × hari (Senin–Sabtu), total, harga, kasbon | Tarif (S=20.000, M=25.000, L=30.000) di-hardcode di ratusan rumus; tidak ada jejak kode produk |
| **Data anak jahit** (`DATA_ANAK_JAIT.xlsx`) | 1 sheet per penjahit (±49): rekening/e-wallet, a.n., riwayat mingguan kasbon/upah/bayar | Saldo kasbon tidak dihitung; data tersebar di 49 sheet |

Contoh kesalahan input yang sudah terjadi di data nyata:

- Tanggal `20-06-2025` di tengah riwayat 2026 (sheet WAHYU).
- Nama pemilik rekening berbeda dari nama penjahit (ABENG → a.n. ASEP MULYANA,
  sementara ada penjahit lain bernama ASEP).
- Nama sangat mirip: DIDI/DINDI, BIDIN/JIDIN/SAHIDIN.

## 2. Tujuan

1. **Satu kali input, dipakai di semua dokumen.** Data WO → kartu jahit → THP →
   setoran → gajian mengalir otomatis tanpa diketik ulang.
2. **Scan, bukan tulis.** Setiap kartu punya QR; setoran dan pemeriksaan
   dicatat dengan scan dari kamera HP.
3. **Gajian Sabtu dihitung otomatis** — upah, kasbon, cicilan, daftar transfer.
4. **Cetak langsung** ke kertas yang sudah ada (6×10, 12×16, A4) di Epson L1250.

### Indikator keberhasilan

- Rekap gajian Sabtu selesai < 15 menit (dari kartu terkumpul sampai daftar transfer siap).
- 0 selisih hitung upah/kasbon dibanding pengecekan manual selama 4 minggu paralel.
- 100% kartu jahit dicetak dari aplikasi dan setorannya tercatat via scan.

### Di luar cakupan fase 1

- Upah tukang potong.
- Transfer otomatis ke bank/e-wallet (transfer tetap manual; aplikasi menyiapkan daftarnya).
- Login untuk penjahit, finishing, gudang, owner (disiapkan di model data, belum dibuka).

## 3. Pengguna & peran

| Peran | Fase 1 | Nanti |
| --- | --- | --- |
| Kepala Produksi | Semua fitur | — |
| Kepala Finishing | Diwakili Kepala Produksi | Set kategori S/M/L produk, input hasil pemeriksaan |
| Gudang | Diwakili Kepala Produksi | ACC barang masuk |
| Owner | — | Lihat dashboard & rekap gajian |
| Tukang Potong | Master data saja | Lapor hasil potong |
| Penjahit | Master data saja | Lihat slip gaji |

Model data dan otorisasi (Supabase RLS) dibuat berbasis peran sejak awal agar
membuka akses peran lain tidak perlu bongkar ulang.

## 4. Alur utama

```
[1] Master data
      │
[2] Buat WO ──► cetak Kartu WO (12×16) ──► Tukang Potong
      │
[3] Catat hasil potong per size × warna
      │
[4] Bagi ke penjahit ──► cetak Kartu Jahit (6×10, QR) per bagian
      │                  └─► THP terisi otomatis (cetak A4)
[5] Penjahit setor ──► scan kartu ──► Finishing periksa
      │                    ├─ OK
      │                    ├─ Rusak bisa diperbaiki ──► kembali ke penjahit yang sama
      │                    └─ Rusak permanen ──► mengurangi jumlah dibayar
[6] Sabtu: kartu dikumpulkan ──► rekap gajian ──► potong cicilan kasbon
      │
[7] Daftar transfer + export Excel ──► transfer manual ──► tandai dibayar
```

## 5. Kebutuhan fungsional

### 5.1 Master data

| Entitas | Field | Aturan |
| --- | --- | --- |
| Penjahit | **kode penjahit** (unik), nama, no. HP, status aktif/nonaktif, catatan | Kode adalah identitas utama di semua layar & cetakan, nama hanya label |
| Rekening penjahit | jenis (bank / e-wallet), penyedia (SeaBank, DANA, …), nomor, atas nama | Satu rekening aktif per penjahit; riwayat perubahan disimpan; peringatan jika a.n. ≠ nama penjahit |
| Tukang potong | nama, status | — |
| Produk | **kode produk** (mis. `W-133 BLS`), nama, **kategori kesulitan S/M/L**, foto sampel | Kategori wajib sebelum produk bisa dipakai di WO |
| Bahan | nama (mis. BLACK SWAN), daftar warna | Warna mengikuti bahan |
| Ukuran | nama (mis. MIDI) | Daftar dapat ditambah |
| Tarif upah | kategori, nominal, berlaku mulai | Tarif tidak pernah ditimpa — tarif baru = baris baru dengan tanggal berlaku |

### 5.2 Work Order (WO)

- Satu WO = **satu kode produk + satu bahan (dengan kombinasi)**; boleh **banyak
  ukuran** dan **banyak warna**.
- Field: nomor WO (otomatis), tanggal, tukang potong, produk, **kode pola**, bahan
  & kombinasi, ukuran[], warna[], status perubahan (`ADA PERUBAHAN` /
  `TIDAK ADA PERUBAHAN (IKUT SAMPEL)`), catatan perubahan, info lanjutan, foto
  sampel (default dari produk, bisa diganti / ditambah foto baru).
- Catatan perubahan diisi Kepala Produksi, contoh: "bentuk dada model B (sampel
  model A), list tetap".
- Status WO: `DRAFT → DIPOTONG → DIJAHIT → SELESAI` (+ `BATAL`), dihitung dari
  status kartu-kartunya.
- **Cetak Kartu WO 12×16 cm** dengan QR WO.

### 5.3 Hasil potong & pembagian ke penjahit

- Input jumlah hasil potong per **ukuran × warna**.
- Bagi ke penjahit: pilih penjahit (cari via kode/nama) + jumlah untuk tiap
  ukuran × warna. Sistem menolak pembagian melebihi hasil potong dan
  menampilkan sisa yang belum dibagi.
- Setiap bagian menjadi satu **Kartu Jahit** dengan nomor unik dan QR.
  Kategori dan tarif **disalin (snapshot)** ke kartu saat dibuat, agar
  perubahan tarif/kategori kemudian tidak mengubah upah kartu lama.
- **Cetak Kartu Jahit 6×10 cm**: Tgl, T.Potong, Model, Ukuran, Jumlah, T.Jahit,
  Kode, Warna, QR, nomor kartu, kolom TTD.
- Kartu hilang/rusak → cetak ulang dengan nomor & QR yang sama.

### 5.4 THP otomatis

- THP dibentuk otomatis per WO dari kartu-kartu jahitnya: header (kode barang,
  tgl proses, tukang potong, bahan & kombinasi, size), baris per penjahit
  (nama, kode, jumlah, tgl ambil), kolom finishing dan gudang terisi dari
  hasil pemeriksaan.
- **Cetak THP A4** (tata letak seperti `CONT_THP.xlsx`, ditambah QR WO), kolom
  TTD Produksi / Finishing / Gudang.
- Selama finishing & gudang belum login, THP cetak tetap dipakai sebagai
  dokumen serah terima fisik.

### 5.5 Setoran & pemeriksaan (scan)

- Tombol **Scan** selalu bisa dijangkau di layar HP. Scan QR kartu → buka kartu.
  Nomor kartu juga bisa diketik manual bila kamera gagal.
- Aksi pada kartu:
  - **Catat setor** (tanggal otomatis hari ini, bisa diubah).
  - **Catat pemeriksaan**: jumlah OK, rusak bisa diperbaiki, rusak permanen,
    keterangan. Jumlah ketiganya harus = jumlah yang disetor.
  - Rusak bisa diperbaiki → kartu kembali ke status `PERBAIKAN` di penjahit
    yang sama; saat disetor ulang, diperiksa ulang. Perbaikan tidak menambah upah.
  - Rusak permanen → mengurangi jumlah dibayar (10 potong, 1 rusak permanen → dibayar 9).
- Status kartu: `DIAMBIL → DISETOR → (PERBAIKAN → DISETOR) → SIAP_BAYAR → DIBAYAR` (+ `BATAL`).
- Daftar "masih di penjahit": kartu yang belum `SIAP_BAYAR`, dikelompokkan per
  penjahit, dengan umur kartu (hari sejak diambil).

### 5.6 Gajian mingguan (Sabtu)

- Periode gajian = **Senin–Sabtu**, dibayar **Sabtu**.
- Di hari Sabtu kartu dikumpulkan. Kepala Produksi scan tiap kartu untuk
  memastikan kartu fisik = data (kartu yang tidak di-scan ditandai).
- Upah per kartu = `(jumlah − rusak permanen) × tarif snapshot`.
- Rekap per penjahit:

  | Upah kotor | − Cicilan kasbon | = Dibayar |
  | --- | --- | --- |

  plus rincian per kartu dan tampilan **per hari × kategori S/M/L** seperti
  sheet setoran lama (agar mudah dicocokkan selama masa transisi).
- Cicilan kasbon diisi per penjahit per minggu (bebas sesuai kesepakatan);
  default = nominal minggu lalu. Validasi: tidak melebihi sisa kasbon dan
  tidak melebihi upah kotor.
- Keluaran:
  - **Daftar transfer**: kode, nama, penyedia, nomor rekening, a.n., nominal —
    bisa disalin per baris (nomor rekening & nominal sekali tap).
  - **Export Excel** dengan format mirip `SETORAN_JAIT` dan `DATA_ANAK_JAIT`.
- Setelah transfer manual, tiap baris ditandai **dibayar**. Periode yang sudah
  **dikunci** tidak bisa diubah; koreksi dicatat sebagai penyesuaian di periode
  berikutnya.

### 5.7 Kasbon

- Catat **kasbon baru** kapan saja: penjahit, tanggal, nominal, catatan.
- Catat **cicilan** (otomatis dari gajian, atau manual di luar gajian).
- Buku kasbon per penjahit: riwayat + **sisa kasbon** selalu terlihat.
- Daftar penjahit dengan kasbon berjalan beserta total sisanya.

### 5.8 Impor data lama

Wizard impor dengan **pratinjau dan validasi sebelum simpan**:

| Sumber | Yang diimpor |
| --- | --- |
| `DATA_ANAK_JAIT.xlsx` | Penjahit (nama dari nama sheet), rekening & a.n., riwayat mingguan upah/kasbon/bayar → **saldo kasbon awal** |
| `SETORAN_JAIT_<BULAN>.xlsx` | Riwayat setoran per minggu × hari × kategori (data lama tanpa kode produk, disimpan sebagai riwayat read-only) |

Validasi yang ditampilkan sebelum disimpan:

- Tanggal di luar urutan/tahun janggal (mis. 2025 di tengah 2026) atau bukan hari Sabtu.
- Nama penjahit mirip/duplikat; a.n. rekening ≠ nama.
- Penjahit tanpa rekening, baris kosong, angka tidak wajar.
- Kode penjahit belum ada → dipetakan manual di wizard.

### 5.9 Dashboard (ringkas)

- WO aktif & progresnya, kartu yang masih di penjahit, estimasi upah minggu
  berjalan, total kasbon berjalan, rasio rusak per produk/penjahit.

## 6. Kebutuhan cetak

Printer: **Epson L1250** (inkjet, Wi-Fi), kertas sudah dipotong sesuai ukuran.

| Dokumen | Ukuran | Isi utama |
| --- | --- | --- |
| Kartu WO | 120 × 160 mm | Logo, tanggal, tukang potong, kode produk, **kode pola**, ukuran, bahan, warna, status perubahan (merah = ada / biru = tidak), catatan, info lanjutan, foto sampel, QR |
| Kartu Jahit | 60 × 100 mm | "PRODUCTION", Tgl, T.Potong, Model, Ukuran, Jumlah, T.Jahit, Kode, Warna, QR, nomor kartu, TTD |
| THP | A4 | Seperti `CONT_THP.xlsx` + QR WO |
| Daftar transfer / rekap gajian | A4 | Tabel rekap |

- Dicetak dari browser dengan `@page { size: … }` per dokumen; tersedia
  **halaman tes cetak** dan pengaturan offset (geser atas/kiri dalam mm) untuk
  kalibrasi printer.
- Cetak massal: pilih banyak kartu → satu kali cetak (satu kartu per lembar).
- Dari HP via layanan cetak Android/iOS ke printer Wi-Fi; dari PC via dialog cetak biasa.

## 7. QR code

- Format QR (bukan barcode 1D): lebih andal dibaca kamera HP dan muat di 6×10.
- Isi QR hanya **ID kartu/WO** (mis. `KJ-2610-0042`), tanpa data pribadi;
  membuka data memerlukan login.
- Nomor yang sama dicetak sebagai teks untuk input manual.

## 8. Model data (ringkas)

```
penjahit ─< rekening_penjahit
penjahit ─< kasbon
penjahit ─< cicilan_kasbon >─ periode_gaji
produk ─< tarif (via kategori) ; tarif_upah(kategori, nominal, berlaku_mulai)
work_order >─ produk, bahan, tukang_potong
work_order ─< wo_hasil_potong (ukuran, warna, jumlah)
work_order ─< kartu_jahit >─ penjahit
kartu_jahit (ukuran, warna, jumlah, kategori_snapshot, tarif_snapshot, status)
kartu_jahit ─< setoran (tanggal, jumlah)
kartu_jahit ─< pemeriksaan (ok, rusak_perbaiki, rusak_permanen, keterangan)
periode_gaji ─< gaji_penjahit (upah_kotor, cicilan, dibayar, status_bayar)
gaji_penjahit ─< kartu_jahit (kartu yang dibayar di periode tsb)
riwayat_impor_legacy (data lama read-only)
audit_log (siapa, kapan, apa yang berubah)
```

## 9. Kebutuhan non-fungsional

- **Mobile-first**: nyaman di layar 360 px, target sentuh besar, bisa satu tangan;
  tetap rapi di tablet dan PC. Dapat dipasang sebagai PWA.
- **Bahasa Indonesia**, format Rupiah (`Rp 1.970.000`), zona waktu WIB.
- **Uang disimpan sebagai bilangan bulat Rupiah**, semua perhitungan di server (BFF), bukan di klien.
- **Keamanan**: data rekening dilindungi RLS; semua perubahan data uang tercatat di `audit_log`.
- **Kecepatan**: scan → kartu terbuka < 2 detik di koneksi 4G.
- **Koneksi buruk** (fase 2): antrean scan offline yang disinkronkan saat online.

## 10. Rencana rilis

| Fase | Isi |
| --- | --- |
| **1 — MVP** | Login Kepala Produksi, master data, WO + cetak kartu WO, hasil potong & kartu jahit + cetak, THP otomatis + cetak, scan setor & pemeriksaan, kasbon, gajian Sabtu + daftar transfer + export Excel, impor data lama |
| 2 | Login Kepala Finishing (set kategori, input pemeriksaan) & Gudang (ACC), dashboard lengkap, mode offline, slip gaji dibagikan via WhatsApp |
| 3 | Akses penjahit (slip & riwayat), upah tukang potong, laporan bulanan |

Saran transisi: jalankan aplikasi **paralel dengan Excel selama 2–4 minggu
gajian**, cocokkan hasilnya, baru tinggalkan Excel.

## 11. Pertanyaan terbuka

1. **Kartu yang belum selesai/belum diperiksa saat Sabtu** — otomatis masuk gajian minggu
   berikutnya? Atau boleh dibayar sebagian (yang sudah OK saja)?
2. **Kasbon baru** — diberikan tunai terpisah (hanya menambah saldo), atau ditambahkan
   ke transfer hari Sabtu?
3. **Kode penjahit** — apakah ada daftar resmi? `DATA_ANAK_JAIT.xlsx` tidak memuat
   kode, sementara THP memakai kode (ABENG = 29, IJAL = 4, …).
4. **Satu kartu jahit** = satu ukuran × satu warna? Atau satu kartu boleh berisi
   campuran ukuran/warna?
5. **Kategori S/M/L** diset Kepala Finishing — di fase 1 diwakili Kepala Produksi, betul?
6. **Penjahit keluar dengan sisa kasbon** — perlakuannya bagaimana (ditandai saja / dihapuskan)?
7. **Format nomor WO** yang diinginkan (mis. `WO-2610-001`)?
