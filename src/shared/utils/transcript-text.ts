const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u
const NO_SPACE_BEFORE = /^[\p{P}\p{S}]/u
const NO_SPACE_AFTER = /[\p{Ps}\p{Pi}]$/u

function lastCharacter(value: string): string {
  return Array.from(value.trim()).at(-1) ?? ''
}

function firstCharacter(value: string): string {
  return Array.from(value.trim())[0] ?? ''
}

export function needsTranscriptWordSeparator(previous: string, next: string): boolean {
  const prevTrimmed = previous.trim()
  const nextTrimmed = next.trim()
  const previousCharacter = lastCharacter(prevTrimmed)
  const nextCharacter = firstCharacter(nextTrimmed)
  if (!previousCharacter || !nextCharacter) return false

  if (CJK_CHARACTER.test(previousCharacter) || CJK_CHARACTER.test(nextCharacter)) {
    return false
  }

  // Numbers with punctuation separator: "4," and "000" -> "4,000", "100." and "000" -> "100.000", "3." and "14" -> "3.14"
  if (/\d+[,.:/]$/.test(prevTrimmed) && /^\d+/.test(nextTrimmed)) {
    return false
  }

  // Digits and attached punctuation: "4" and ",000" -> "4,000"
  if (/\d+$/.test(prevTrimmed) && /^[,.:/]\d+/.test(nextTrimmed)) {
    return false
  }

  // Currency symbol before digits: "$" and "50" -> "$50"
  if (/^[$€£¥₫]$/.test(prevTrimmed) && /^\d+/.test(nextTrimmed)) {
    return false
  }

  // Number before percentage or degree: "50" and "%" -> "50%"
  if (/\d+$/.test(prevTrimmed) && /^[%‰°]/.test(nextTrimmed)) {
    return false
  }

  // Hyphenated word: "e-" and "mail" -> "e-mail"
  if (/-$/.test(prevTrimmed)) {
    return false
  }

  return !NO_SPACE_AFTER.test(previousCharacter) && !NO_SPACE_BEFORE.test(nextCharacter)
}

export function joinTranscriptWords(words: readonly string[]): string {
  const normalized = words.map((word) => word.trim()).filter(Boolean)
  return normalized.reduce((text, word, index) => {
    if (index === 0) return word
    const previous = normalized[index - 1] ?? ''
    return `${text}${needsTranscriptWordSeparator(previous, word) ? ' ' : ''}${word}`
  }, '')
}
