import React, { useCallback, useMemo } from 'react'
import { useGizmoStore, useTimelineStore } from '@/runtime/composition-runtime/deps/stores'
import { DEFAULT_PROJECT_HEIGHT, DEFAULT_PROJECT_WIDTH } from '@/shared/projects/defaults'
import type { TextItem } from '@/types/timeline'
import { resolveSpanStyles, resolveTextStyle } from '@/shared/typography/text-style'
import { loadFont } from '../utils/fonts'
import { useCompositionSpace } from '../contexts/composition-space-context'
import { useSequenceContext } from '@/runtime/composition-runtime/deps/player'
import { useItemKeyframesFromContext } from '../contexts/keyframes-context'
import { useVideoConfig } from '../hooks/use-player-compat'
import { resolveAnimatedTextItem } from '@/runtime/composition-runtime/deps/keyframes'

const VERTICAL_ALIGN_TO_FLEX: Record<string, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
}
const TEXT_ALIGN_TO_FLEX: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

/**
 * Text content with live property preview support.
 * Reads preview values from gizmo store for real-time updates during slider/picker drag.
 *
 * Style resolution (defaults + per-span cascade) goes through the shared
 * {@link resolveTextStyle}/{@link resolveSpanStyles} so the DOM preview, the
 * canvas renderer, and the GPU pipeline agree on every default; this component
 * keeps native CSS layout (it is the WYSIWYG reference) and applies the
 * composition-space scale on top of the resolved values.
 */
// fallow-ignore-next-line complexity
export const TextContent: React.FC<{ item: TextItem & { _sequenceFrameOffset?: number } }> = ({
  item,
}) => {
  const compositionSpace = useCompositionSpace()
  const { fps } = useVideoConfig()
  const sequenceContext = useSequenceContext()
  const contextKeyframes = useItemKeyframesFromContext(item.id)
  const storeKeyframes = useTimelineStore(
    useCallback((s) => s.keyframes.find((entry) => entry.itemId === item.id), [item.id]),
  )
  const itemKeyframes = contextKeyframes ?? storeKeyframes
  const relativeFrame = (sequenceContext?.localFrame ?? 0) - (item._sequenceFrameOffset ?? 0)
  const scaleX = compositionSpace?.scaleX ?? 1
  const scaleY = compositionSpace?.scaleY ?? 1
  const scale = compositionSpace?.scale ?? 1
  const logicalCanvas = useMemo(
    () => ({
      width: compositionSpace?.projectWidth ?? DEFAULT_PROJECT_WIDTH,
      height: compositionSpace?.projectHeight ?? DEFAULT_PROJECT_HEIGHT,
      fps,
    }),
    [compositionSpace?.projectHeight, compositionSpace?.projectWidth, fps],
  )
  const resolvedItem = useMemo(
    () => resolveAnimatedTextItem(item, itemKeyframes, relativeFrame, logicalCanvas),
    [item, itemKeyframes, logicalCanvas, relativeFrame],
  )

  // Read preview values from unified preview system
  const itemPreview = useGizmoStore(useCallback((s) => s.preview?.[item.id], [item.id]))
  const preview = itemPreview?.properties

  // Merge live preview overrides onto the resolved item, then run the shared
  // style resolver so defaults + span cascade match the other render paths.
  const hasTextShadowPreview =
    preview !== undefined && Object.prototype.hasOwnProperty.call(preview, 'textShadow')
  const hasStrokePreview =
    preview !== undefined && Object.prototype.hasOwnProperty.call(preview, 'stroke')
  const hasTextSpansPreview =
    preview !== undefined && Object.prototype.hasOwnProperty.call(preview, 'textSpans')

  const mergedItem = useMemo<TextItem>(
    () => ({
      ...resolvedItem,
      text: preview?.text ?? resolvedItem.text,
      textSpans: hasTextSpansPreview ? preview?.textSpans : resolvedItem.textSpans,
      fontSize: preview?.fontSize ?? resolvedItem.fontSize,
      fontFamily: resolvedItem.fontFamily,
      fontWeight: resolvedItem.fontWeight,
      fontStyle: resolvedItem.fontStyle,
      letterSpacing: preview?.letterSpacing ?? resolvedItem.letterSpacing,
      lineHeight: preview?.lineHeight ?? resolvedItem.lineHeight,
      color: preview?.color ?? resolvedItem.color,
      gradient: preview?.gradient ?? resolvedItem.gradient,
      textTransform: (preview as any)?.textTransform ?? resolvedItem.textTransform,
      backgroundColor: preview?.backgroundColor ?? resolvedItem.backgroundColor,
      backgroundRadius: preview?.backgroundRadius ?? resolvedItem.backgroundRadius,
      textPadding: preview?.textPadding ?? resolvedItem.textPadding,
      textShadow: hasTextShadowPreview ? preview?.textShadow : resolvedItem.textShadow,
      stroke: hasStrokePreview ? preview?.stroke : resolvedItem.stroke,
      textMotion: resolvedItem.textMotion,
    }),
    [hasStrokePreview, hasTextShadowPreview, hasTextSpansPreview, preview, resolvedItem],
  )

  const style = resolveTextStyle(mergedItem)
  const spanStyles = resolveSpanStyles(mergedItem)

  const justifyContent = TEXT_ALIGN_TO_FLEX[style.textAlign] ?? 'center'
  const alignItems = VERTICAL_ALIGN_TO_FLEX[style.verticalAlign] ?? 'center'

  const cssTextShadow = style.textShadow?.raw
    ? style.textShadow.raw
    : style.textShadow
      ? `${style.textShadow.offsetX * scaleX}px ${style.textShadow.offsetY * scaleY}px ${style.textShadow.blur * scale}px ${style.textShadow.color}`
      : undefined
  const strokeWidth = style.stroke?.width ? `${style.stroke.width * scale * 2}px` : undefined

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems,
        justifyContent,
        padding: style.backgroundColor ? 0 : `${style.textPadding * scale}px`,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          backgroundColor: style.backgroundColor,
          borderRadius: `${style.backgroundRadius * scale}px`,
          padding: style.backgroundColor ? `${style.textPadding * scale}px` : 0,
          textAlign: style.textAlign,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          width: 'fit-content',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        <SpanBlocks
          spanLayout={mergedItem.spanLayout}
          spanStyles={spanStyles}
          lineHeight={style.lineHeight}
          scale={scale}
          scaleX={scaleX}
          textShadow={cssTextShadow}
          strokeWidth={strokeWidth}
          strokeColor={style.stroke?.color}
        />
      </div>
    </div>
  )
}

interface SpanBlockProps {
  spanStyles: ReturnType<typeof resolveSpanStyles>
  lineHeight: number
  scale: number
  scaleX: number
  textShadow?: string
  strokeWidth?: string
  strokeColor?: string
}

/** Picks the span flow: 'inline' (one wrapped stream) vs default stacked lines. */
function SpanBlocks({
  spanLayout,
  ...props
}: SpanBlockProps & { spanLayout: 'stack' | 'inline' | undefined }) {
  const inline = spanLayout === 'inline' && props.spanStyles.length > 0
  return inline ? <InlineSpanFlow {...props} /> : <StackedSpans {...props} />
}

/**
 * Inline span flow: one wrapped text stream, spans recolor/underline words
 * inside a line. Font/size come from the FIRST span — same base-style rule as
 * the shared layoutTextBlock inline path.
 */
function InlineSpanFlow({
  spanStyles,
  lineHeight,
  scale,
  scaleX,
  textShadow,
  strokeWidth,
  strokeColor,
}: SpanBlockProps) {
  const base = spanStyles[0]!
  return (
    <div
      style={{
        fontSize: base.fontSize * scale,
        fontFamily: loadFont(base.fontFamily),
        fontWeight: base.fontWeight,
        fontStyle: base.fontStyle,
        lineHeight,
        letterSpacing: base.letterSpacing * scaleX,
        display: 'block',
        textAlign: 'inherit',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        width: '100%',
      }}
    >
      {spanStyles.flatMap((span, spanIdx) => {
        const tokens = span.text.match(/\S+|\s+/g) || []
        // fallow-ignore-next-line complexity
        return tokens.map((token, tokIdx) => {
          const isWord = Boolean(/\S/.test(token))
          const isHighlight =
            span.isHighlight !== undefined
              ? span.isHighlight
              : Boolean(
                  span.color &&
                  base.color &&
                  span.color.toLowerCase() !== base.color.toLowerCase() &&
                  isWord,
                )

          if (!isWord) {
            return (
              <span key={`sp-${spanIdx}-${tokIdx}`} style={{ whiteSpace: 'pre' }}>
                {token}
              </span>
            )
          }

          const isGradient = Boolean(span.gradient && (!isHighlight || !span.color))

          return (
            <span
              key={`w-${spanIdx}-${tokIdx}:${token}`}
              style={{
                backgroundImage: isGradient ? span.gradient : undefined,
                WebkitBackgroundClip: isGradient ? 'text' : undefined,
                backgroundClip: isGradient ? 'text' : undefined,
                WebkitTextFillColor: isGradient ? 'transparent' : undefined,
                color: isGradient ? 'transparent' : span.color,
                fontFamily: loadFont(span.fontFamily || base.fontFamily),
                fontWeight: span.fontWeightName ?? span.fontWeight,
                fontStyle: span.fontStyle ?? base.fontStyle,
                textDecoration: span.underline ? 'underline' : 'none',
                textShadow: isHighlight
                  ? textShadow
                    ? `0 0 ${14 * scale}px ${span.color}, ${textShadow}`
                    : `0 0 ${14 * scale}px ${span.color}`
                  : textShadow,
                WebkitTextStroke:
                  strokeWidth && strokeColor ? `${strokeWidth} ${strokeColor}` : undefined,
                WebkitTextStrokeWidth: strokeWidth,
                WebkitTextStrokeColor: strokeColor,
                paintOrder: strokeWidth ? 'stroke fill' : undefined,
                display: 'inline-block',
                textTransform: span.textTransform ?? base.textTransform,
                transform: isHighlight ? 'scale(1.14)' : undefined,
                transformOrigin: 'center bottom',
                transition: 'transform 0.08s cubic-bezier(0.34, 1.56, 0.64, 1)',
                willChange: isHighlight ? 'transform' : undefined,
              }}
            >
              {token}
            </span>
          )
        })
      })}
    </div>
  )
}

/** Default flow: every span is its own block line-group. */
function StackedSpans({
  spanStyles,
  lineHeight,
  scale,
  scaleX,
  textShadow,
  strokeWidth,
  strokeColor,
}: SpanBlockProps) {
  return (
    <>
      {/* fallow-ignore-next-line complexity */}
      {spanStyles.map((span, index) => {
        const isGradient = Boolean(span.gradient)
        return (
          <div
            key={`${index}:${span.text}`}
            style={{
              fontSize: span.fontSize * scale,
              fontFamily: loadFont(span.fontFamily),
              fontWeight: span.fontWeight,
              fontStyle: span.fontStyle,
              textDecoration: span.underline ? 'underline' : 'none',
              textTransform: span.textTransform,
              backgroundImage: isGradient ? span.gradient : undefined,
              WebkitBackgroundClip: isGradient ? 'text' : undefined,
              backgroundClip: isGradient ? 'text' : undefined,
              WebkitTextFillColor: isGradient ? 'transparent' : undefined,
              color: isGradient ? 'transparent' : span.color,
              textShadow,
              WebkitTextStroke:
                strokeWidth && strokeColor ? `${strokeWidth} ${strokeColor}` : undefined,
              WebkitTextStrokeWidth: strokeWidth,
              WebkitTextStrokeColor: strokeColor,
              paintOrder: strokeWidth ? 'stroke fill' : undefined,
              lineHeight,
              letterSpacing: span.letterSpacing * scaleX,
              display: 'block',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              width: '100%',
            }}
          >
            {span.text}
          </div>
        )
      })}
    </>
  )
}
