import StudioRoom from './studio-room'

export default async function StudioSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <StudioRoom sessionId={id} />
}
