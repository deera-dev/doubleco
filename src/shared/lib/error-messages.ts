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
  DUPLICATE: 'Data dengan nama/kode yang sama sudah ada.',
  IN_USE: 'Data ini sudah dipakai di transaksi, jadi tidak bisa dihapus. Nonaktifkan saja.',
  NOT_FOUND: 'Data tidak ditemukan. Muat ulang halaman.',
  TAILOR_CODE_TAKEN: 'Kode penjahit sudah dipakai penjahit lain.',
  TAILOR_NOT_ACTIVE: 'Penjahit tidak aktif.',
  USE_MARK_TAILOR_LEFT: 'Gunakan tombol "Tandai keluar" untuk penjahit yang berhenti.',
  RATE_ALREADY_ACTIVE: 'Tarif yang sudah berlaku tidak bisa dihapus. Tambahkan tarif baru.',
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
