'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

const TIER_LABELS = {
  1: 'Tier 1 — Elite',
  2: 'Tier 2 — Contenders',
  3: 'Tier 3 — Dark Horses',
  4: 'Tier 4 — Solid Picks',
  5: 'Tier 5 — Longshots',
  6: 'Tier 6 — Deep Cuts',
}

const MIN_TIER_SUM = 21
const MAX_PICKS = 6

export default function PicksPage() {
  const [user, setUser] = useState(null)
  const [golfers, setGolfers] = useState([])
  const [existingPicks, setExistingPicks] = useState([])
  // picks is an ordered array of golfer ids, index 0-4 = slots 1-5, index 5 = slot 6 (tiebreaker)
  const [picks, setPicks] = useState([])
  const [locked, setLocked] = useState(false)
  const [deadline, setDeadline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)

      const [{ data: golferData }, { data: picksData }, { data: settingsData }] = await Promise.all([
        supabase.from('golfers').select('*').order('tier').order('name'),
        supabase.from('picks').select('slot, golfer_id').eq('user_id', user.id),
        supabase.from('settings').select('picks_deadline, tournament_active').limit(1).single(),
      ])

      setGolfers(golferData || [])

      if (picksData?.length) {
        setExistingPicks(picksData)
        // Rebuild ordered picks array from saved slots
        const ordered = Array(6).fill(null)
        picksData.forEach(({ slot, golfer_id }) => { ordered[slot - 1] = golfer_id })
        setPicks(ordered.filter(Boolean))
      }

      if (settingsData) {
        const dl = settingsData.picks_deadline ? new Date(settingsData.picks_deadline) : null
        setDeadline(dl)
        if (dl && new Date() > dl) setLocked(true)
        if (settingsData.tournament_active) setLocked(true)
      }

      setLoading(false)
    }
    load()
  }, [])

  const tierSum = picks.reduce((sum, id) => {
    const g = golfers.find(g => g.id === id)
    return sum + (g ? g.tier : 0)
  }, 0)

  const handleToggle = (golferId) => {
    if (locked) return
    setError('')
    setSuccess('')
    if (picks.includes(golferId)) {
      // Deselect
      setPicks(prev => prev.filter(id => id !== golferId))
    } else {
      if (picks.length >= MAX_PICKS) {
        setError('You already have 6 picks. Remove one before adding another.')
        return
      }
      setPicks(prev => [...prev, golferId])
    }
  }

  const removePick = (index) => {
    if (locked) return
    setPicks(prev => prev.filter((_, i) => i !== index))
    setError('')
    setSuccess('')
  }

  const validate = () => {
    if (picks.length < MAX_PICKS) return `Select ${MAX_PICKS - picks.length} more golfer${MAX_PICKS - picks.length > 1 ? 's' : ''}.`
    if (tierSum < MIN_TIER_SUM) return `Tier sum must be at least ${MIN_TIER_SUM}. Current sum: ${tierSum}. Add higher-tier golfers.`
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await supabase.from('picks').delete().eq('user_id', user.id)

      const rows = picks.map((golfer_id, i) => ({
        user_id: user.id,
        golfer_id,
        slot: i + 1,
      }))

      const { error: insertError } = await supabase.from('picks').insert(rows)
      if (insertError) throw insertError

      setSuccess('Picks saved successfully!')
      setExistingPicks(rows)
    } catch (err) {
      setError(err.message || 'Failed to save picks.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-gray-500">Loading golfers...</div>
      </div>
    )
  }

  const tierGroups = [1, 2, 3, 4, 5, 6].map(tier => ({
    tier,
    golfers: golfers.filter(g => g.tier === tier),
  }))

  const isValid = picks.length === MAX_PICKS && tierSum >= MIN_TIER_SUM

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold" style={{ color: '#006747' }}>My Picks</h1>
          {locked ? (
            <p className="text-red-600 mt-1 text-sm font-medium">
              Picks are locked — the tournament is underway or the deadline has passed.
            </p>
          ) : deadline ? (
            <p className="text-gray-600 mt-1 text-sm">
              Deadline: {deadline.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          ) : null}
        </div>

        {/* Rules */}
        <div className="bg-white border border-yellow-300 rounded-xl p-4 mb-5 text-sm text-gray-700">
          <p className="font-semibold mb-1" style={{ color: '#006747' }}>Rules</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Pick <strong>6 golfers</strong> from any tier — no tier restrictions.</li>
            <li>Combined tier values must add up to <strong>at least 21</strong>.</li>
            <li>No duplicate golfers. Your <strong>lowest scorer</strong> at any time is automatically the tiebreaker.</li>
          </ul>
        </div>

        {/* Your Team */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-500">Your Team</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Tier sum:</span>
              <span
                className="font-bold text-sm px-3 py-0.5 rounded-full"
                style={{
                  backgroundColor: tierSum >= MIN_TIER_SUM ? '#006747' : '#e5e7eb',
                  color: tierSum >= MIN_TIER_SUM ? '#FFD700' : '#374151',
                }}
              >
                {tierSum} / {MIN_TIER_SUM}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: MAX_PICKS }).map((_, i) => {
              const golferId = picks[i]
              const golfer = golfers.find(g => g.id === golferId)
              const isTiebreaker = i === 5
              return (
                <div
                  key={i}
                  className={`rounded-lg border-2 px-3 py-2 flex items-center justify-between gap-2 min-h-[44px] ${
                    golfer
                      ? 'border-green-200 bg-green-50'
                      : 'border-dashed border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: '#006747', color: '#FFD700' }}
                    >
                      {i + 1}
                    </span>
                    {golfer ? (
                      <span className="text-sm font-medium text-gray-800 truncate">{golfer.name}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Empty</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {golfer && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">T{golfer.tier}</span>
                    )}
                    {golfer && !locked && (
                      <button
                        onClick={() => removePick(i)}
                        className="text-gray-400 hover:text-red-500 text-xs ml-1 leading-none"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Golfer selection grouped by tier */}
        <div className="space-y-4">
          {tierGroups.map(({ tier, golfers: tierGolfers }) => (
            <div key={tier} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: '#006747' }}>
                <span className="text-white font-semibold text-sm">{TIER_LABELS[tier]}</span>
                <span className="text-xs text-white/70">Tier value: {tier}</span>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {tierGolfers.length === 0 && (
                  <p className="col-span-3 text-gray-400 text-sm text-center py-2">No golfers in this tier yet.</p>
                )}
                {tierGolfers.map(golfer => {
                  const isSelected = picks.includes(golfer.id)
                  const isFull = !isSelected && picks.length >= MAX_PICKS
                  return (
                    <button
                      key={golfer.id}
                      onClick={() => handleToggle(golfer.id)}
                      disabled={locked || isFull}
                      className={`text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                        isSelected
                          ? 'border-2 font-semibold text-white'
                          : isFull
                          ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-green-500 bg-white'
                      }`}
                      style={isSelected ? { backgroundColor: '#006747', borderColor: '#FFD700' } : {}}
                    >
                      {golfer.name}
                      {golfer.is_cut && <span className="ml-1 text-xs text-red-400">CUT</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit bar */}
        {!locked && (
          <div className="mt-8 sticky bottom-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-sm text-gray-600">
                {picks.length < MAX_PICKS
                  ? `Select ${MAX_PICKS - picks.length} more golfer${MAX_PICKS - picks.length > 1 ? 's' : ''}.`
                  : isValid
                  ? '✅ Ready to submit!'
                  : `⚠️ Tier sum too low (${tierSum}/${MIN_TIER_SUM}) — swap in higher-tier picks.`}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !isValid}
                className="w-full sm:w-auto px-8 py-3 rounded-lg font-bold text-sm transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#006747', color: '#FFD700' }}
              >
                {saving ? 'Saving...' : existingPicks.length ? 'Update Picks' : 'Submit Picks'}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}
            {success && (
              <p className="mt-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">{success}</p>
            )}
          </div>
        )}

        {/* Locked view */}
        {locked && picks.length > 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-lg mb-3" style={{ color: '#006747' }}>Your Submitted Picks</h2>
            <ul className="space-y-2">
              {picks.map((golferId, i) => {
                const golfer = golfers.find(g => g.id === golferId)
                return (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: '#006747', color: '#FFD700' }}
                    >
                      {i + 1}
                    </span>
                    <span>{golfer?.name || '—'}</span>
                    <span className="text-gray-400 text-xs">T{golfer?.tier}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
