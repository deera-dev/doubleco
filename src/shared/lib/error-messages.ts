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
  FABRIC_COMBINATION_SAME: 'Bahan kombinasi tidak boleh sama dengan bahan utama.',
  IN_USE: 'Data ini sudah dipakai di transaksi, jadi tidak bisa dihapus. Nonaktifkan saja.',
  NOT_FOUND: 'Data tidak ditemukan. Muat ulang halaman.',
  TAILOR_CODE_TAKEN: 'Kode penjahit sudah dipakai penjahit lain.',
  TAILOR_NOT_ACTIVE: 'Penjahit tidak aktif.',
  RATE_ALREADY_ACTIVE: 'Tarif yang sudah berlaku tidak bisa dihapus. Tambahkan tarif baru.',
  WORK_ORDER_NUMBER_TAKEN: 'Nomor WO sudah dipakai.',
  PRODUCT_CATEGORY_MISSING: 'Kategori S/M/L produk ini belum diisi di Master Data.',
  WORK_ORDER_ITEMS_REQUIRED: 'Pilih minimal satu ukuran dan satu warna.',
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
