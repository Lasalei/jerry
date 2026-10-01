import { useState, type ReactNode } from 'react'
import { PrimaryButton, controlClass } from './ui'
import { APP_NAME } from '../lib/constants'

const PASSCODE = import.meta.env.VITE_APP_PASSCODE
const UNLOCK_KEY = 'draktlager_unlocked'

/**
 * Optional shared-passcode gate. If VITE_APP_PASSCODE is unset, renders children
 * directly. Otherwise asks for the passcode once per session. This is a light
 * lock to keep casual visitors out — not real security (the anon key is public).
 */
export function Gate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => !PASSCODE || sessionStorage.getItem(UNLOCK_KEY) === '1',
  )
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (value === PASSCODE) {
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4 text-center">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-kit">
          {APP_NAME}
        </h1>
        <p className="text-sm text-muted">Skriv inn passord for å fortsette</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          placeholder="Passord"
          className={`${controlClass} text-center`}
        />
        {error && <p className="text-sm text-danger">Feil passord</p>}
        <PrimaryButton type="submit">Lås opp</PrimaryButton>
      </form>
    </div>
  )
}
