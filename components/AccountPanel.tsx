'use client'

import CircleAccountPanel from './CircleAccountPanel'
import type { ProfileIdentity } from '@/lib/client-profile'

export default function AccountPanel({
  initialIdentity = null,
}: {
  initialIdentity?: ProfileIdentity | null
}) {
  return <CircleAccountPanel initialIdentity={initialIdentity} />
}
