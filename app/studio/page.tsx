import { cookies } from 'next/headers'
import StudioHomeClient, { type StudioRoomSummary } from './StudioHomeClient'
import type { ProfileIdentity } from '@/lib/client-profile'
import { listSessions } from '@/lib/session-store'

function parseProfileIdentityCookie(value?: string): ProfileIdentity | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    return parsed as ProfileIdentity
  } catch {
    return null
  }
}

export default async function StudioHome({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const cookieStore = await cookies()
  const params = searchParams ? await searchParams : {}
  const sectionParam = Array.isArray(params.section)
    ? params.section[0]
    : params.section
  const identity = parseProfileIdentityCookie(
    cookieStore.get('gaffer_profile_identity')?.value,
  )
  const initialSignedIn = Boolean(identity?.loginProvider === 'email')
  const initialRooms: StudioRoomSummary[] = listSessions()
    .filter((session) =>
      identity?.walletId
        ? session.matchState.creatorWalletId === identity.walletId
        : true,
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((session) => {
      const txEvent = [...session.provenanceEvents]
        .reverse()
        .find((event) => event.data?.txHash || event.data?.transactionId)
      return {
        id: session.id,
        roomKind: session.matchState.roomKind,
        experienceType: session.matchState.experienceType,
        label: session.matchState.experienceLabel,
        title:
          session.matchState.seedTitle ||
          session.matchState.homeTeam.name ||
          session.matchState.experienceLabel,
        topic:
          session.matchState.seedTopic ||
          session.matchState.awayTeam.name ||
          session.matchState.experienceSummary,
        createdAt: session.createdAt,
        accessPriceUsdc: session.matchState.accessPriceUsdc ?? '0.0001',
        steerPriceUsdc: session.matchState.steerPriceUsdc ?? '0.0001',
        totalEarned: session.matchState.totalEarned,
        branches: session.matchState.branches?.length ?? 0,
        creatorWalletId: session.matchState.creatorWalletId,
        creatorAddress: session.matchState.creatorAddress,
        lastTxHash:
          typeof txEvent?.data?.txHash === 'string'
            ? txEvent.data.txHash
            : typeof txEvent?.data?.transactionId === 'string'
              ? txEvent.data.transactionId
              : undefined,
      }
    })

  return (
    <StudioHomeClient
      key={sectionParam ?? 'overview'}
      initialIdentity={identity}
      initialRooms={initialRooms}
      initialSectionParam={sectionParam}
      initialSignedIn={initialSignedIn}
    />
  )
}
