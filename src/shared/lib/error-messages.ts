import type { AppError } from '@/shared/types/errors'

const businessMessages: Record<string, string> = {
  INVALID_INPUT: 'Data yang diisi belum lengkap atau tidak sesuai.',
  INVALID_CREDENTIALS: 'Username atau password salah.',
  ACTIVATION_INVALID:
    'Kode aktivasi tidak berlaku (sudah dipakai, kedaluwarsa, atau terlalu banyak percobaan). Minta kode baru.',
  ACTIVATION_CODE_WRONG: 'Kode aktivasi salah. Periksa lagi kodenya.',
  PASSWORD_UPDATE_FAILED: 'Password gagal disimpan. Coba lagi.',
  PROFILE_NOT_FOUND: 'Akun tidak ditemukan.',
  FORBIDDEN: 'Akun Anda tidak punya akses untuk tindakan ini.',
  DUPLICATE:
    'Data ini sudah ada. Beda huruf besar/kecil, spasi, atau tanda baca dianggap sama — pilih yang sudah ada.',
  FABRIC_CODE_TAKEN: 'Kode bahan sudah dipakai bahan lain. Ganti kode bahannya.',
  LABEL_REQUIRED: 'Ada isian yang masih kosong.',
  SERIES_REQUIRED: 'Pilih seri bahan.',
  SERIES_NOT_IN_FABRIC: 'Seri tidak sesuai dengan bahan.',
  WORK_ORDER_FABRIC_LOCKED:
    'Bahan dan seri tidak bisa diganti karena ukuran × warna sudah terpasang.',
  FABRIC_COMBINATION_SAME: 'Bahan kombinasi tidak boleh sama dengan bahan utama.',
  IN_USE: 'Data ini sudah dipakai di transaksi, jadi tidak bisa dihapus. Nonaktifkan saja.',
  NOT_FOUND: 'Data tidak ditemukan. Muat ulang halaman.',
  TAILOR_CODE_TAKEN: 'Kode penjahit sudah dipakai penjahit lain.',
  TAILOR_NOT_ACTIVE: 'Penjahit tidak aktif.',
  TAILOR_NOT_FOUND: 'Penjahit tidak ditemukan.',
  IMMUTABLE_RECORD: 'Catatan ini dibuat otomatis oleh gajian dan tidak bisa diubah.',
  CASH_ADVANCE_ENTRY_NOT_FOUND: 'Catatan kasbon tidak ditemukan.',
  INVALID_AMOUNT: 'Jumlah tidak valid.',
  PAY_DATE_NOT_SATURDAY: 'Tanggal gajian harus hari Sabtu.',
  PAYROLL_NOT_LOCKED: 'Gajian minggu ini belum dikunci.',
  PAYROLL_HAS_PAID_LINES: 'Sudah ada yang ditandai dibayar, gajian tidak bisa dibuka lagi.',
  PAYROLL_LINE_ALREADY_PAID: 'Sudah ditandai dibayar.',
  PAYROLL_LINE_NOT_FOUND: 'Baris gajian tidak ditemukan.',
  PAYROLL_ADDITION_NOT_FOUND: 'Tambahan gaji tidak ditemukan.',
  DEDUCTION_NOT_FOUND: 'Usulan potongan tidak ditemukan.',
  INVALID_DECISION: 'Pilih dipotong atau tidak dipotong.',
  TAILOR_REQUIRED: 'Pilih penjahit yang menyetor kartu ini.',
  RATE_ALREADY_ACTIVE: 'Tarif yang sudah berlaku tidak bisa dihapus. Tambahkan tarif baru.',
  WORK_ORDER_NUMBER_TAKEN: 'Nomor WO sudah dipakai.',
  PRODUCT_CATEGORY_MISSING: 'Kategori S/M/L produk ini belum diisi di Master Data.',
  WORK_ORDER_ITEMS_REQUIRED: 'Pilih minimal satu ukuran dan satu warna.',
  WORK_ORDER_SIZES_REQUIRED: 'Pilih minimal satu ukuran.',
  CUT_BELOW_ASSIGNED:
    'Hasil potong tidak boleh lebih kecil dari jumlah yang sudah dibagi ke penjahit.',
  WORK_ORDER_HAS_CARDS: 'WO ini sudah punya kartu jahit, jadi tidak bisa dihapus atau dibatalkan.',
  WORK_ORDER_ITEM_IN_USE: 'Ukuran/warna ini sudah punya kartu jahit.',
  WORK_ORDER_CLOSED: 'WO sudah selesai atau dibatalkan.',
  WORK_ORDER_NOT_FOUND: 'WO tidak ditemukan. Muat ulang halaman.',
  WORK_ORDER_PHOTO_INVALID: 'Foto belum terunggah dengan benar. Coba unggah lagi.',
  PHOTO_UNREADABLE: 'File ini tidak bisa dibaca sebagai foto. Pilih foto JPG, PNG, atau WEBP.',
  PHOTO_UPLOAD_FAILED: 'Foto gagal diunggah. Periksa koneksi lalu coba lagi.',
  PHOTO_STORAGE_FAILED: 'Penyimpanan foto sedang bermasalah. Coba lagi sebentar.',
  NOT_CUT_YET: 'Hasil potong ukuran/warna ini belum diisi. Isi hasil potong di halaman WO dulu.',
  QUANTITY_EXCEEDS_CUT: 'Jumlah melebihi sisa hasil potong yang belum dibagi.',
  CARDS_REQUIRED: 'Tambahkan minimal satu kartu.',
  WORK_ORDER_CANCELLED: 'WO ini sudah dibatalkan.',
  WAGE_RATE_MISSING: 'Tarif upah untuk kategori ini belum diisi di Master Data.',
  CARD_NOT_EDITABLE: 'Kartu yang sudah disetor tidak bisa diubah.',
  CARD_CANNOT_BE_CANCELLED: 'Hanya kartu yang masih di penjahit yang bisa dibatalkan.',
  CARD_NOT_FOUND: 'Nomor kartu tidak ditemukan.',
  CARD_ALREADY_SUBMITTED: 'Kartu ini sudah disetor.',
  CARD_CANCELLED: 'Kartu ini sudah dibatalkan, jangan dipakai.',
  CARD_NOT_SUBMITTED: 'Kartu ini belum disetor.',
  INSPECTION_ALREADY_DONE: 'Kartu ini sudah selesai diperiksa.',
  INSPECTION_EXCEEDS_QUANTITY: 'Jumlah pemeriksaan melebihi sisa yang belum diperiksa.',
  INSPECTION_NOT_FOUND: 'Belum ada pemeriksaan untuk kartu ini.',
  DEDUCTION_ALREADY_APPLIED: 'Potongan ini sudah masuk gajian yang dikunci.',
  CARD_ALREADY_INSPECTED: 'Kartu sudah diperiksa, setorannya tidak bisa dibatalkan.',
  PAYROLL_LOCKED: 'Gajian minggu itu sudah dikunci.',
  SUBMITTED_BEFORE_TAKEN: 'Tanggal setor tidak boleh sebelum tanggal ambil.',
  REMAINING_NOTES_REQUIRED: 'Tulis sisa pekerjaan yang belum selesai.',
  COLOR_NOT_IN_FABRIC: 'Warna tidak sesuai dengan bahan WO.',
  REASON_REQUIRED: 'Alasan wajib diisi.',
  CONFIRMATION_REQUIRED: 'Ada data serupa yang perlu dikonfirmasi.',
  UNKNOWN_ACTION: 'Versi aplikasi tidak cocok dengan server. Muat ulang halaman.',
}

export function describeError(error: AppError): string {
  switch (error.kind) {
    case 'network':
      return 'Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.'
    case 'unauthorized':
      return 'Sesi Anda berakhir. Silakan masuk lagi.'
    case 'business':
      return businessMessages[error.code] ?? 'Permintaan ditolak oleh server.'
    case 'not_found':
      return 'Data tidak ditemukan.'
    case 'validation':
      return 'Data dari server tidak sesuai. Coba muat ulang halaman.'
    case 'unknown':
      return 'Terjadi kesalahan. Coba lagi.'
  }
}
