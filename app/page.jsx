'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function Countdown({ deadline }) {
  const [timeLeft, setTimeLeft] = useState(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!deadline) return

    function update() {
      const now = new Date()
      const diff = deadline - now
      if (diff <= 0) {
        setLocked(true)
        setTimeLeft(null)
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft({ days, hours, minutes, seconds })
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (locked) {
    return (
      <p className="text-white font-semibold text-lg">Picks are locked — the tournament has begun!</p>
    )
  }

  if (!timeLeft) return null

  return (
    <div className="flex gap-4 justify-center flex-wrap">
      {[
        { label: 'Days', value: timeLeft.days },
        { label: 'Hours', value: timeLeft.hours },
        { label: 'Minutes', value: timeLeft.minutes },
        { label: 'Seconds', value: timeLeft.seconds },
      ].map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center rounded-lg px-5 py-3 min-w-[70px]"
          style={{ backgroundColor: '#006747', color: '#FFD700' }}
        >
          <span className="text-3xl font-bold">{String(value).padStart(2, '0')}</span>
          <span className="text-xs uppercase tracking-widest mt-1 text-white">{label}</span>
        </div>
      ))}
    </div>
  )
}

const PICKS_DEADLINE = new Date('2026-04-09T11:30:00Z') // Thursday April 9, 11:30 AM GMT

export default function HomePage() {
  const [user, setUser] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section
        className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20"
        style={{ background: 'linear-gradient(160deg, #004d35 0%, #006747 60%, #1a5c3a 100%)' }}
      >
        <p className="text-sm uppercase tracking-widest mb-3" style={{ color: '#FFD700' }}>
          Augusta National • April 2026
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
          Sigma Masters Pool<br />
          <span style={{ color: '#FFD700' }}>2026</span>
        </h1>
        <p className="text-white/80 text-lg max-w-xl mb-10">
          Choose your fighters in this year's Masters and compete against your fellow Sigmanauts!
        </p>

        <div className="mb-10">
          <p className="text-white/70 text-sm mb-4 uppercase tracking-widest">Picks lock in</p>
          <Countdown deadline={PICKS_DEADLINE} />
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href={user ? '/picks' : '/auth'}
            className="px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: '#FFD700', color: '#006747' }}
          >
            Make Your Picks
          </Link>
          <Link
            href="/leaderboard"
            className="px-8 py-3 rounded-lg font-bold text-lg border-2 border-white text-white transition-transform hover:scale-105"
          >
            View Leaderboard
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10" style={{ color: '#006747' }}>
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Sign Up & Pick',
                desc: 'Create an account and select one golfer from each of 6 tiers before the deadline.',
              },
              {
                step: '2',
                title: 'Watch & Score',
                desc: 'Tune in to free coverage of every golfer and every hole on the official Masters website.',
              },
              {
                step: '3',
                title: 'Win the Pool',
                desc: 'Your score is the sum of your best 4 of 6 golfers. Your 5th and 6th lowest scorers are automatic tiebreakers.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4"
                  style={{ backgroundColor: '#006747', color: '#FFD700' }}
                >
                  {step}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: '#006747' }}>{title}</h3>
                <p className="text-gray-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring table */}
      <section style={{ backgroundColor: '#f9f6f0' }} className="py-16 px-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ color: '#006747' }}>
            Scoring System
          </h2>
          <div className="rounded-xl overflow-hidden shadow border border-gray-200">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#006747', color: 'white' }}>
                <tr>
                  <th className="px-4 py-3 text-left">Result</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  { result: 'Albatross or better', points: '+8' },
                  { result: 'Eagle', points: '+5' },
                  { result: 'Birdie', points: '+2' },
                  { result: 'Par', points: '0' },
                  { result: 'Bogey', points: '−1' },
                  { result: 'Double Bogey or worse', points: '−3' },
                ].map(({ result, points }, i) => (
                  <tr key={result} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">{result}</td>
                    <td
                      className="px-4 py-3 text-right font-bold"
                      style={{ color: points.startsWith('+') ? '#006747' : points === '0' ? '#666' : '#c0392b' }}
                    >
                      {points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer style={{ backgroundColor: '#006747' }} className="text-white/60 text-center text-xs py-4">
        Sigma Masters Pool 2026 — Augusta National Golf Club
      </footer>
    </div>
  )
}
