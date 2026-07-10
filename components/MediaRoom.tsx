'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import CircleAccountPanel from './CircleAccountPanel'
import ProvenancePanel from './ProvenancePanel'
import type { MatchState, MediaBranch, MediaBranchScene, ProvenanceEvent } from '@/lib/types'

interface Props {
  sessionId: string
  matchState: MatchState
  walletId: string | null
  walletAddress: string | null
  walletStatus: 'loading' | 'ready' | 'error'
  walletError: string | null
  creatorWalletId: string | null
  provenanceEvents: ProvenanceEvent[]
  onMatchState: (matchState: MatchState) => void
}

export default function MediaRoom({
  sessionId,
  matchState,
  walletId,
  walletAddress,
  walletStatus,
  walletError,
  provenanceEvents,
  onMatchState,
}: Props) {
  const [busy, setBusy] = useState<'unlock' | 'branch' | null>(null)
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const unlocked = useMemo(
    () => Boolean(walletId && matchState.unlockedWallets?.includes(walletId)),
    [matchState.unlockedWallets, walletId],
  )

  async function unlock() {
    if (!walletId || busy) return
    setBusy('unlock')
    setError(null)
    try {
      const res = await fetch('/api/room/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, participantWalletId: walletId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Unlock failed')
      onMatchState(data.matchState)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setBusy(null)
    }
  }

  async function generateBranch() {
    if (!walletId || !prompt.trim() || busy) return
    setBusy('branch')
    setError(null)
    try {
      const res = await fetch('/api/room/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          participantWalletId: walletId,
          prompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Branch failed')
      setPrompt('')
      onMatchState(data.matchState)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Branch failed')
    } finally {
      setBusy(null)
    }
  }

  const branchCount = matchState.branches?.length ?? 0

  return (
    <main className="min-h-screen bg-paper px-4 py-4 text-ink">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-4">
          <header className="overflow-hidden rounded-sm border border-rule bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
                  {roomEyebrow(matchState.roomKind)}
                </p>
                <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">
                  {matchState.seedTitle ?? matchState.experienceLabel}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
                  {matchState.seedTopic ?? matchState.experienceSummary}
                </p>
              </div>
              <Link
                href="/studio"
                className="rounded-full border border-rule px-4 py-2 text-sm font-medium text-ink hover:bg-secondary"
              >
                Studio
              </Link>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              <Stat label="Unlock" value={`${matchState.accessPriceUsdc ?? '0.0001'} USDC`} />
              <Stat label="Steer" value={`${matchState.steerPriceUsdc ?? '0.0001'} USDC`} />
              <Stat label="Branches" value={branchCount.toString()} />
              <Stat label="Earned" value={`${matchState.totalEarned.toFixed(4)} USDC`} />
            </div>
          </header>

          {!unlocked ? (
            <LockedRoomPanel
              matchState={matchState}
              walletReady={walletStatus === 'ready' && Boolean(walletId)}
              busy={busy === 'unlock'}
              onUnlock={unlock}
            />
          ) : (
            <>
              <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
                <SeedPanel matchState={matchState} />
                <SteerPanel
                  matchState={matchState}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  busy={busy === 'branch'}
                  onGenerate={generateBranch}
                />
              </section>
              <BranchList branches={matchState.branches ?? []} roomKind={matchState.roomKind} />
            </>
          )}

          {error && (
            <div className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {walletStatus !== 'ready' || !walletAddress ? <CircleAccountPanel /> : null}
          <RoomAccessPanel
            address={walletAddress}
            error={walletError}
            roomKind={matchState.roomKind}
            status={walletStatus}
            unlocked={unlocked}
          />
          <ProvenancePanel events={provenanceEvents} compact />
        </aside>
      </div>
    </main>
  )
}

function LockedRoomPanel({
  matchState,
  walletReady,
  busy,
  onUnlock,
}: {
  matchState: MatchState
  walletReady: boolean
  busy: boolean
  onUnlock: () => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-sm border border-rule bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
          {lockedRoomEyebrow(matchState.roomKind)}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">
          {lockedRoomTitle(matchState.roomKind)}
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {lockedRoomCopy(matchState.roomKind)}
        </p>
        <div className="mt-5 rounded-sm border border-rule bg-secondary p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Preview
          </div>
          <h3 className="mt-2 text-xl font-semibold text-ink">{matchState.seedTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{matchState.seedTopic}</p>
          <div className="mt-4 h-24 overflow-hidden rounded-sm border border-dashed border-rule bg-card p-4 text-sm leading-6 text-ink-muted">
            {matchState.seedContent || 'The creator has not pasted the full seed yet.'}
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-rule bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
          Start here
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">
          {lockedSteerTitle(matchState.roomKind)}
        </h2>
        <div className="mt-5 grid gap-3">
          <StepCard
            label="Step 1"
            title={`Unlock for ${matchState.accessPriceUsdc ?? '0.0001'} USDC`}
            body={unlockStepCopy(matchState.roomKind)}
          />
          <StepCard
            label="Step 2"
            title={`Steer for ${matchState.steerPriceUsdc ?? '0.0001'} USDC`}
            body={steerStepCopy(matchState.roomKind)}
          />
        </div>
        <div className="mt-4 rounded-sm border border-rule bg-secondary p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Steering composer preview
          </div>
          <textarea
            disabled
            rows={3}
            placeholder={steerPlaceholder(matchState.roomKind)}
            className="mt-2 w-full resize-none rounded-sm border border-dashed border-rule bg-card px-3 py-3 text-xs leading-5 text-ink-muted outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] text-ink-muted">
              Opposite argument
            </span>
            <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] text-ink-muted">
              Local version
            </span>
          </div>
        </div>
        <button
          onClick={onUnlock}
          disabled={!walletReady || busy}
          className="mt-5 w-full rounded-sm bg-ink px-5 py-4 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? 'Settling unlock...' : unlockButtonCopy(matchState.roomKind)}
        </button>
        {!walletReady && (
          <p className="mt-3 text-xs leading-5 text-ink-muted">
            Your email wallet is still being prepared. The unlock button activates when
            the wallet is ready.
          </p>
        )}
      </div>
    </section>
  )
}

function SeedPanel({ matchState }: { matchState: MatchState }) {
  if (matchState.roomKind === 'live-video') {
    return (
      <section className="overflow-hidden rounded-sm border border-rule bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
            Live video
          </h2>
          <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
            Live
          </span>
        </div>
        {matchState.dailyRoomUrl ? (
          <iframe
            title="Gaffer live video room"
            src={matchState.dailyRoomUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-[560px] w-full rounded-lg border border-zinc-200 bg-zinc-950"
          />
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-sm border border-dashed border-rule bg-secondary p-8 text-center">
            <div>
              <h3 className="text-lg font-semibold text-ink">Daily room not attached</h3>
              <p className="mt-2 text-sm text-ink-muted">
                Add DAILY_API_KEY or paste a Daily room URL when creating the room.
              </p>
            </div>
          </div>
        )}
      </section>
    )
  }

  if (matchState.roomKind === 'story-video') {
    return <StorySeedReelPreview matchState={matchState} />
  }

  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            Original creator seed
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">
            {seedPanelTitle(matchState.roomKind)}
          </h2>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Unlocked
        </span>
      </div>
      <div className="mt-4 max-h-[620px] overflow-y-auto whitespace-pre-wrap rounded-sm border border-rule bg-secondary p-5 text-[15px] leading-8 text-ink">
        {matchState.seedContent}
      </div>
    </section>
  )
}

function StorySeedReelPreview({ matchState }: { matchState: MatchState }) {
  const seedImagePrompt = [
    'Vertical 9:16 premium cinematic anime key art, no text, no captions, no watermark.',
    `Story title: ${matchState.seedTitle}.`,
    `Premise: ${matchState.seedTopic}.`,
    `Story world and characters: ${matchState.seedContent}`,
    'One emotionally charged moment, expressive faces, coherent anatomy, dramatic movie lighting, detailed environment, polished composition.',
  ].join(' ')

  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            Original creator seed
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Story package preview</h2>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Unlocked
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <div className="mx-auto w-full max-w-[420px]">
          <AnimeReelFrame
            eyebrow="Original cinematic seed"
            title={matchState.seedTitle || 'Creator story seed'}
            caption={shortReelText(matchState.seedTopic || matchState.experienceSummary)}
            footer="Unlock the seed, then steer a new connected scene series."
            imagePrompt={seedImagePrompt}
            sceneIndex={1}
            sceneTotal={1}
            tone="romance"
          />
        </div>

        <div className="grid gap-4">
          <div className="rounded-sm border border-rule bg-secondary p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            Story seed
          </p>
          <h3 className="mt-2 text-3xl font-semibold leading-tight text-ink">
            {matchState.seedTitle}
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{matchState.seedTopic}</p>
            <details className="mt-5 rounded-sm border border-rule bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
                Read the complete creator seed
              </summary>
              <div className="max-h-[360px] overflow-y-auto whitespace-pre-wrap border-t border-rule p-4 text-sm leading-7 text-ink-muted">
                {matchState.seedContent}
              </div>
            </details>
          </div>

          <div className="rounded-sm border border-rule bg-secondary p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              What a paid steer generates
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                'Connected vertical scenes',
                'Consistent characters',
                'On-screen narration',
                'Cinematic image prompts',
              ].map((item, index) => (
                <div
                  key={item}
                  className="rounded-sm border border-rule bg-card px-4 py-3 text-sm font-semibold leading-6 text-ink"
                >
                  <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-accent">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SteerPanel({
  matchState,
  prompt,
  setPrompt,
  busy,
  onGenerate,
}: {
  matchState: MatchState
  prompt: string
  setPrompt: (value: string) => void
  busy: boolean
  onGenerate: () => void
}) {
  const presets = steerPresets(matchState.roomKind)

  return (
    <section className="sticky top-4 rounded-sm border border-rule bg-card p-5">
      <div className="rounded-sm border border-rule bg-secondary p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
          User action
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">
          {steerPanelTitle(matchState.roomKind)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {steerCopy(matchState.roomKind)}
        </p>
        <div className="mt-3 inline-flex rounded-full border border-rule bg-card px-3 py-1 font-mono text-xs text-ink-muted">
          {matchState.steerPriceUsdc ?? '0.0001'} USDC per steer
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Quick scenarios
        </div>
        <div className="grid gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setPrompt(preset.prompt)}
              className="rounded-sm border border-rule bg-secondary px-3 py-2 text-left text-xs font-semibold leading-5 text-ink hover:bg-card"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={6}
        placeholder={steerPlaceholder(matchState.roomKind)}
        className="gaffer-input mt-4 resize-none text-sm leading-6"
      />
      <button
        onClick={onGenerate}
        disabled={busy || !prompt.trim()}
        className="mt-3 w-full rounded-sm bg-ink px-5 py-4 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy
          ? 'Circle wallet settling and generating...'
          : `Settle ${matchState.steerPriceUsdc ?? '0.0001'} USDC and generate branch`}
      </button>
      <p className="mt-3 text-xs leading-5 text-ink-muted">
        Your steer is signed by your Circle Arc wallet, recorded as provenance,
        and displayed as a visible branch in this room.
      </p>
    </section>
  )
}

function BranchList({
  branches,
  roomKind,
}: {
  branches: MediaBranch[]
  roomKind: MatchState['roomKind']
}) {
  if (!branches.length) {
    return (
      <section className="rounded-sm border border-rule bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
          {branchListEyebrow(roomKind)}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-ink">
          {emptyBranchTitle(roomKind)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {emptyBranchCopy(roomKind)}
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            {branchListEyebrow(roomKind)}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">
            {branchListTitle(roomKind)}
          </h2>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {branches.length} total
        </span>
      </div>
      {branches.map((branch) => (
        <article key={branch.id} className="rounded-sm border border-rule bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
                {branch.kind.replace('-', ' ')}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{branch.title}</h3>
            </div>
            <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              {branch.amountUsdc} USDC
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{branch.summary}</p>
          {branch.settlementId && (
            <p className="mt-3 truncate rounded-sm border border-rule bg-secondary px-3 py-2 font-mono text-[10px] text-ink-muted">
              tx: {branch.settlementId}
            </p>
          )}
          {roomKind === 'story-video' ? (
            <StoryboardVideoPlayer branch={branch} />
          ) : null}
          {roomKind === 'story-video' ? (
            <details className="mt-4 rounded-sm border border-rule bg-secondary">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
                Production notes and character bible
              </summary>
              <div className="border-t border-rule p-4 whitespace-pre-wrap text-sm leading-7 text-ink-muted">
                {branch.body}
              </div>
            </details>
          ) : (
            <div className="mt-4 whitespace-pre-wrap rounded-sm border border-rule bg-secondary p-4 text-sm leading-7 text-ink-muted">
              {branch.body}
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function StoryboardVideoPlayer({ branch }: { branch: MediaBranch }) {
  const scenes = storyScenesForBranch(branch)
  const [active, setActive] = useState(0)
  const activeScene = scenes[active] ?? scenes[0]

  useEffect(() => {
    if (scenes.length < 2) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % scenes.length)
    }, 2800)
    return () => window.clearInterval(timer)
  }, [scenes.length])

  if (!activeScene) return null

  return (
    <div className="mt-4 rounded-sm border border-rule bg-zinc-950 p-4 text-white shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
            Cinematic image-story series
          </p>
          <h4 className="mt-1 text-sm font-semibold">{branch.title}</h4>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-300">
          {active + 1}/{scenes.length}
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,390px)_1fr]">
        <div className="mx-auto w-full max-w-[390px]">
          <AnimeReelFrame
            key={`${branch.id}-${active}`}
            eyebrow={activeScene.chapterTitle || 'Generated episode'}
            title={activeScene.title}
            caption={shortReelText(sceneNarration(activeScene))}
            footer={sceneVisual(activeScene)}
            imagePrompt={sceneImagePrompt(activeScene)}
            imageUrl={activeScene.imageUrl}
            sceneIndex={active + 1}
            sceneTotal={scenes.length}
            tone={active % 2 === 0 ? 'romance' : 'shadow'}
          />
        </div>
        <div className="grid content-start gap-3">
          <div className="rounded-sm border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              Scene narration
            </p>
            <h5 className="mt-2 text-lg font-semibold text-white">{activeScene.title}</h5>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              {sceneNarration(activeScene)}
            </p>
          </div>
          <div className="rounded-sm border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              Visual description
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              {sceneVisual(activeScene)}
            </p>
          </div>
          {sceneImagePrompt(activeScene) ? (
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                Image generation prompt
              </p>
              <p className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-6 text-zinc-300">
                {sceneImagePrompt(activeScene)}
              </p>
            </div>
          ) : null}
          <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
            {scenes.map((scene, index) => (
              <button
                key={`${branch.id}-scene-${index}`}
                type="button"
                onClick={() => setActive(index)}
                className={`rounded-sm border p-3 text-left transition ${
                  index === active
                    ? 'border-accent bg-white text-black'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  Scene {scene.sceneNumber ?? index + 1}
                </span>
                <span className="mt-1 block text-sm font-semibold">{scene.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 opacity-80">
                  {sceneNarration(scene)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AnimeReelFrame({
  caption,
  eyebrow,
  footer,
  imagePrompt,
  imageUrl,
  sceneIndex,
  sceneTotal,
  title,
  tone,
}: {
  caption: string
  eyebrow: string
  footer: string
  imagePrompt: string
  imageUrl?: string
  sceneIndex: number
  sceneTotal: number
  title: string
  tone: 'romance' | 'shadow'
}) {
  const isShadow = tone === 'shadow'
  const [imageFailed, setImageFailed] = useState(false)
  const renderedImageUrl =
    imageUrl ||
    (imagePrompt
      ? `/api/story/image?prompt=${encodeURIComponent(imagePrompt.slice(0, 1800))}&seed=${sceneIndex}`
      : '')
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border border-white/15 bg-zinc-950 shadow-2xl">
      <div
        className={`absolute inset-0 ${
          isShadow
            ? 'bg-[radial-gradient(circle_at_78%_12%,rgba(248,250,252,0.42),transparent_18%),radial-gradient(circle_at_18%_30%,rgba(99,102,241,0.45),transparent_28%),linear-gradient(155deg,#090914_0%,#21182d_45%,#0e1018_100%)]'
            : 'bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.52),transparent_17%),radial-gradient(circle_at_28%_32%,rgba(244,114,182,0.45),transparent_27%),linear-gradient(155deg,#f8d7e5_0%,#b8c7f4_48%,#332846_100%)]'
        }`}
      />
      {renderedImageUrl && !imageFailed ? (
        <img
          src={renderedImageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.42)_0_1px,transparent_2px),linear-gradient(120deg,transparent_0_42%,rgba(255,255,255,0.18)_43%,transparent_46%)] [background-size:34px_34px,100%_100%]" />
      <div className="absolute -left-10 top-10 h-72 w-48 rotate-12 rounded-[48%] bg-white/24 blur-sm" />
      <div className="absolute right-6 top-20 h-48 w-28 rounded-full bg-black/30 blur-md" />
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black via-black/55 to-transparent" />

      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <span className="rounded-full bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur">
          {eyebrow}
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white backdrop-blur">
          {sceneIndex}/{sceneTotal}
        </span>
      </div>

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4 text-white">
        <ReelAction label="458" symbol="♡" />
        <ReelAction label="2" symbol="◯" />
        <ReelAction label="13" symbol="↗" />
      </div>

      <div className="absolute bottom-5 left-5 right-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
          {title}
        </p>
        <p
          className="mt-3 text-xl font-black leading-tight text-white sm:text-2xl"
          style={{ textShadow: '0 3px 12px rgba(0,0,0,0.9)' }}
        >
          {caption}
        </p>
        <p className="mt-4 line-clamp-2 text-xs leading-5 text-white/75">{footer}</p>
      </div>
    </div>
  )
}

function ReelAction({ label, symbol }: { label: string; symbol: string }) {
  return (
    <div className="grid justify-items-center gap-1">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-black/30 text-xl font-bold backdrop-blur">
        {symbol}
      </div>
      <span className="text-[11px] font-semibold">{label}</span>
    </div>
  )
}

function sceneNarration(scene: MediaBranchScene) {
  return scene.narration || scene.caption || 'A cinematic moment moves the story forward.'
}

function sceneVisual(scene: MediaBranchScene) {
  return (
    scene.visualDescription ||
    scene.visual ||
    'A movie-quality image frame with emotional character detail.'
  )
}

function sceneImagePrompt(scene: MediaBranchScene) {
  return scene.imagePrompt || ''
}

function storyScenesForBranch(branch: MediaBranch): MediaBranchScene[] {
  if (branch.scenes?.length) return branch.scenes

  const chapters = Array.from(
    branch.body.matchAll(
      /^Chapter\s+(\d+)\s*[-\u2013\u2014]\s*([^:\n]+):\s*(.+)$/gim,
    ),
  )
  const characterBible =
    branch.body.match(/MAIN CHARACTERS:\s*([\s\S]*?)(?:\n\s*STORY STRUCTURE:|$)/i)?.[1]?.trim() ||
    'Keep the same lead characters, facial features, hair, clothing, and proportions in every scene.'

  const beats = chapters.length
    ? chapters.flatMap((chapter) => {
        const chapterNumber = Number(chapter[1])
        const chapterTitle = chapter[2].trim()
        const detail = chapter[3].trim()
        const [action, emotion = 'The emotional stakes deepen.'] = detail.split(
          /\s*Emotional purpose:\s*/i,
        )
        return [
          {
            sceneNumber: (chapterNumber - 1) * 2 + 1,
            chapterTitle: `Chapter ${chapterNumber} - ${chapterTitle}`,
            title: `${chapterTitle}: opening image`,
            narration: action,
            visualDescription: `${action} Establish the place and relationship in one expressive cinematic frame.`,
            emotion,
          },
          {
            sceneNumber: (chapterNumber - 1) * 2 + 2,
            chapterTitle: `Chapter ${chapterNumber} - ${chapterTitle}`,
            title: `${chapterTitle}: turning point`,
            narration: `${emotion} One choice carries the story into the next chapter.`,
            visualDescription: `${emotion} Use an intimate emotional close-up and a visibly changed relationship.`,
            emotion,
          },
        ]
      })
    : Array.from({ length: 6 }, (_, index) => ({
        sceneNumber: index + 1,
        chapterTitle: `Chapter ${Math.floor(index / 2) + 1}`,
        title: index === 5 ? 'The final choice' : `Cinematic beat ${index + 1}`,
        narration:
          index === 0
            ? branch.summary
            : `${branch.summary} The next image reveals a new emotional turn.`,
        visualDescription: `A connected cinematic moment from ${branch.title}, continuing directly from the previous frame.`,
        emotion: 'Emotion, suspense, and visible narrative progress.',
      }))

  return beats.slice(0, 6).map((beat) => {
    const prompt = [
      'Vertical 9:16 high-budget cinematic anime story frame, no words, no captions, no watermark.',
      `Story: ${branch.title}.`,
      `Character consistency bible: ${characterBible}`,
      `Scene: ${beat.visualDescription}`,
      `Mood: ${beat.emotion}`,
      'Natural expressive faces, coherent anatomy, dramatic lighting, premium movie composition, detailed environment.',
    ].join(' ')
    return {
      sceneNumber: beat.sceneNumber,
      chapterTitle: beat.chapterTitle,
      title: beat.title,
      caption: beat.narration,
      narration: beat.narration,
      visual: beat.visualDescription,
      visualDescription: beat.visualDescription,
      imagePrompt: prompt,
    }
  })
}

function shortReelText(text: string) {
  const trimmed = text.replace(/^NARRATION:\s*/i, '').trim()
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177).trim()}...`
}

function StepCard({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="rounded-sm border border-rule bg-secondary p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-ink">{title}</div>
      <p className="mt-1 text-xs leading-5 text-ink-muted">{body}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-rule bg-secondary p-3">
      <div className="font-mono text-sm font-semibold text-ink">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        {label}
      </div>
    </div>
  )
}

function RoomAccessPanel({
  address,
  error,
  roomKind,
  status,
  unlocked,
}: {
  address: string | null
  error: string | null
  roomKind: MatchState['roomKind']
  status: 'loading' | 'ready' | 'error'
  unlocked: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
        Reader access
      </p>
      <h2 className="mt-2 text-lg font-semibold text-ink">
        {unlocked ? `${contentLabel(roomKind)} unlocked` : 'Unlock required'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        {status === 'ready'
          ? 'Your Circle Arc wallet is ready for unlocks and paid steers.'
          : status === 'loading'
            ? 'Preparing your Circle Arc wallet for paid reading and steering.'
            : 'Circle wallet setup needs attention before paid actions can run.'}
      </p>
      <div className="mt-4 rounded-sm border border-rule bg-secondary p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Circle reader wallet
          </div>
          {address && (
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="rounded-full border border-rule px-2 py-1 text-[10px] font-semibold text-ink hover:bg-card"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        <input
          readOnly
          value={address ?? 'Preparing'}
          className="mt-2 w-full border-0 bg-transparent p-0 font-mono text-xs text-ink outline-none"
          aria-label="Circle reader wallet address"
        />
      </div>
      {error && (
        <div className="mt-3 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-600">
          {error}
        </div>
      )}
    </section>
  )
}

function contentLabel(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Live room'
  if (roomKind === 'story-video') return 'Story seed'
  return 'Article'
}

function lockedRoomEyebrow(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Creator live room'
  if (roomKind === 'story-video') return 'Creator story seed'
  return 'Creator article'
}

function lockedRoomTitle(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Unlock the live room, then steer the show'
  if (roomKind === 'story-video') return 'Unlock the story seed, then generate your branch'
  return 'Unlock the article, then steer your own version'
}

function lockedRoomCopy(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') {
    return 'The creator live room is gated. Once unlocked, you can watch and pay to send director cues, prompts, or audience questions.'
  }
  if (roomKind === 'story-video') {
    return 'The creator story seed is gated. Once unlocked, you can read the premise and pay to generate your own storyboard-video branch.'
  }
  return 'The creator article is gated. Once unlocked, you can read it and pay to create your own branch, rebuttal, continuation, or alternate angle.'
}

function lockedSteerTitle(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Steer this live room after unlock'
  if (roomKind === 'story-video') return 'Generate a story-video branch after unlock'
  return 'Steer this article after unlock'
}

function unlockStepCopy(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Enter the creator live room and see the room brief.'
  if (roomKind === 'story-video') return 'Read the creator story seed, world, and premise.'
  return "Read the creator's full article."
}

function steerStepCopy(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Send a paid cue for the live creator or AI director.'
  if (roomKind === 'story-video') return 'Submit your scenario and generate a storyboard-video branch.'
  return 'Submit your scenario and generate a paid article branch.'
}

function unlockButtonCopy(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Unlock live room and steering'
  if (roomKind === 'story-video') return 'Unlock story seed and steering'
  return 'Unlock article and steering'
}

function seedPanelTitle(roomKind: MatchState['roomKind']) {
  if (roomKind === 'story-video') return 'Read the story seed'
  return 'Read the writer article'
}

function steerPanelTitle(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Steer this live room'
  if (roomKind === 'story-video') return 'Generate a cinematic story series'
  return 'Steer this article'
}

function branchListEyebrow(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Director cues'
  if (roomKind === 'story-video') return 'Storyboard branches'
  return 'Crowd branches'
}

function emptyBranchTitle(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'No live cues yet'
  if (roomKind === 'story-video') return 'No story branches yet'
  return 'No one has steered yet'
}

function emptyBranchCopy(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') {
    return 'Paid audience cues and AI director responses will appear here after the first live steer.'
  }
  if (roomKind === 'story-video') {
    return 'Paid storyboard-video branches will appear here after the first supporter generates a scenario.'
  }
  return 'Paid branches and AI director outputs will appear here after the first user steer.'
}

function branchListTitle(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'What viewers steered'
  if (roomKind === 'story-video') return 'Generated story-video paths'
  return 'What users steered'
}

function roomEyebrow(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Live video room'
  if (roomKind === 'story-video') return 'AI story video'
  return 'Interactive article'
}

function steerCopy(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') {
    return 'Pay to send the AI director a cue for what the creator should do, answer, or explore next.'
  }
  if (roomKind === 'story-video') {
    return 'Pay to generate a connected image-story branch with a title, overview, character bible, chapters, narration, visual direction, and image prompts.'
  }
  return 'Pay to create your own branch, rebuttal, continuation, or alternate angle from this article.'
}

function steerPlaceholder(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') return 'Ask the founder to explain the riskiest part, then turn it into a challenge...'
  if (roomKind === 'story-video') return 'Genre: romantic fantasy anime. Visual style: cinematic anime. Chapters: 3. Make the heroine discover the villain is her fated protector, then build a suspenseful image-story series...'
  return 'Rewrite this from the opposite side, focused on creators in Lagos...'
}

function steerPresets(roomKind: MatchState['roomKind']) {
  if (roomKind === 'live-video') {
    return [
      {
        label: 'Ask a sharper question',
        prompt: 'Ask the speaker to explain the hardest tradeoff and give a concrete example.',
      },
      {
        label: 'Challenge the claim',
        prompt: 'Push back on the main claim and ask for evidence, numbers, or a real user story.',
      },
      {
        label: 'Make it practical',
        prompt: 'Turn this into a practical next step the audience can try today.',
      },
    ]
  }

  if (roomKind === 'story-video') {
    return [
      {
        label: 'Dark cinematic anime',
        prompt:
          'Genre: dark romantic fantasy. Visual style: cinematic anime. Chapters: 3. Create a connected image-story series where the heroine wounds the immortal villain and realizes he is the only person who has ever protected her.',
      },
      {
        label: 'Trailer structure',
        prompt:
          'Genre: romantic suspense. Visual style: high-budget vertical anime trailer. Chapters: 3. Turn this into a trailer-like image-story series with emotional narration, character consistency, and image prompts for every scene.',
      },
      {
        label: 'Lagos fantasy version',
        prompt:
          'Genre: supernatural romance. Visual style: cinematic anime set in Lagos at night. Chapters: 3. Rebuild the story with rain, neon streets, family pressure, and a dangerous secret romance.',
      },
    ]
  }

  return [
    {
      label: 'Opposite argument',
      prompt: 'Write the strongest opposing argument, with a serious and fair tone.',
    },
    {
      label: 'Local version',
      prompt: 'Rewrite this through the lens of young creators building in Lagos.',
    },
    {
      label: 'Personal story',
      prompt: 'Continue this as a first-person story from someone affected by the issue.',
    },
    {
      label: 'Founder memo',
      prompt: 'Turn this into a clear founder memo with problem, insight, and next move.',
    },
  ]
}
