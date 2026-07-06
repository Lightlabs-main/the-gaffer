import { env } from './env'

interface DailyRoomResponse {
  id: string
  name: string
  url: string
  privacy: string
}

export async function createDailyRoom(opts: {
  name: string
  maxParticipants?: number
  expSeconds?: number
}): Promise<DailyRoomResponse | null> {
  const apiKey = env.dailyApiKey()
  if (!apiKey) return null

  const exp = Math.floor(Date.now() / 1000) + (opts.expSeconds ?? 60 * 60 * 6)
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: opts.name,
      privacy: 'public',
      properties: {
        exp,
        max_participants: opts.maxParticipants ?? 6,
        enable_chat: true,
        enable_people_ui: true,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
        enable_prejoin_ui: true,
      },
    }),
  })

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { message: text }
  }
  if (!res.ok) {
    throw new Error(`Daily room create failed (${res.status}): ${JSON.stringify(data)}`)
  }
  return data as DailyRoomResponse
}
