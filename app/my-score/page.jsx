'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

function pointsColor(points) {
  if (points > 0) return 'text-green-600'
  if (points < 0) return 'text-red-500'
  return 'text-gray-500'
}

function pointsDisplay(points) {
  return `${points}`
}

function toParDisplay(n) {
  if (n === null || n === undefined) return '—'
  if (n > 0) return `+${n}`
  if (n === 0) return 'E'
  return `${n}`
}

function toParColor(n) {
  if (n > 0) return '#c0392b'
  if (n < 0) return '#006747'
  return '#555'
}

function ResultBadge({ result, points }) {
  const colors = {
    'Albatross': 'bg-purple-100 text-purple-800',
    'Eagle':     'bg-yellow-100 text-yellow-800',
    'Birdie':    'bg-green-100 text-green-700',
    'Par':       'bg-gray-100 text-gray-600',
    'Bogey':     'bg-orange-100 text-orange-700',
    'Double Bogey':  'bg-red-100 text-red-700',
    'Triple Bogey':  'bg-red-200 text-red-800',
  }
  const cls = colors[result] ?? 'bg-red-200 text-red-800'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {result}
    </span>
  )
}

export default function MyScorePage() {
  const [golferData, setGolferData] = useState([]) // merged picks + scorecard
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openGolfer, setOpenGolfer] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const [{ data: picks }, { data: golfers }, scorecardRes] = await Promise.all([
        supabase.from('picks').select('golfer_id').eq('user_id', user.id),
        supabase.from('golfers').select('*'),
        fetch('/api/scorecard'),
      ])

      const pickedIds = new Set((picks ?? []).map(p => p.golfer_id))
      const myGolfers = (golfers ?? []).filter(g => pickedIds.has(g.id))

      if (myGolfers.length === 0) {
        setError('You have no picks yet. Head to the picks page to select your golfers.')
        setLoading(false)
        return
      }

      let scorecardPlayers = []
      if (scorecardRes.ok) {
        const json = await scorecardRes.json()
        scorecardPlayers = json.players ?? []
      }

      // Match each picked golfer to their ESPN scorecard data
      const merged = myGolfers.map(golfer => {
        const card = scorecardPlayers.find(p =>
          (golfer.espn_id && p.espnId === golfer.espn_id) ||
          p.name.toLowerCase() === golfer.name.toLowerCase()
        )
        return { golfer, card: card ?? null }
      })

      // Sort: highest contest score first (mirrors leaderboard tiebreaker logic)
      merged.sort((a, b) => {
        const aScore = a.card?.totalPoints ?? a.golfer.score ?? 0
        const bScore = b.card?.totalPoints ?? b.golfer.score ?? 0
        return bScore - aScore
      })

      setGolferData(merged)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading scorecard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-gray-500 text-center">{error}</p>
        </div>
      </div>
    )
  }

  // Determine which golfer is currently the tiebreaker (lowest contest score)
  const scores = golferData.map(({ card, golfer }) => card?.totalPoints ?? golfer.score ?? 0)
  const minScore = Math.min(...scores)
  // In case of tie for last, only dim the last one displayed (already sorted best-to-worst)
  const tiebreakerIndex = 4 // index 4 and 5 are tiebreakers

  const teamTotal = scores.slice(0, 4).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ color: '#006747' }}>My Score</h1>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Team Total</div>
            <div
              className="text-2xl font-bold"
              style={{ color: teamTotal > 0 ? '#006747' : teamTotal < 0 ? '#c0392b' : '#666' }}
            >
              {teamTotal} pts
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-6">
          Golfers sorted best to worst. Your 5th and 6th lowest scorers are automatically tiebreakers.
        </p>

        <div className="space-y-4">
          {golferData.map(({ golfer, card }, index) => {
            const isTiebreaker = index >= tiebreakerIndex
            const contestScore = card?.totalPoints ?? golfer.score ?? 0
            const isOpen = openGolfer === golfer.id
            const hasHoleData = card?.rounds?.some(r => r.holes.length > 0)

            return (
              <div
                key={golfer.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-opacity ${
                  isTiebreaker ? 'opacity-60 border-dashed border-gray-300' : 'border-gray-100'
                }`}
              >
                {/* Golfer header row */}
                <button
                  className="w-full text-left"
                  onClick={() => setOpenGolfer(isOpen ? null : golfer.id)}
                >
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: isTiebreaker ? '#9ca3af' : '#006747', color: '#FFD700' }}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{golfer.name}</span>
                          {isTiebreaker && (
                            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">TB</span>
                          )}
                          {card?.isCut && (
                            <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">CUT</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Tier {golfer.tier}
                          {card?.position && !card.isCut && ` · ${card.position}`}
                          {card?.holesPlayed > 0 && ` · ${card.holesPlayed} holes played`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {card?.scoreToPar !== null && card?.scoreToPar !== undefined && (
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{ color: toParColor(card.scoreToPar) }}>
                            {toParDisplay(card.scoreToPar)}
                          </div>
                          <div className="text-xs text-gray-400">to par</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className={`text-lg font-bold ${pointsColor(contestScore)}`}>
                          {pointsDisplay(contestScore)}
                        </div>
                        <div className="text-xs text-gray-400">pool pts</div>
                      </div>
                      <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {/* Hole-by-hole breakdown */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    {!hasHoleData ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        Hole-by-hole data not yet available.
                      </p>
                    ) : (
                      card.rounds.map(({ round, holes, roundPoints }) => (
                        holes.length === 0 ? null : (
                          <div key={round} className="mb-5 last:mb-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                Round {round}
                              </span>
                              <span className={`text-xs font-bold ${pointsColor(roundPoints)}`}>
                                {pointsDisplay(roundPoints)} pts this round
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                                    <th className="text-left py-1 pr-3 font-medium">Hole</th>
                                    <th className="text-center py-1 pr-3 font-medium">Par</th>
                                    <th className="text-center py-1 pr-3 font-medium">Score</th>
                                    <th className="text-left py-1 pr-3 font-medium">Result</th>
                                    <th className="text-right py-1 font-medium">Pts</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {holes.map(({ hole, par, strokes, result, points }) => (
                                    <tr key={hole} className="hover:bg-gray-50">
                                      <td className="py-1.5 pr-3 font-medium text-gray-700">{hole}</td>
                                      <td className="py-1.5 pr-3 text-center text-gray-500">{par}</td>
                                      <td className="py-1.5 pr-3 text-center font-bold text-gray-800">{strokes}</td>
                                      <td className="py-1.5 pr-3">
                                        <ResultBadge result={result} points={points} />
                                      </td>
                                      <td className={`py-1.5 text-right font-bold ${pointsColor(points)}`}>
                                        {pointsDisplay(points)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-200">
                                    <td colSpan={4} className="py-1.5 text-xs text-gray-500 font-medium">Round {round} total</td>
                                    <td className={`py-1.5 text-right font-bold ${pointsColor(roundPoints)}`}>
                                      {pointsDisplay(roundPoints)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Scoring key */}
        <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2">Scoring Key</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span><strong className="text-green-600">+8</strong> Albatross+</span>
            <span><strong className="text-green-600">+5</strong> Eagle</span>
            <span><strong className="text-green-600">+2</strong> Birdie</span>
            <span><strong>0</strong> Par</span>
            <span><strong className="text-red-500">−1</strong> Bogey</span>
            <span><strong className="text-red-500">−3</strong> Double+</span>
          </div>
        </div>
      </main>
    </div>
  )
}
