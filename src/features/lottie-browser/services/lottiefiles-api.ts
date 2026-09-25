/**
 * Minimal client for the public LottieFiles GraphQL API.
 *
 * The endpoint is token-free and serves `Access-Control-Allow-Origin: *` on
 * both the API and its asset CDN (`assets-v2.lottiefiles.com`), so the browser
 * can query and download animations directly — no backend proxy required.
 *
 * Only the small slice of the schema this feature needs is modelled here.
 */

import type { MediaAttribution } from '@/types/storage'
import { fetchIconScoutFreeAnimations } from './iconscout-free-lottie'

const ENDPOINT = 'https://graphql.lottiefiles.com/2022-08'

/** Free LottieFiles animations are distributed under this license. */
export const LOTTIEFILES_LICENSE = 'Lottie Simple License (FL 9.13.21)'

/** Browse feeds (used when there is no active search query). */
export type LottieBrowseCategory =
  | 'featured'
  | 'popular'
  | 'recent'
  | 'free-animations'
  | 'free-lottie'

export interface LottieFilesAnimation {
  id: string
  name: string
  /** Direct `.lottie` archive URL — what we import. */
  lottieUrl: string
  /** Animated GIF preview URL for the grid thumbnail (may be null). */
  gifUrl: string | null
  /** Suggested background color for the preview cell (may be null). */
  bgColor: string | null
  /** Creator display name (may be null). */
  author: string | null
  /** Creator profile path, e.g. "/animoox" (may be null). */
  authorPath: string | null
  /** Optional provider source (e.g. 'IconScout' or 'LottieFiles') */
  provider?: string
  /** Optional original asset page link */
  pageUrl?: string
}

export interface LottiePage {
  items: LottieFilesAnimation[]
  endCursor: string | null
  hasNextPage: boolean
  totalCount: number
}

interface RawNode {
  id: number | string
  name: string | null
  lottieUrl: string | null
  gifUrl: string | null
  bgColor: string | null
  createdBy: { name: string | null; username: string | null } | null
}

interface RawConnection {
  totalCount?: number
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  edges: Array<{ node: RawNode }>
}

const NODE_FIELDS = `
  id
  name
  lottieUrl
  gifUrl
  bgColor
  createdBy { name username }
`

/**
 * Cursor for a 0-based item offset. LottieFiles' list connections use the
 * graphql-relay `arrayconnection:<index>` scheme, so a cursor can be built for
 * any offset — enabling direct page jumps, not just next/prev. `after` is
 * exclusive, so to start a page at offset N pass `offsetToCursor(N - 1)`.
 */
export function offsetToCursor(offset: number): string {
  return btoa(`arrayconnection:${offset}`)
}

function rootField(category: LottieBrowseCategory, isSearch: boolean): string {
  if (isSearch) return 'searchPublicAnimations'
  if (category === 'popular') return 'popularPublicAnimations'
  if (category === 'recent') return 'recentPublicAnimations'
  return 'featuredPublicAnimations'
}

function buildQuery(field: string, isSearch: boolean): string {
  const varDefs = isSearch
    ? '($first: Int!, $after: String, $query: String!)'
    : '($first: Int!, $after: String)'
  const args = isSearch
    ? 'query: $query, first: $first, after: $after'
    : 'first: $first, after: $after'
  return `query LottieBrowse${varDefs} {
    ${field}(${args}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { node { ${NODE_FIELDS} } }
    }
  }`
}

function mapNode(node: RawNode): LottieFilesAnimation | null {
  // The `.lottie` URL is what we import — skip entries without one.
  if (!node.lottieUrl) return null
  return {
    id: String(node.id),
    name: node.name?.trim() || 'Untitled',
    lottieUrl: node.lottieUrl,
    gifUrl: node.gifUrl ?? null,
    bgColor: node.bgColor ?? null,
    author: node.createdBy?.name?.trim() || null,
    authorPath: node.createdBy?.username ?? null,
    provider: 'LottieFiles',
    pageUrl: `https://lottiefiles.com/free-animation/${node.id}`,
  }
}

/**
 * Fetch one page of public animations — a search result when `query` is
 * non-empty, otherwise the selected browse feed. Pass `after` (an `endCursor`
 * from a previous page) to paginate.
 */

// fallow-ignore-next-line complexity
export async function fetchLottieAnimations(params: {
  category: LottieBrowseCategory
  query?: string
  after?: string | null
  first?: number
  signal?: AbortSignal
}): Promise<LottiePage> {
  if (params.category === 'free-lottie') {
    let offset = 0
    if (params.after) {
      try {
        const decoded = atob(params.after)
        const match = decoded.match(/arrayconnection:(\d+)/)
        if (match && match[1]) {
          offset = parseInt(match[1], 10) + 1
        }
      } catch {}
    }
    return fetchIconScoutFreeAnimations({
      query: params.query,
      offset,
      limit: params.first ?? 24,
    })
  }

  const trimmed = params.query?.trim() ?? ''
  const isSearch = trimmed.length > 0
  const field = rootField(params.category, isSearch)

  const variables: Record<string, unknown> = {
    first: params.first ?? 30,
    after: params.after ?? null,
  }
  if (isSearch) variables.query = trimmed

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: buildQuery(field, isSearch), variables }),
    signal: params.signal,
  })

  if (!response.ok) {
    throw new Error(`LottieFiles request failed (${response.status})`)
  }

  const json = (await response.json()) as {
    data?: Record<string, RawConnection | null | undefined>
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? 'LottieFiles returned an error')
  }

  const connection = json.data?.[field]
  if (!connection) {
    return { items: [], endCursor: null, hasNextPage: false, totalCount: 0 }
  }

  const items = connection.edges
    .map((edge) => mapNode(edge.node))
    .filter((node): node is LottieFilesAnimation => node !== null)

  return {
    items,
    endCursor: connection.pageInfo.endCursor,
    hasNextPage: connection.pageInfo.hasNextPage,
    totalCount: connection.totalCount ?? items.length,
  }
}

/**
 * Build the attribution/license record persisted with an imported animation.
 * The creator profile link is reliably reconstructable from `authorPath`; we
 * omit a per-animation source URL rather than fabricate one that may 404.
 */
export function buildLottieAttribution(animation: LottieFilesAnimation): MediaAttribution {
  if (animation.provider === 'IconScout' || animation.id.startsWith('iconscout-')) {
    return {
      provider: 'IconScout',
      author: animation.author ?? undefined,
      authorUrl: animation.pageUrl ?? undefined,
      sourceUrl: animation.pageUrl ?? undefined,
      sourceId: animation.id,
      license: 'IconScout Free License',
    }
  }

  return {
    provider: 'LottieFiles',
    author: animation.author ?? undefined,
    authorUrl: animation.authorPath ? `https://lottiefiles.com${animation.authorPath}` : undefined,
    sourceId: animation.id,
    license: LOTTIEFILES_LICENSE,
  }
}
