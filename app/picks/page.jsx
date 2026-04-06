'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

const TIER_LABELS = {
  1: 'Tier 1 — Elite',
  2: 'Tier 2 — Contenders',
  3: 'Tier 3 — Dark Horses',
  4: 'Tier 4 — Veterans',
  5: 'Tier 5 — Longshots',
  6: 'Tier 6 — Tiebreaker',
}

// Slot 6 is tiebreaker; valid submission requires tier sum >= 21
const MIN_TIER_SUM = 21

export default function PicksPage() {
  const [user, setUser] = useState(null)
  const [golfers, setGolfers] = useState([])
  const [existingPicks, setExistingPicks] = useState([]) // [{slot, golfer_id}]
  const [selections, setSelections] = useState({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' })
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
        const sel = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' }
        picksData.forEach(({ slot, golfer_id }) => { sel[slot] = golfer_id })
        setSelections(sel)
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

  const tierSum = () => {
    return [1, 2, 3, 4, 5].reduce((sum, slot) => {
      const g = golfers.find(g => g.id === selections[slot])
      return sum + (g ? g.tier : 0)
    }, 0)
  }

  const pickedGolferIds = Object.values(selections).filter(Boolean)

  const handleSelect = (slot, golferId) => {
    if (locked) return
    setSelections(prev => ({ ...prev, [slot]: golferId }))
    setError('')
  }

  const validate = () => {
    for (let slot = 1; slot <= 6; slot++) {
      if (!selections[slot]) return `Please select a golfer for slot ${slot} (${TIER_LABELS[slot].split('—')[0].trim()}).`
    }
    const ids = Object.values(selections)
    if (new Set(ids).size !== ids.length) return 'You cannot pick the same golfer twice.'
    const sum = tierSum()
    if (sum < MIN_TIER_SUM) return `Your picks (slots 1-5) must have a tier sum of at least ${MIN_TIER_SUM}. Current sum: ${sum}.`
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Delete existing picks and re-insert
      await supabase.from('picks').delete().eq('user_id', user.id)

      const rows = Object.entries(selections).map(([slot, golfer_id]) => ({
        user_id: user.id,
        golfer_id,
        slot: parseInt(slot),
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

  const sum = tierSum()
  const allSelected = [1,2,3,4,5,6].every(s => selections[s])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading golfers...</div>
        </div>
      </div>
    )
  }

  const tierGroups = [1, 2, 3, 4, 5, 6].map(tier => ({
    tier,
    golfers: golfers.filter(g => g.tier === tier),
  }))

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6">
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

        {/* Rules reminder */}
        <div className="bg-white border border-yellow-300 rounded-xl p-4 mb-6 text-sm text-gray-700">
          <p className="font-semibold mb-1" style={{ color: '#006747' }}>Rules</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Select one golfer per slot (tiers 1–6).</li>
            <li>Slots 1–5 must have a combined tier sum of <strong>at least 21</strong>.</li>
            <li>Slot 6 is your <strong>tiebreaker</strong> pick only.</li>
            <li>No duplicate golfers allowed.</li>
          </ul>
        </div>

        {/* Tier sum tracker */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-gray-600">Tier sum (slots 1–5):</span>
          <span
            className="font-bold text-lg px-3 py-0.5 rounded-full"
            style={{
              backgroundColor: sum >= MIN_TIER_SUM ? '#006747' : '#e5e7eb',
              color: sum >= MIN_TIER_SUM ? '#FFD700' : '#374151',
            }}
          >
            {sum} / {MIN_TIER_SUM}
          </span>
          {sum >= MIN_TIER_SUM && <span className="text-green-600 text-sm">✓ Valid</span>}
        </div>

        {/* Tier groups */}
        <div className="space-y-6">
          {tierGroups.map(({ tier, golfers: tierGolfers }) => (
            <div key={tier} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: tier === 6 ? '#4a4a4a' : '#006747' }}
              >
                <span className="text-white font-semibold text-sm">
                  {TIER_LABELS[tier]}
                </span>
                <span className="text-xs rounded-full px-2 py-0.5 bg-white/20 text-white">
                  Slot {tier}
                </span>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {tierGolfers.length === 0 && (
                  <p className="col-span-3 text-gray-400 text-sm text-center py-2">No golfers in this tier yet.</p>
                )}
                {tierGolfers.map(golfer => {
                  const isSelected = selections[tier] === golfer.id
                  const isPickedElsewhere = !isSelected && pickedGolferIds.includes(golfer.id)
                  return (
                    <button
                      key={golfer.id}
                      onClick={() => handleSelect(tier, golfer.id)}
                      disabled={locked || isPickedElsewhere}
                      className={`text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                        isSelected
                          ? 'border-2 text-white font-semibold'
                          : isPickedElsewhere
                          ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-green-500 bg-white'
                      } ${locked ? 'cursor-not-allowed' : ''}`}
                      style={isSelected ? { backgroundColor: '#006747', borderColor: '#FFD700' } : {}}
                    >
                      <span>{golfer.name}</span>
                      {golfer.is_cut && (
                        <span className="ml-2 text-xs text-red-400">CUT</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Save section */}
        {!locked && (
          <div className="mt-8 sticky bottom-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-sm text-gray-600">
                {allSelected
                  ? sum >= MIN_TIER_SUM
                    ? '✅ All picks valid — ready to submit!'
                    : `⚠️ Tier sum too low (${sum}/${MIN_TIER_SUM})`
                  : `Select golfers for all 6 slots.`}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !allSelected}
                className="w-full sm:w-auto px-8 py-3 rounded-lg font-bold text-sm transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#006747', color: '#FFD700' }}
              >
                {saving ? 'Saving...' : existingPicks.length ? 'Update Picks' : 'Submit Picks'}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                {success}
              </p>
            )}
          </div>
        )}

        {locked && existingPicks.length > 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-lg mb-3" style={{ color: '#006747' }}>Your Submitted Picks</h2>
            <ul className="space-y-2">
              {[1,2,3,4,5,6].map(slot => {
                const golfer = golfers.find(g => g.id === selections[slot])
                return (
                  <li key={slot} className="flex items-center gap-3 text-sm">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: '#006747', color: '#FFD700' }}
                    >
                      {slot}
                    </span>
                    <span>{golfer?.name || '—'}</span>
                    {slot === 6 && <span className="text-gray-400 text-xs">(tiebreaker)</span>}
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
