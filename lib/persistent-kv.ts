import { env } from './env'

type RedisValue = string | number | null | RedisValue[] | { [key: string]: RedisValue }

function kvConfig(): { url: string; token: string } | null {
  const url = env.optionalKvRestApiUrl()
  const token = env.optionalKvRestApiToken()
  return url && token ? { url, token } : null
}

export function hasPersistentKv(): boolean {
  return Boolean(kvConfig())
}

export async function kvCommand<T = RedisValue>(
  command: Array<string | number>,
): Promise<T | null> {
  const config = kvConfig()
  if (!config) return null

  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  })

  const text = await res.text()
  let payload: { result?: T; error?: string } = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`KV returned a non-JSON response: ${text.slice(0, 120)}`)
  }

  if (!res.ok || payload.error) {
    throw new Error(payload.error || `KV command failed with HTTP ${res.status}`)
  }

  return payload.result ?? null
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvCommand<string>(['GET', key])
  if (!raw) return null
  return JSON.parse(raw) as T
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kvCommand(['SET', key, JSON.stringify(value)])
}
