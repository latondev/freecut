// Deterministic pixel oracle for the canvas/WebGPU render engine.
//
// Renders frames of a media-backed, effect-heavy fixture project through the
// headless render service (`headless/serve.mjs` -> `POST /v1/frame`) and prints
// the SHA-256 of each rendered PNG, one line per frame:
//
//   frame=0 sha256=<hex>
//
// The point is determinism: run it twice and the five lines must be identical.
// That makes it a pixel-level oracle for refactors of
// `src/runtime/renderer/client-render-engine.ts` `renderFrame`, where a
// structural mistake shows up as silently wrong pixels, not a crash.
//
// It is hermetic: everything (workspace, synthesised clips) lives in a temp dir
// and the temp dir is removed on exit.
//
// Usage:
//   node .tmp/frame-oracle.mjs
//   node .tmp/frame-oracle.mjs --ablate gpu-effect,blend,mask,text,transition,v2,base
//   node .tmp/frame-oracle.mjs --keep          # leave the temp workspace behind
//
// `--ablate` drops one fixture ingredient at a time; each ingredient is only
// proven to be exercised when dropping it changes at least one frame hash.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORTLESS = 0
const FRAMES = [0, 6, 12, 18, 24]
const WIDTH = 108
const HEIGHT = 192
const FPS = 25
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const INGREDIENTS = ['gpu-effect', 'blend', 'mask', 'text', 'transition', 'occluder', 'base']

function parseArgs(argv) {
  const args = { ablate: new Set(), keep: false, dump: null, verbose: false }
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '--keep') args.keep = true
    else if (token === '--verbose') args.verbose = true
    else if (token === '--dump') args.dump = argv[++index]
    else if (token === '--ablate') {
      const value = argv[++index]
      assert.ok(value, '--ablate requires a comma-separated ingredient list')
      for (const name of value.split(',').filter(Boolean)) {
        assert.ok(INGREDIENTS.includes(name), `unknown ingredient: ${name}`)
        args.ablate.add(name)
      }
    } else throw new Error(`unknown argument: ${token}`)
  }
  return args
}

const { ablate, keep, dump, verbose } = parseArgs(process.argv.slice(2))
const log = (message) => process.stderr.write(`[oracle] ${message}\n`)

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORTLESS, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** Synthesise a solid-colour clip with an audio track, mirroring headless/lifecycle-e2e.mjs. */
function generateClip(filePath, { color, frequency, seconds }) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', `color=size=${WIDTH}x${HEIGHT}:rate=${FPS}:duration=${seconds}:color=${color}`,
      '-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=48000:duration=${seconds}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1',
      '-c:a', 'aac', '-ac', '2', '-shortest',
      filePath,
    ],
    { encoding: 'utf8' },
  )
  if (result.error?.code === 'ENOENT' || result.status === null) {
    throw new Error('ffmpeg is required by .tmp/frame-oracle.mjs (it synthesises the fixture clips)')
  }
  assert.equal(result.status, 0, `ffmpeg failed: ${result.stderr}`)
}

const sha256OfFile = (file) =>
  `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`

const sha256Of = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

const CLIPS = {
  red: { mediaId: 'clip_red', file: 'red.mp4', color: 'red', frequency: 440 },
  blue: { mediaId: 'clip_blue', file: 'blue.mp4', color: 'blue', frequency: 660 },
  yellow: { mediaId: 'clip_yellow', file: 'yellow.mp4', color: 'yellow', frequency: 550 },
  green: { mediaId: 'clip_green', file: 'green.mp4', color: 'green', frequency: 880 },
}
const SOURCE_SECONDS = 1.2
const SOURCE_FRAMES = Math.round(SOURCE_SECONDS * FPS) // 30

/** Higher `order` draws on top; a mask on track N clips every track with order > N. */
const TRACK_ORDER = { base: 0, mask: 1, clips: 2, over: 3, text: 4 }
const TRANSITION_START = 10
const TRANSITION_END = 20
const OCCLUDER_FROM = 16

function videoItem({ id, trackId, mediaId, from, durationInFrames, sourceStart = 0 }) {
  return {
    id,
    trackId,
    from,
    durationInFrames,
    label: id,
    type: 'video',
    mediaId,
    sourceFps: FPS,
    sourceStart,
    sourceEnd: sourceStart + durationInFrames,
    sourceDuration: SOURCE_FRAMES,
    trimStart: sourceStart,
    trimEnd: SOURCE_FRAMES - sourceStart - durationInFrames,
    speed: 1,
    volume: 0,
  }
}

function videoTrack(id, order) {
  return {
    id,
    name: id.toUpperCase(),
    kind: 'video',
    height: 60,
    locked: false,
    syncLock: true,
    visible: true,
    muted: false,
    solo: false,
    order,
    items: [],
  }
}

/** Full-bleed transform: opaque, unrotated, uncropped — the occlusion recipe. */
const FULL_BLEED = { x: 0, y: 0, width: WIDTH, height: HEIGHT, opacity: 1, rotation: 0, cornerRadius: 0 }

/**
 * The fixture project. It is deliberately built around the branches the
 * `renderFrame` decomposition touches:
 *
 * - `base`   (order 0) yellow clip: something for the blend below to interact with.
 * - `mask`   (order 1) rectangle mask over the left half, active on frames 0-9:
 *            clips everything on higher tracks, so it lands on clip A.
 * - `clips`  (order 2) clip A (red, GPU `gpu-invert`, blend `difference`) and clip B
 *            (blue) overlapping A's tail by 10 frames -> a legacy-overlap transition
 *            window on frames 10-19.
 * - `over`   (order 3) live action clip `c` from frame 16: a full-bleed opaque clip
 *            with no effects/blend/crop, which makes V1 fully occluded from frame 16.
 * - `text`   (order 4) a text item on top of everything.
 */
function buildProject() {
  const tracks = [
    videoTrack('base', TRACK_ORDER.base),
    videoTrack('mask', TRACK_ORDER.mask),
    videoTrack('clips', TRACK_ORDER.clips),
    videoTrack('over', TRACK_ORDER.over),
    videoTrack('text', TRACK_ORDER.text),
  ]
  const items = []

  // Clip A: red, frames 0..20. Carries the GPU effect and the blend mode.
  items.push({
    ...videoItem({
      id: 'a',
      trackId: 'clips',
      mediaId: CLIPS.red.mediaId,
      from: 0,
      durationInFrames: 20,
    }),
    effects: ablate.has('gpu-effect')
      ? []
      : [
          {
            id: 'fx-invert',
            enabled: true,
            effect: { type: 'gpu-effect', gpuEffectType: 'gpu-invert', params: {} },
          },
        ],
    blendMode: ablate.has('blend') ? 'normal' : 'difference',
  })

  // Clip B: blue, frames 10..30 — overlaps A by 10 frames, which is the overlap
  // the transition window derives from.
  items.push(
    videoItem({
      id: 'b',
      trackId: 'clips',
      mediaId: CLIPS.blue.mediaId,
      from: TRANSITION_START,
      durationInFrames: 20,
    }),
  )

  if (!ablate.has('base')) {
    items.push({
      ...videoItem({
        id: 'd',
        trackId: 'base',
        mediaId: CLIPS.yellow.mediaId,
        from: 0,
        durationInFrames: SOURCE_FRAMES,
      }),
      transform: FULL_BLEED,
    })
  }

  if (!ablate.has('mask')) {
    items.push({
      id: 'm',
      trackId: 'mask',
      from: 0,
      durationInFrames: TRANSITION_START,
      label: 'left-half mask',
      type: 'shape',
      shapeType: 'rectangle',
      fillColor: '#ffffff',
      isMask: true,
      maskType: 'clip',
      maskInvert: false,
      maskOpacity: 100,
      transform: { x: -WIDTH / 4, y: 0, width: WIDTH / 2, height: HEIGHT, rotation: 0, opacity: 1 },
    })
  }

  if (!ablate.has('occluder')) {
    items.push({
      ...videoItem({
        id: 'c',
        trackId: 'over',
        mediaId: CLIPS.green.mediaId,
        from: OCCLUDER_FROM,
        durationInFrames: SOURCE_FRAMES - OCCLUDER_FROM,
      }),
      transform: FULL_BLEED,
    })
  }

  if (!ablate.has('text')) {
    items.push({
      id: 't',
      trackId: 'text',
      from: 4,
      durationInFrames: 24,
      label: 'title',
      type: 'text',
      text: 'ORACLE',
      color: '#ffe600',
      // A locally-installed family: the render must not depend on a network font.
      fontFamily: 'Arial',
      fontSize: 26,
      fontWeight: 'bold',
      textAlign: 'center',
      verticalAlign: 'middle',
      transform: { x: 0, y: -60, width: 100, height: 36, rotation: 0, opacity: 1 },
    })
  }

  const transitions = ablate.has('transition')
    ? []
    : [
        {
          id: 'tr-ab',
          type: 'crossfade',
          presentation: 'wipe',
          direction: 'from-left',
          timing: 'linear',
          leftClipId: 'a',
          rightClipId: 'b',
          trackId: 'clips',
          durationInFrames: TRANSITION_END - TRANSITION_START,
          alignment: 0.5,
        },
      ]

  return {
    id: 'oracle',
    name: 'FrameOracle',
    description: 'Deterministic pixel oracle fixture',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    duration: SOURCE_FRAMES,
    schemaVersion: 10,
    metadata: { width: WIDTH, height: HEIGHT, fps: FPS, backgroundColor: '#000000' },
    timeline: { masterBusDb: 0, tracks, items, transitions, keyframes: [], compositions: [] },
  }
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'headless.html'))) {
    throw new Error('dist/headless.html is missing; run `npm run build` first')
  }
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'freecut-frame-oracle-'))
  const sources = path.join(workspace, 'sources')
  fs.mkdirSync(sources)
  fs.writeFileSync(path.join(workspace, '.freecut-workspace.json'), '{"schemaVersion":"2.0","createdAt":1}\n')
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  log(`workspace ${workspace}`)

  let service
  let serviceLog = ''
  try {
    for (const clip of Object.values(CLIPS)) {
      const file = path.join(sources, clip.file)
      generateClip(file, { color: clip.color, frequency: clip.frequency, seconds: SOURCE_SECONDS })
      clip.byteSize = fs.statSync(file).size
      clip.sha256 = sha256OfFile(file)
    }

    service = spawn(process.execPath, ['headless/serve.mjs', '--workspace', workspace, '--port', String(port)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    service.stdout.on('data', (chunk) => (serviceLog += chunk))
    service.stderr.on('data', (chunk) => (serviceLog += chunk))
    service.on('exit', (code) => (serviceLog += `\n[service exited with ${code}]\n`))

    let ready = false
    for (let attempt = 0; attempt < 160; attempt++) {
      if (service.exitCode !== null) break
      try {
        const response = await fetch(`${base}/health`)
        if (response.ok && (await response.json()).ok) {
          ready = true
          break
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    assert.ok(ready, `render service never became ready\n${serviceLog}`)
    const adapter = /WebGPU adapter: (.*)/.exec(serviceLog)?.[1] ?? '(unknown)'
    log(`WebGPU adapter: ${adapter}`)
    assert.ok(
      !/WARNING: WebGPU is software/.test(serviceLog),
      'WebGPU is software-rendered; GPU-effect frames would be rejected',
    )

    for (const clip of Object.values(CLIPS)) {
      const response = await fetch(`${base}/v1/media/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': `import-${clip.mediaId}` },
        body: JSON.stringify({
          mediaId: clip.mediaId,
          sourceRelativePath: `sources/${clip.file}`,
          expectedByteSize: clip.byteSize,
          expectedSha256: clip.sha256,
        }),
      })
      assert.ok(response.ok, `media import failed for ${clip.mediaId}: ${response.status} ${await response.text()}`)
    }

    const created = await fetch(`${base}/v1/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'create-oracle' },
      body: JSON.stringify({ id: 'oracle', name: 'FrameOracle' }),
    })
    assert.ok(created.ok, `project create failed: ${created.status} ${await created.text()}`)

    const projectFile = path.join(workspace, 'projects', 'oracle', 'project.json')
    assert.ok(fs.existsSync(projectFile), `project file missing: ${projectFile}`)
    fs.writeFileSync(projectFile, `${JSON.stringify(buildProject())}\n`)

    for (const frame of FRAMES) {
      const response = await fetch(`${base}/frame`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: 'oracle', frame, format: 'png', width: WIDTH, height: HEIGHT }),
      })
      const bytes = Buffer.from(await response.arrayBuffer())
      assert.ok(response.ok, `frame ${frame} failed: ${response.status} ${bytes.toString('utf8').slice(0, 500)}`)
      assert.equal(response.headers.get('content-type'), 'image/png', `frame ${frame}: unexpected content type`)
      assert.ok(bytes.length > 100, `frame ${frame}: suspiciously small response (${bytes.length} bytes)`)
      assert.ok(bytes.subarray(0, 8).equals(PNG_MAGIC), `frame ${frame}: response is not a PNG`)
      if (dump) {
        fs.mkdirSync(dump, { recursive: true })
        fs.writeFileSync(path.join(dump, `frame-${String(frame).padStart(3, '0')}.png`), bytes)
      }
      console.log(`frame=${frame} sha256=${sha256Of(bytes)}`)
    }
  } finally {
    if (verbose) log(`service log:\n${serviceLog}`)
    if (service && service.exitCode === null) {
      const exited = new Promise((resolve) => service.once('exit', () => resolve(true)))
      service.kill('SIGTERM')
      const didExit = await Promise.race([
        exited,
        new Promise((resolve) => setTimeout(() => resolve(false), 15_000)),
      ])
      if (!didExit) service.kill('SIGKILL')
    }
    if (keep) log(`kept workspace ${workspace}`)
    else fs.rmSync(workspace, { recursive: true, force: true })
  }
}

await main()
