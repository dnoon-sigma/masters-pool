'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-gray-400">—</span>
  if (score > 0) return <span className="text-green-600 font-bold">+{score}</span>
  if (score < 0) return <span className="text-red-600 font-bold">{score}</span>
  return <span className="text-gray-600 font-bold">E</span>
}

function PositionBadge({ pos }) {
  const colors = ['', 'bg-yellow-400 text-yellow-900', 'bg-gray-300 text-gray-800', 'bg-orange-300 text-orange-900']
  const bg = colors[pos] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${bg}`}>
      {pos}
    </span>
  )
}

export default function LeaderboardPage() {
  const [teams, setTeams] = useState([])
  const [golferMap, setGolferMap] = useState({})
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: golfers }, { data: picks }, { data: profiles }, { data: settings }] = await Promise.all([
      supabase.from('golfers').select('*'),
      supabase.from('picks').select('user_id, golfer_id, slot'),
      supabase.from('profiles').select('user_id, username'),
      supabase.from('settings').select('last_score_sync').limit(1).single(),
    ])

    // Build golfer lookup
    const gMap = {}
    ;(golfers || []).forEach(g => { gMap[g.id] = g })
    setGolferMap(gMap)

    if (settings?.last_score_sync) setLastSync(new Date(settings.last_score_sync))

    // Build team structures
    const profileMap = {}
    ;(profiles || []).forEach(p => { profileMap[p.user_id] = p.username })

    const teamMap = {}
    ;(picks || []).forEach(({ user_id, golfer_id, slot }) => {
      if (!teamMap[user_id]) teamMap[user_id] = { user_id, username: profileMap[user_id] || 'Unknown', slots: {} }
      teamMap[user_id].slots[slot] = golfer_id
    })

    // Score each team: sum slots 1-5 (slot 6 is tiebreaker only)
    const scored = Object.values(teamMap).map(team => {
      let total = 0
      const pickedGolfers = []
      for (let slot = 1; slot <= 6; slot++) {
        const golferId = team.slots[slot]
        const golfer = gMap[golferId]
        const score = golfer?.score ?? 0
        pickedGolfers.push({ slot, golfer, score })
        if (slot <= 5) total += score
      }
      const tiebreakerScore = gMap[team.slots[6]]?.score ?? 0
      return { ...team, total, pickedGolfers, tiebreakerScore }
    })

    // Sort: highest total first, then tiebreaker descending
    scored.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return b.tiebreakerScore - a.tiebreakerScore
    })

    setTeams(scored)
    setLoading(false)
    setCountdown(REFRESH_INTERVAL / 1000)
  }, [])

  useEffect(() => {
    loadData()

    const refreshTimer = setInterval(loadData, REFRESH_INTERVAL)
    const countdownTimer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL / 1000 : prev - 1))
    }, 1000)

    return () => {
      clearInterval(refreshTimer)
      clearInterval(countdownTimer)
    }
  }, [loadData])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#006747' }}>Leaderboard</h1>
            {lastSync && (
              <p className="text-xs text-gray-500 mt-1">
                Scores last synced: {lastSync.toLocaleTimeString('en-US', { timeStyle: 'short' })}
              </p>
            )}
          </div>
          <div className="text-sm text-gray-500 tabular-nums">
            Refreshes in {minutes}:{String(seconds).padStart(2, '0')}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Loading scores...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No picks submitted yet.</p>
            <p className="text-sm mt-2">Be the first to make your picks!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team, index) => {
              const rank = index + 1
              return (
                <div
                  key={team.user_id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Team header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: rank === 1 ? '#006747' : '#f8f8f8', borderBottom: '1px solid #e5e7eb' }}
                  >
                    <div className="flex items-center gap-3">
                      <PositionBadge pos={rank} />
                      <span
                        className={`font-bold text-base ${rank === 1 ? 'text-white' : 'text-gray-800'}`}
                      >
                        {team.username}
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xl font-bold ${rank === 1 ? 'text-yellow-300' : ''}`}
                        style={rank !== 1 ? { color: team.total > 0 ? '#006747' : team.total < 0 ? '#c0392b' : '#666' } : {}}
                      >
                        {team.total > 0 ? `+${team.total}` : team.total === 0 ? 'E' : team.total} pts
                      </div>
                    </div>
                  </div>

                  {/* Golfer picks grid */}
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {team.pickedGolfers.map(({ slot, golfer, score }) => (
                      <div
                        key={slot}
                        className={`rounded-lg p-2 text-center text-xs border ${
                          slot === 6 ? 'border-dashed border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="text-gray-400 mb-1">
                          {slot === 6 ? 'TB' : `S${slot}`}
                        </div>
                        <div className="font-semibold text-gray-800 leading-tight min-h-[2rem] flex items-center justify-center">
                          {golfer?.name ?? <span className="text-gray-300">—</span>}
                        </div>
                        {golfer?.is_cut ? (
                          <div className="text-red-400 font-semibold mt-1">CUT</div>
                        ) : (
                          <div className="mt-1">
                            <ScoreBadge score={slot <= 5 ? score : null} />
                            {slot === 6 && golfer && (
                              <span className="text-gray-400">
                                <ScoreBadge score={score} />
                              </span>
                            )}
                          </div>
                        )}
                        {golfer?.position && !golfer.is_cut && (
                          <div className="text-gray-400 text-xs mt-0.5">T{golfer.position}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Scoring legend */}
        <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">Scoring</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span><strong className="text-green-600">+8</strong> Albatross+</span>
            <span><strong className="text-green-600">+5</strong> Eagle</span>
            <span><strong className="text-green-600">+2</strong> Birdie</span>
            <span><strong>0</strong> Par</span>
            <span><strong className="text-red-500">−1</strong> Bogey</span>
            <span><strong className="text-red-500">−3</strong> Double+</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Scores reflect slots 1–5. Slot 6 (TB) is tiebreaker only.
          </p>
        </div>
      </main>
    </div>
  )
}
