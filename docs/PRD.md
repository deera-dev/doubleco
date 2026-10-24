# PRD — Aplikasi Produksi Gamis Maryam

| | |
| --- | --- |
| Status | Draft v3 — keputusan putaran 1–3 + aturan anti-duplikasi |
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
[6] Sabtu: kartu yang sudah disetor dikumpulkan ──► rekap gajian ──► − cicilan kasbon + kasbon baru
      │
[7] Daftar transfer + export Excel ──► transfer manual ──► tandai dibayar
```

## 5. Kebutuhan fungsional

### 5.1 Master data

| Entitas | Field | Aturan |
| --- | --- | --- |
| Penjahit | **kode penjahit** (unik), nama, no. HP, status aktif/keluar, catatan | Kode adalah identitas utama di semua layar & cetakan, nama hanya label. Belum ada daftar kode resmi: Kepala Produksi menginput kode tiap penjahit satu kali (saat impor atau tambah penjahit) |
| Rekening penjahit | jenis (bank / e-wallet), penyedia (SeaBank, DANA, …), nomor, atas nama | Satu rekening aktif per penjahit; riwayat perubahan disimpan; peringatan jika a.n. ≠ nama penjahit |
| Tukang potong | nama, status | — |
| Produk | **kode produk** (mis. `W-133 BLS`), nama, **kategori kesulitan S/M/L**, foto sampel | Kategori wajib sebelum produk bisa dipakai di WO. Fase 1 diisi Kepala Produksi; fase 2 Kepala Finishing |
| Bahan | nama (mis. BLACK SWAN), daftar warna | Warna mengikuti bahan |
| Ukuran | nama (mis. MIDI) | Daftar dapat ditambah |
| Tarif upah | kategori, nominal, berlaku mulai | Tarif tidak pernah ditimpa — tarif baru = baris baru dengan tanggal berlaku |

### 5.2 Work Order (WO)

- Satu WO = **satu kode produk + satu bahan (dengan kombinasi)**; boleh **banyak
  ukuran** dan **banyak warna**.
- Field: nomor WO, tanggal, tukang potong, produk, **kode pola**, bahan
  & kombinasi, ukuran[], warna[], status perubahan (`ADA PERUBAHAN` /
  `TIDAK ADA PERUBAHAN (IKUT SAMPEL)`), catatan perubahan, info lanjutan, foto
  sampel (default dari produk, bisa diganti / ditambah foto baru).
- **Nomor WO**: default `WO_<kode_produk>` (mis. `WO_W-133 BLS`), bisa diedit
  Kepala Produksi. Nomor harus unik; jika produk yang sama sudah pernah punya
  WO, sistem mengusulkan akhiran (`WO_W-133 BLS_2`) yang tetap bisa diedit.
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
  **Satu kartu = satu ukuran × satu warna**, tidak boleh campuran.
- Penjahit mengambil kartu baru setelah kartu sebelumnya selesai. Jika penjahit
  masih memegang kartu yang belum disetor, sistem menampilkan peringatan dan
  meminta konfirmasi Kepala Produksi sebelum kartu baru dibuat.
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
  - **Catat setor** (tanggal otomatis hari ini, bisa diubah). Kartu boleh
    disetor **walaupun belum 100% selesai** bila disepakati Kepala Produksi
    dengan penjahit; tandai "belum selesai" + catatan sisa pekerjaan. Kartu
    tetap **dibayar penuh** sesuai jumlah di kartu, dan sisa produk tetap
    wajib diserahkan — aplikasi memantaunya sampai lunas diserahkan.
  - **Catat pemeriksaan** (boleh sebelum atau sesudah gajian): jumlah OK, rusak
    bisa diperbaiki, rusak permanen, keterangan.
  - Rusak bisa diperbaiki → dikembalikan ke penjahit yang sama untuk
    diperbaiki, lalu diperiksa ulang. Perbaikan tidak menambah upah.
  - Rusak permanen → kartu **tetap dibayar penuh** lebih dulu. Rusak permanen
    dicatat sebagai **usulan potongan** (jumlah × tarif kartu) yang menunggu
    **keputusan owner**: `DIPOTONG` (masuk gajian berikutnya) atau
    `TIDAK DIPOTONG`. Fase 1: Kepala Produksi mencatat keputusan owner beserta
    catatannya; fase 2 owner memutuskan langsung di aplikasi.
- Status kartu: `DIAMBIL → DISETOR → DIBAYAR` (+ `BATAL`). Status pemeriksaan
  terpisah: `BELUM DIPERIKSA → PERBAIKAN → SELESAI DIPERIKSA`.
- Daftar "masih di penjahit": kartu yang belum disetor, kartu disetor belum
  selesai, dan potongan yang sedang diperbaiki — dikelompokkan per penjahit,
  dengan umur kartu (hari sejak diambil).

### 5.6 Gajian mingguan (Sabtu)

- Periode gajian = **Senin–Sabtu**, dibayar **Sabtu**.
- **Yang dibayar = kartu yang sudah disetor** sampai Sabtu dan belum pernah
  dibayar, termasuk kartu yang belum diperiksa atau disetor belum 100% selesai
  atas kesepakatan. Kartu yang belum disetor otomatis menunggu gajian minggu
  berikutnya.
- Di hari Sabtu kartu dikumpulkan. Kepala Produksi scan tiap kartu untuk
  memastikan kartu fisik = data (kartu yang tidak di-scan ditandai).
- Upah per kartu = `jumlah kartu × tarif snapshot` (selalu penuh).
- Rekap per penjahit:

  | Upah kotor | − Cicilan kasbon | − Potongan rusak permanen (yang sudah diputuskan owner `DIPOTONG`) | + Kasbon baru minggu ini | = Ditransfer |
  | --- | --- | --- | --- | --- |

  plus rincian per kartu dan tampilan **per hari × kategori S/M/L** seperti
  sheet setoran lama (agar mudah dicocokkan selama masa transisi).
- Cicilan kasbon diisi per penjahit per minggu (bebas sesuai kesepakatan);
  default = nominal minggu lalu. Validasi: tidak melebihi sisa kasbon dan
  tidak melebihi upah kotor.
- Kasbon baru yang diajukan selama minggu berjalan **ditransfer bersamaan**
  dengan upah hari Sabtu.
- Keluaran:
  - **Daftar transfer**: kode, nama, penyedia, nomor rekening, a.n., nominal
    (upah bersih + kasbon baru, dengan rinciannya) — bisa disalin per baris
    (nomor rekening & nominal sekali tap).
  - **Export Excel** dengan format mirip `SETORAN_JAIT` dan `DATA_ANAK_JAIT`.
- Setelah transfer manual, tiap baris ditandai **dibayar**. Periode yang sudah
  **dikunci** tidak bisa diubah; koreksi dicatat sebagai penyesuaian di periode
  berikutnya.

### 5.7 Kasbon

- Catat **kasbon baru** kapan saja selama minggu berjalan: penjahit, tanggal,
  nominal, catatan. Kasbon dicairkan lewat transfer Sabtu (lihat 5.6).
- Catat **cicilan** (otomatis dari gajian, atau manual di luar gajian).
- Buku kasbon per penjahit: riwayat + **sisa kasbon** selalu terlihat.
- Daftar penjahit dengan kasbon berjalan beserta total sisanya.
- Penjahit **keluar** dengan kasbon belum lunas → sisa kasbon dicatat sebagai
  **kerugian** (hapus buku) dengan tanggal & catatan; total kerugian kasbon
  tampil di laporan. Penjahit keluar tidak bisa diberi kartu atau kasbon baru.

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
- Kode penjahit belum ada di file → **wajib diisi** Kepala Produksi untuk tiap penjahit di wizard (sekali saja).

### 5.9 Dashboard (ringkas)

- WO aktif & progresnya, kartu yang masih di penjahit, estimasi upah minggu
  berjalan, total kasbon berjalan, rasio rusak per produk/penjahit.

### 5.10 Pencegahan duplikasi

Prinsip: **data tidak pernah tercatat dua kali tanpa sepengetahuan pengguna.**
Ada dua tingkat pemberitahuan:

- **Blokir** — aksi ditolak karena pasti salah; layar menjelaskan data yang
  sudah ada (kapan, oleh siapa) dan tombol untuk membukanya.
- **Peringatan** — aksi mungkin sah; pengguna harus menekan konfirmasi dan
  bisa menambah catatan alasan (tercatat di `audit_log`).

Saat scan, hasil duplikat memakai warna, getar, dan bunyi yang berbeda dari
scan sukses sehingga langsung terasa tanpa membaca layar.

| Situasi | Tingkat | Pemberitahuan |
| --- | --- | --- |
| Scan setor kartu yang sudah disetor | Blokir | "Kartu KJ-… sudah disetor Senin 26/10 14:02" |
| Scan pengumpulan Sabtu untuk kartu yang sudah di-scan | Blokir (tanpa efek) | "Sudah di-scan pukul 09:15" |
| Kartu masuk gajian yang sudah dibayar | Blokir | Kartu tidak bisa masuk periode lain |
| Pemeriksaan / usulan potongan kedua untuk potongan yang sama | Blokir | Jumlah OK + rusak tidak boleh melebihi jumlah kartu |
| Pembagian melebihi hasil potong | Blokir | Tampilkan sisa yang tersedia |
| Kode penjahit, kode produk, atau nomor WO sudah dipakai | Blokir | Tampilkan data pemiliknya |
| Kartu baru dengan WO + penjahit + ukuran + warna yang sama dengan kartu yang masih berjalan | Peringatan | Tampilkan kartu yang sudah ada |
| Penjahit masih memegang kartu belum disetor | Peringatan | Lihat 5.3 |
| Nama penjahit sama/mirip (DIDI/DINDI) | Peringatan | Tampilkan penjahit yang mirip + kodenya |
| Nomor rekening sudah dipakai penjahit lain | Peringatan | Tampilkan pemiliknya |
| Kasbon dengan penjahit + nominal + tanggal yang sama | Peringatan | Tampilkan kasbon sebelumnya |
| WO dengan produk + bahan + ukuran yang sama masih aktif | Peringatan | Tampilkan WO yang aktif |
| Impor file yang sama / baris yang sudah pernah diimpor | Peringatan | Baris duplikat dilewati, ditampilkan di ringkasan pratinjau |
| Tandai "dibayar" / kunci periode yang sudah diproses | Blokir | Tampilkan waktu proses sebelumnya |

Jaminan teknis (bukan hanya tampilan):

- Constraint unik di database untuk kode penjahit, kode produk, nomor WO,
  nomor kartu, satu setoran per kartu, dan satu kartu per periode gajian.
- Setiap aksi tulis membawa **idempotency key**, sehingga tap ganda atau kirim
  ulang saat sinyal putus tidak membuat data ganda; tombol simpan nonaktif
  selama proses.
- Siap untuk banyak pengguna (fase 2): pemeriksaan versi data mencegah dua
  perangkat menimpa perubahan satu sama lain.

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
kartu_jahit (ukuran, warna, jumlah, kategori_snapshot, tarif_snapshot, status, status_pemeriksaan)
kartu_jahit ─< setoran (tanggal, belum_selesai, catatan_sisa)
kartu_jahit ─< pemeriksaan (ok, rusak_perbaiki, rusak_permanen, keterangan)
pemeriksaan ─< usulan_potongan (nominal, keputusan_owner, catatan, periode_potong)
periode_gaji ─< gaji_penjahit (upah_kotor, cicilan, potongan, kasbon_baru, ditransfer, status_bayar)
kasbon (…, status: aktif / lunas / kerugian)
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

## 11. Keputusan yang sudah disepakati

| Topik | Keputusan |
| --- | --- |
| Kategori S/M/L | Tingkat kesulitan model, melekat di kode produk; fase 1 diisi Kepala Produksi |
| Upah | Dihitung & dibayar Sabtu dari kartu yang sudah disetor; kartu dibayar penuh (termasuk yang disetor belum 100% selesai); potongan rusak permanen diputuskan owner; rusak yang bisa diperbaiki kembali ke penjahit yang sama |
| Kartu belum selesai | Boleh disetor atas kesepakatan; dibayar penuh, sisa produk tetap wajib diserahkan |
| Duplikasi | Setiap aksi ganda (scan, input, impor) memunculkan pemberitahuan; lihat 5.10 |
| Kasbon | Pinjaman baru ditransfer bersama upah Sabtu; cicilan bebas sesuai kesepakatan; sisa kasbon penjahit keluar = kerugian |
| Kode penjahit | Diinput satu kali oleh Kepala Produksi |
| Kartu jahit | Satu ukuran × satu warna; kartu baru setelah kartu sebelumnya selesai |
| WO | Satu kode produk + satu bahan, banyak ukuran & warna; nomor default `WO_<kode_produk>`, bisa diedit |
| Pengguna | Fase 1 hanya Kepala Produksi |
| Printer | Epson L1250, kertas 6×10, 12×16, A4 |
| Data lama | Diimpor lewat wizard |
| Transfer | Manual; aplikasi menyiapkan daftar |

## 12. Pertanyaan terbuka

Belum ada. Pertanyaan baru dicatat di sini saat desain database & tampilan.
