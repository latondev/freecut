import iconScoutCatalog from '../data/iconscout-free-lotties.json'
import type { LottieFilesAnimation, LottiePage } from './lottiefiles-api'

interface IconScoutCatalogItem {
  id: string
  name: string
  gifUrl: string
  pageUrl: string
  author: string
  license: string
  category: string
  lottieUrl: string
}

const ITEMS: IconScoutCatalogItem[] = iconScoutCatalog as IconScoutCatalogItem[]

export const ICONSCOUNT_SUB_CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'social', label: 'Social & YouTube' },
  { id: 'business', label: 'Business' },
  { id: 'tech', label: 'Tech & Rocket' },
  { id: 'success', label: 'Success & Done' },
  { id: 'loading', label: 'Loaders' },
  { id: 'celebration', label: 'Celebration' },
] as const

type IconScoutSubCategory = (typeof ICONSCOUNT_SUB_CATEGORIES)[number]['id']

export function fetchIconScoutFreeAnimations(params: {
  query?: string
  subCategory?: IconScoutSubCategory | string
  offset?: number
  limit?: number
}): LottiePage {
  const query = (params.query ?? '').trim().toLowerCase()
  const subCategory = params.subCategory ?? 'all'
  const offset = Math.max(0, params.offset ?? 0)
  const limit = Math.max(1, params.limit ?? 24)

  let filtered = ITEMS

  if (subCategory && subCategory !== 'all') {
    filtered = filtered.filter((it) => it.category === subCategory)
  }

  if (query.length > 0) {
    filtered = filtered.filter(
      (it) =>
        it.name.toLowerCase().includes(query) ||
        it.author.toLowerCase().includes(query) ||
        it.category.toLowerCase().includes(query),
    )
  }

  const totalCount = filtered.length
  const pageSlice = filtered.slice(offset, offset + limit)

  const items: LottieFilesAnimation[] = pageSlice.map((it) => ({
    id: it.id,
    name: it.name,
    lottieUrl: it.lottieUrl,
    gifUrl: it.gifUrl,
    bgColor: '#18181b',
    author: it.author,
    authorPath: it.pageUrl,
    provider: 'IconScout',
    pageUrl: it.pageUrl,
  }))

  const hasNextPage = offset + limit < totalCount
  const endCursor = hasNextPage ? btoa(`arrayconnection:${offset + limit - 1}`) : null

  return {
    items,
    totalCount,
    hasNextPage,
    endCursor,
  }
}
