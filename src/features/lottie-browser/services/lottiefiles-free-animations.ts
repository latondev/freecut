export interface LottieFilesFreeSubCategory {
  id: string
  label: string
  query: string
}

export const LOTTIEFILES_FREE_SUB_CATEGORIES: readonly LottieFilesFreeSubCategory[] = [
  { id: 'all', label: 'Tất cả', query: '' },
  { id: 'youtube', label: 'YouTube', query: 'youtube' },
  { id: 'subscribe', label: 'Subscribe', query: 'subscribe' },
  { id: 'social', label: 'Mạng xã hội', query: 'social media' },
  { id: 'reaction', label: 'Biểu cảm & Tim', query: 'reaction' },
  { id: 'bell', label: 'Chuông thông báo', query: 'bell' },
  { id: 'loading', label: 'Tải trang', query: 'loading' },
  { id: 'success', label: 'Tích xanh', query: 'success' },
  { id: 'arrow', label: 'Mũi tên', query: 'arrow' },
  { id: 'confetti', label: 'Chúc mừng', query: 'confetti' },
  { id: 'business', label: 'Kinh doanh', query: 'business' },
  { id: 'shopping', label: 'Mua sắm', query: 'shopping' },
  { id: 'tech', label: 'Công nghệ', query: 'technology' },
  { id: 'food', label: 'Ẩm thực', query: 'food' },
] as const

export function getLottieFilesSubCategoryQuery(subCategoryId: string): string {
  const match = LOTTIEFILES_FREE_SUB_CATEGORIES.find((c) => c.id === subCategoryId)
  return match?.query ?? ''
}
