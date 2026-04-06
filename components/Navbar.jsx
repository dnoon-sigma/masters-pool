'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single()
          .then(({ data }) => setIsAdmin(data?.is_admin ?? false))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsAdmin(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav style={{ backgroundColor: '#006747' }} className="text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-wide" style={{ color: '#FFD700' }}>
          ⛳ Masters Pool 2025
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/leaderboard" className="hover:text-yellow-300 transition-colors">
            Leaderboard
          </Link>
          {user ? (
            <>
              <Link href="/picks" className="hover:text-yellow-300 transition-colors">
                My Picks
              </Link>
              {isAdmin && (
                <Link href="/admin" className="hover:text-yellow-300 transition-colors">
                  Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="hover:text-yellow-300 transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="px-3 py-1 rounded font-semibold transition-colors"
              style={{ backgroundColor: '#FFD700', color: '#006747' }}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
