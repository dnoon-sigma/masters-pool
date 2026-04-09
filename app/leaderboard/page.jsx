'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

const REFRESH_INTERVAL = 5 * 60 * 1000

// ─── Shared helpers ────────────────────────────────────────────────────────

function scoreDisplay(n) {
  if (n === null || n === undefined) return '—'
  if (n > 0) return `+${n}`
  if (n === 0) return 'E'
  return `${n}`
}

function scoreColor(n) {
  if (n > 0) return '#c0392b'
  if (n < 0) return '#006747'
  return '#555'
}

function ContestScoreDisplay({ pts }) {
  if (pts === null || pts === undefined) return <span className="text-gray-400">—</span>
  const color = pts > 0 ? '#006747' : pts < 0 ? '#c0392b' : '#555'
  return <span style={{ color }} className="font-bold">{pts} pts</span>
}

function PositionBadge({ pos }) {
  const colors = ['', 'bg-yellow-400 text-yellow-900', 'bg-gray-300 text-gray-800', 'bg-orange-300 text-orange-900']
  const bg = colors[pos] || 'bg-gray-100 text-gray-700'
  return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${bg}`}>{pos}</span>
}

function ResultBadge({ result }) {
  const colors = {
    'Albatross':     'bg-purple-100 text-purple-800',
    'Eagle':         'bg-yellow-100 text-yellow-800',
    'Birdie':        'bg-green-100 text-green-700',
    'Par':           'bg-gray-100 text-gray-600',
    'Bogey':         'bg-orange-100 text-orange-700',
    'Double Bogey':  'bg-red-100 text-red-700',
    'Triple Bogey':  'bg-red-200 text-red-800',
  }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[result] ?? 'bg-red-200 text-red-800'}`}>{result}</span>
}

function HoleByHole({ rounds }) {
  const hasData = rounds?.some(r => r.holes.length > 0)
  if (!hasData) return <p className="text-sm text-gray-400 text-center py-3">Hole-by-hole data not yet available.</p>

  return (
    <div className="space-y-4">
      {rounds.map(({ round, holes, roundScoreToPar, roundPoints }) => (
        holes.length === 0 ? null : (
          <div key={round}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Round {round}</span>
              <div className="flex gap-3 text-xs">
                <span style={{ color: scoreColor(roundScoreToPar) }} className="font-semibold">
                  {scoreDisplay(roundScoreToPar)} golf
                </span>
                <span style={{ color: roundPoints >= 0 ? '#006747' : '#c0392b' }} className="font-semibold">
                  {roundPoints} contest pts
                </span>
              </div>
            </div>
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
                {holes.map(({ hole, par, strokes, result, points, relToPar }) => (
                  <tr key={hole} className="hover:bg-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-700">{hole}</td>
                    <td className="py-1.5 pr-3 text-center text-gray-500">{par}</td>
                    <td className="py-1.5 pr-3 text-center font-bold" style={{ color: scoreColor(relToPar) }}>{strokes}</td>
                    <td className="py-1.5 pr-3"><ResultBadge result={result} /></td>
                    <td className="py-1.5 text-right font-bold" style={{ color: points > 0 ? '#006747' : points < 0 ? '#c0392b' : '#555' }}>
                      {points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ))}
    </div>
  )
}

// ─── Contestants tab ────────────────────────────────────────────────────────

function ContestantsTab({ teams, golferMap, scorecardByName, pickCounts }) {
  const [expanded, setExpanded] = useState({})

  if (teams.length === 0) {
    return <div className="text-center py-20 text-gray-400">No picks submitted yet.</div>
  }

  return (
    <div className="space-y-3">
      {teams.map((team, index) => {
        const rank = index + 1
        const isOpen = expanded[team.user_id]

        return (
          <div key={team.user_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setExpanded(prev => ({ ...prev, [team.user_id]: !prev[team.user_id] }))}
              style={{ backgroundColor: rank === 1 ? '#006747' : '#f8f8f8', borderBottom: isOpen ? '1px solid #e5e7eb' : 'none' }}
            >
              <div className="flex items-center gap-3">
                <PositionBadge pos={rank} />
                <span className={`font-bold text-base ${rank === 1 ? 'text-white' : 'text-gray-800'}`}>
                  {team.username}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-xl font-bold ${rank === 1 ? 'text-yellow-300' : ''}`}
                  style={rank !== 1 ? { color: team.total > 0 ? '#006747' : team.total < 0 ? '#c0392b' : '#666' } : {}}>
                  {team.total} pts
                </div>
                <span className="text-gray-400 text-sm w-6 text-center">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Golfer grid */}
            {isOpen && (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {team.golferDetails.map(({ golfer, score }, i) => {
                  const isTiebreaker = i >= 4
                  const pct = golfer && teams.length > 0
                    ? Math.round(((pickCounts?.[golfer.id] ?? 0) / teams.length) * 100)
                    : null
                  const card = scorecardByName?.[golfer?.name?.toLowerCase()]
                  const lastActiveRound = card?.rounds?.filter(r => r.holes.length > 0).slice(-1)[0]
                  const thruHoles = lastActiveRound?.holes?.length ?? 0
                  return (
                    <div key={golfer?.id ?? i}
                      className={`rounded-lg p-2 text-center text-xs border ${isTiebreaker ? 'border-dashed border-gray-300 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}
                    >
                      {isTiebreaker && <div className="text-gray-400 mb-1 uppercase tracking-widest text-[10px]">TB</div>}
                      <div className="font-semibold text-gray-800 leading-tight min-h-[2rem] flex items-center justify-center">
                        {golfer?.name ?? '—'}
                      </div>
                      {golfer?.is_cut ? (
                        <div className="text-red-400 font-semibold mt-1">CUT</div>
                      ) : (
                        <div className="mt-1" style={{ color: score > 0 ? '#006747' : score < 0 ? '#c0392b' : '#555' }}>
                          <span className="font-bold">{score}</span>
                        </div>
                      )}
                      {golfer?.position && !golfer.is_cut && (
                        <div className="text-gray-400 text-xs mt-0.5">T{golfer.position}</div>
                      )}
                      {thruHoles > 0 && !golfer?.is_cut && (
                        <div className="mt-1">
                          <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                            Thru {thruHoles === 18 ? 'F' : thruHoles}
                          </span>
                        </div>
                      )}
                      {pct !== null && (
                        <div className="text-gray-400 text-[10px] mt-0.5">{pct}% picked</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Golfers tab ────────────────────────────────────────────────────────────

function GolfersTab({ golfers, scorecardByName, pickCounts, totalTeams }) {
  const [expanded, setExpanded] = useState({})

  if (golfers.length === 0) {
    return <div className="text-center py-20 text-gray-400">No golfer data yet.</div>
  }

  // Merge Supabase golfer list with ESPN scorecard data
  const merged = golfers.map(g => {
    const card = scorecardByName[g.name.toLowerCase()] ?? null
    return { golfer: g, card }
  })

  // Sort by scoreToPar ascending (lower = better), push cuts to bottom
  merged.sort((a, b) => {
    const aCut = a.golfer.is_cut || a.card?.isCut
    const bCut = b.golfer.is_cut || b.card?.isCut
    if (aCut && !bCut) return 1
    if (!aCut && bCut) return -1
    const aScore = a.card?.scoreToPar
    const bScore = b.card?.scoreToPar
    // Push no-data golfers below those with scores
    if (aScore === null && bScore === null) return 0
    if (aScore === null) return 1
    if (bScore === null) return -1
    return aScore - bScore
  })

  return (
    <div className="space-y-2">
      {merged.map(({ golfer, card }, index) => {
        const isCut = golfer.is_cut || card?.isCut
        const scoreToPar = card?.scoreToPar ?? null
        const holesPlayed = card?.holesPlayed ?? golfer.holes_played ?? 0
        const position = card?.position ?? (golfer.position ? `T${golfer.position}` : null)
        const isOpen = expanded[golfer.id]
        const pct = totalTeams > 0
          ? Math.round(((pickCounts?.[golfer.id] ?? 0) / totalTeams) * 100)
          : null

        return (
          <div key={golfer.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button className="w-full text-left" onClick={() => setExpanded(prev => ({ ...prev, [golfer.id]: !prev[golfer.id] }))}>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 w-8 shrink-0 text-center font-medium">
                    {position ?? index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 truncate">{golfer.name}</span>
                      {isCut && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full shrink-0">CUT</span>}
                      {pct !== null && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{pct}%</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Tier {golfer.tier}
                      {holesPlayed > 0 && ` · ${holesPlayed} holes`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-base" style={{ color: scoreColor(scoreToPar) }}>
                      {scoreDisplay(scoreToPar)}
                    </div>
                    <div className="text-xs text-gray-400">to par</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-base" style={{ color: golfer.score > 0 ? '#006747' : golfer.score < 0 ? '#c0392b' : '#555' }}>
                      {golfer.score}
                    </div>
                    <div className="text-xs text-gray-400">pool pts</div>
                  </div>
                  <span className="text-gray-400 text-sm w-4">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-3">
                <HoleByHole rounds={card?.rounds ?? []} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [tab, setTab] = useState('contestants')
  const [teams, setTeams] = useState([])
  const [pickCounts, setPickCounts] = useState({})
  const [golfers, setGolfers] = useState([])
  const [scorecardByName, setScorecardByName] = useState({})
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    // Fetch settings first to check when scores were last synced
    const { data: settings } = await supabase
      .from('settings').select('last_score_sync').limit(1).single()

    // Auto-sync if last sync was more than 4 minutes ago (or never)
    const lastSyncTime = settings?.last_score_sync ? new Date(settings.last_score_sync) : null
    const staleMs = 4 * 60 * 1000
    if (!lastSyncTime || Date.now() - lastSyncTime.getTime() > staleMs) {
      fetch('/api/sync-scores', { method: 'POST' }).catch(() => {})
    }

    const [{ data: golfersData }, { data: picks }, { data: profiles }, scorecardRes] = await Promise.all([
      supabase.from('golfers').select('*'),
      supabase.from('picks').select('user_id, golfer_id, slot'),
      supabase.from('profiles').select('user_id, username'),
      fetch('/api/scorecard'),
    ])

    setGolfers(golfersData || [])

    if (settings?.last_score_sync) setLastSync(new Date(settings.last_score_sync))

    // Build scorecard lookup by lowercase name
    const cardMap = {}
    if (scorecardRes.ok) {
      const { players } = await scorecardRes.json()
      ;(players ?? []).forEach(p => { cardMap[p.name.toLowerCase()] = p })
    }
    setScorecardByName(cardMap)

    // Build golfer map
    const gMap = {}
    ;(golfersData || []).forEach(g => { gMap[g.id] = g })

    const profileMap = {}
    ;(profiles || []).forEach(p => { profileMap[p.user_id] = p.username })

    // Build pick counts per golfer
    const counts = {}
    ;(picks || []).forEach(({ golfer_id }) => {
      counts[golfer_id] = (counts[golfer_id] || 0) + 1
    })
    setPickCounts(counts)

    // Build teams
    const teamMap = {}
    ;(picks || []).forEach(({ user_id, golfer_id }) => {
      if (!teamMap[user_id]) teamMap[user_id] = { user_id, username: profileMap[user_id] || 'Unknown', golferIds: [] }
      teamMap[user_id].golferIds.push(golfer_id)
    })

    const scored = Object.values(teamMap).map(team => {
      const golferDetails = team.golferIds.map(id => {
        const g = gMap[id]
        return { golfer: g, score: g?.score ?? 0 }
      })
      golferDetails.sort((a, b) => b.score - a.score)
      const total = golferDetails.slice(0, 4).reduce((sum, { score }) => sum + score, 0)
      const tiebreakerScore = golferDetails[4]?.score ?? 0
      return { ...team, total, golferDetails, tiebreakerScore }
    })

    scored.sort((a, b) => b.total !== a.total ? b.total - a.total : b.tiebreakerScore - a.tiebreakerScore)
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
    return () => { clearInterval(refreshTimer); clearInterval(countdownTimer) }
  }, [loadData])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-2">
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {[
            { key: 'contestants', label: 'Contestants' },
            { key: 'golfers', label: 'Masters Field' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === key ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={tab === key ? { borderColor: '#006747', color: '#006747' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Loading...</div>
        ) : tab === 'contestants' ? (
          <>
            <ContestantsTab teams={teams} golferMap={{}} scorecardByName={scorecardByName} pickCounts={pickCounts} />
            <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
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
                Team score = best 4 of 6 golfers. Your 5th and 6th lowest scorers are tiebreakers (TB).
              </p>
            </div>
          </>
        ) : (
          <GolfersTab golfers={golfers} scorecardByName={scorecardByName} pickCounts={pickCounts} totalTeams={teams.length} />
        )}
      </main>
    </div>
  )
}
