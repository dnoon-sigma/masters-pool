'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const router = useRouter()
  const pathname = usePathname()
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

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/leaderboard', label: 'Leaderboard', always: true },
    { href: '/picks', label: 'My Picks', auth: true },
    { href: '/my-score', label: 'My Score', auth: true },
    { href: '/account', label: 'Account', auth: true },
    { href: '/admin', label: 'Admin', admin: true },
  ].filter(link => {
    if (link.admin) return isAdmin
    if (link.auth) return !!user
    return true
  })

  return (
    <nav style={{ backgroundColor: '#006747' }} className="text-white shadow-md relative z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-wide" style={{ color: '#FFD700' }}>
          ⛳ Masters Pool 2026
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-yellow-300 transition-colors">
              {label}
            </Link>
          ))}
          {user ? (
            <button onClick={handleSignOut} className="hover:text-yellow-300 transition-colors">
              Sign Out
            </button>
          ) : (
            <Link href="/auth" className="px-3 py-1 rounded font-semibold transition-colors"
              style={{ backgroundColor: '#FFD700', color: '#006747' }}>
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="sm:hidden" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="flex flex-col gap-1.5 p-1.5"
            aria-label="Menu"
          >
            <span className={`block w-6 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute top-full right-0 w-1/2 shadow-lg rounded-bl-xl"
              style={{ backgroundColor: '#005538' }}
            >
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block px-5 py-3.5 text-sm font-medium border-b border-white/10 hover:bg-white/10 transition-colors"
                >
                  {label}
                </Link>
              ))}
              <div className="px-5 py-3.5">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className="inline-block px-4 py-2 rounded font-semibold text-sm"
                    style={{ backgroundColor: '#FFD700', color: '#006747' }}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
