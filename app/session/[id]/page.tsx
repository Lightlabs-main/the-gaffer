import MatchRoom from './match-room'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MatchRoom sessionId={id} />
}
