import type { AudioGenVoice } from '../services/audio-gen-voices-service'

type KeywordRule = readonly [
  code: string,
  keywords: readonly string[],
  wordTokens?: readonly string[],
]

// Keyword tables: [code, substring keywords, whole-word tokens]
const COUNTRY_RULES: readonly KeywordRule[] = [
  ['vn', ['vietnam', 'tiếng việt'], ['vi']],
  ['gb', ['welsh', 'wales'], ['cy']],
  ['us', ['american', 'united states', 'en-us', '(us)'], ['us']],
  ['gb', ['british', 'united kingdom', 'scottish', 'en-gb', '(uk)'], ['uk']],
  ['au', ['australi']],
  ['cn', ['chines', 'mandarin', 'cantonese', 'trung']],
  ['jp', ['japan', 'nhật']],
  ['kr', ['korean', 'hàn']],
  ['fr', ['french', 'pháp']],
  ['de', ['german', 'đức']],
  ['es', ['spanish', 'tây ban nha']],
  ['ru', ['russian', 'nga']],
  ['it', ['italian', 'ý']],
  ['pt', ['portuguese', 'brazil']],
  ['sa', ['arabic', 'ả rập']],
  ['in', ['hindi', 'indian', 'ấn độ']],
  ['th', ['thai', 'thái']],
  ['id', ['indonesia', 'malay']],
  ['ie', ['irish', 'ireland']],
  ['ca', ['canad']],
  ['mx', ['mexic']],
  ['sg', ['singapore']],
  ['pl', ['polish']],
  ['nl', ['dutch']],
  ['se', ['swedish']],
  ['tr', ['turkish']],
  ['ph', ['filipino', 'tagalog']],
  ['gr', ['greek']],
  ['cz', ['czech']],
  ['ua', ['ukrain']],
  ['il', ['hebrew']],
]

// Fallback by ISO-ish language field when no keyword matched
const LANGUAGE_FALLBACK: readonly (readonly [string, string])[] = [
  ['vi', 'vn'],
  ['en', 'us'],
  ['zh', 'cn'],
  ['ja', 'jp'],
  ['ko', 'kr'],
]

// Languages the filter dropdown handles by code: [code, normalized name, keywords]
const LANGUAGE_RULES: Record<string, { name: string; keywords: readonly string[] }> = {
  vi: { name: 'vietnamese', keywords: ['vietnam', 'tiếng việt'] },
  en: { name: 'english', keywords: ['english', 'american', 'british', 'australi'] },
  zh: { name: 'chinese', keywords: ['chinese', 'mandarin', 'cantonese', 'trung'] },
  ja: { name: 'japanese', keywords: ['japanese', 'nhật'] },
  ko: { name: 'korean', keywords: ['korean', 'hàn'] },
  fr: { name: 'french', keywords: ['french', 'pháp'] },
  de: { name: 'german', keywords: ['german', 'đức'] },
  es: { name: 'spanish', keywords: ['spanish', 'tây ban nha'] },
  ru: { name: 'russian', keywords: ['russian', 'nga'] },
  it: { name: 'italian', keywords: ['italian', 'ý'] },
  pt: { name: 'portuguese', keywords: ['portuguese', 'brazil'] },
  cy: { name: 'welsh', keywords: ['welsh'] },
}

const QUALITY_KEYWORDS: Record<string, readonly string[]> = {
  studio_hd: ['studio', 'hd'],
  ultra_realistic: ['ultra', 'realistic'],
  standard: ['standard'],
}

const AGE_KEYWORDS: Record<string, readonly string[]> = {
  young: ['young', 'trẻ', 'child'],
  middle_aged: ['middle', 'adult', 'trung niên'],
  old: ['old', 'senior', 'già', 'cao tuổi'],
}

const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  story: ['narrat', 'story', 'tường thuật', 'kể', 'audiobook', 'novel'],
  conversational: ['convers', 'hội thoại', 'chat', 'trò chuyện', 'podcast'],
  animation: ['charact', 'nhân vật', 'animat', 'hoạt hình', 'anime', 'game'],
  social_media: ['social', 'mạng xã hội', 'stream', 'reels', 'tiktok', 'youtube'],
  entertainment: ['entertain', 'giải trí', 'tv', 'movie', 'cinema', 'drama'],
  commercial: ['commercial', 'quảng cáo', 'promo', 'advert', 'brand'],
  education: ['educat', 'giáo dục', 'inform', 'thông tin', 'instruct', 'news', 'bản tin'],
}

const FEMALE_WORDS = ['female', 'nữ', 'woman', 'girl']
const MALE_WORDS = ['male', 'nam', 'man', 'boy']

const ACCENT_RULES: readonly (readonly [label: string, keywords: readonly string[]])[] = [
  ['American', ['american', 'us']],
  ['British', ['british', 'uk']],
  ['Welsh', ['welsh', 'wales']],
  ['Australian', ['australi']],
  ['Vietnamese', ['vietnam']],
  ['Chinese', ['chinese']],
  ['Japanese', ['japanese']],
  ['Korean', ['korean']],
]

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((k) => text.includes(k))
}

function hasWord(text: string, token: string): boolean {
  return new RegExp(`\\b${token}\\b`).test(text)
}

function voiceText(voice: AudioGenVoice, withMeta: boolean): string {
  const meta = withMeta ? `${voice.language || ''} ${voice.accent || ''} ` : ''
  return `${meta}${(voice.tags || []).join(' ')} ${voice.description || ''} ${voice.label}`.toLowerCase()
}

function normalizeLanguageTag(lang?: string): string {
  if (!lang) return ''
  const lower = lang.toLowerCase().trim()
  for (const [code, rule] of Object.entries(LANGUAGE_RULES)) {
    if (lower === code || includesAny(lower, rule.keywords)) return rule.name
  }
  return lower
}

function normalizeGenderTag(gender?: string): string {
  if (!gender) return ''
  const lower = gender.toLowerCase().trim()
  if (includesAny(lower, FEMALE_WORDS)) return 'female'
  if (includesAny(lower, MALE_WORDS)) return 'male'
  return 'other'
}

export function getVoiceCountryCodes(voice: AudioGenVoice): string[] {
  const text = voiceText(voice, true)
  const codes = new Set<string>()

  for (const [code, keywords, tokens = []] of COUNTRY_RULES) {
    if (includesAny(text, keywords) || tokens.some((t) => hasWord(text, t))) codes.add(code)
  }

  if (codes.size === 0 && (text.includes('english') || hasWord(text, 'en'))) codes.add('us')

  if (codes.size === 0) {
    const lang = voice.language?.toLowerCase() ?? ''
    const fallback = LANGUAGE_FALLBACK.find(([iso]) => lang.includes(iso))
    codes.add(fallback ? fallback[1] : 'global')
  }

  return [...codes].slice(0, 2)
}

export function extractVoiceBadges(voice: AudioGenVoice) {
  const text = voiceText(voice, false)

  const accent =
    voice.accent ??
    ACCENT_RULES.find(([, keywords]) => includesAny(text, keywords))?.[0] ??
    voice.language ??
    'Standard'

  const gender =
    voice.gender ??
    (includesAny(text, FEMALE_WORDS)
      ? 'Female'
      : includesAny(text, MALE_WORDS)
        ? 'Male'
        : 'Neutral')

  const age = includesAny(text, ['young', 'trẻ', 'youth', 'child'])
    ? 'Young'
    : includesAny(text, ['old', 'senior', 'elderly'])
      ? 'Old'
      : 'Middle_aged'

  return { accent, gender, age }
}

function matchesLanguage(voice: AudioGenVoice, code: string, label: string): boolean {
  const normLang = normalizeLanguageTag(voice.language)
  const text = voiceText(voice, true)
  const rawLang = voice.language?.toLowerCase()
  const primaryWord = label
    .toLowerCase()
    .split(' ')[0]!
    .replace(/[^a-z]/g, '')

  if (normLang === code || rawLang === code || normLang === primaryWord) return true
  if (primaryWord.length > 2 && text.includes(primaryWord)) return true

  const rule = LANGUAGE_RULES[code]
  if (!rule) return false
  return normLang === rule.name || includesAny(text, rule.keywords) || hasWord(text, code)
}

function matchesKeywordFilter(
  text: string,
  table: Record<string, readonly string[]>,
  key: string,
): boolean {
  const keywords = table[key]
  return !keywords || includesAny(text, keywords)
}

function matchesGender(voice: AudioGenVoice, target: string): boolean {
  if (normalizeGenderTag(voice.gender) === target) return true
  const inTags = voice.tags?.some((t) => normalizeGenderTag(t) === target)
  return Boolean(inTags || voice.description?.toLowerCase().includes(target))
}

function matchesQuery(voice: AudioGenVoice, query: string): boolean {
  const fields = [voice.label, voice.id, voice.description, voice.language, voice.accent]
  return (
    fields.some((f) => f?.toLowerCase().includes(query)) ||
    Boolean(voice.tags?.some((t) => t.toLowerCase().includes(query)))
  )
}

export interface VoiceFilterCriteria {
  query: string
  language: string
  languageLabel: string
  quality: string
  gender: string
  age: string
  category: string
}

const isActive = (value: string) => value !== 'all'

export function voiceMatchesFilters(voice: AudioGenVoice, c: VoiceFilterCriteria): boolean {
  if (isActive(c.language) && !matchesLanguage(voice, c.language, c.languageLabel)) return false
  if (isActive(c.gender) && !matchesGender(voice, c.gender)) return false

  const text = voiceText(voice, false)
  if (isActive(c.quality) && !matchesKeywordFilter(text, QUALITY_KEYWORDS, c.quality)) return false
  if (isActive(c.age) && !matchesKeywordFilter(text, AGE_KEYWORDS, c.age)) return false
  if (isActive(c.category) && !matchesKeywordFilter(text, CATEGORY_KEYWORDS, c.category))
    return false

  return !c.query || matchesQuery(voice, c.query)
}
