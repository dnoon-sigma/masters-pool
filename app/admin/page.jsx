'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Settings state
  const [tournamentActive, setTournamentActive] = useState(false)
  const [settingsId, setSettingsId] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')

  // Golfers state
  const [golfers, setGolfers] = useState([])
  const [newGolfer, setNewGolfer] = useState({ name: '', tier: 1, espn_id: '' })
  const [addingGolfer, setAddingGolfer] = useState(false)
  const [golferMsg, setGolferMsg] = useState('')
  const [editingGolfer, setEditingGolfer] = useState(null)

  // Picks view
  const [allPicks, setAllPicks] = useState([])
  const [profiles, setProfiles] = useState({})

  // Score sync
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

      if (!profile?.is_admin) { router.push('/'); return }
      setIsAdmin(true)

      await Promise.all([loadSettings(), loadGolfers(), loadPicks()])
      setLoading(false)
    }
    load()
  }, [])

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).single()
    if (data) {
      setSettingsId(data.id)
      setTournamentActive(data.tournament_active ?? false)
    }
  }

  const loadGolfers = async () => {
    const { data } = await supabase.from('golfers').select('*').order('tier').order('name')
    setGolfers(data || [])
  }

  const loadPicks = async () => {
    const [{ data: picks }, { data: profilesData }, { data: golfers }] = await Promise.all([
      supabase.from('picks').select('user_id, golfer_id, slot'),
      supabase.from('profiles').select('user_id, username'),
      supabase.from('golfers').select('id, name'),
    ])
    const pMap = {}
    ;(profilesData || []).forEach(p => { pMap[p.user_id] = p.username })
    setProfiles(pMap)

    const gMap = {}
    ;(golfers || []).forEach(g => { gMap[g.id] = g.name })

    // Group picks by user
    const userPicks = {}
    ;(picks || []).forEach(({ user_id, golfer_id, slot }) => {
      if (!userPicks[user_id]) userPicks[user_id] = {}
      userPicks[user_id][slot] = gMap[golfer_id] || golfer_id
    })
    setAllPicks(Object.entries(userPicks).map(([user_id, slots]) => ({ user_id, slots })))
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setSettingsMsg('')
    try {
      const payload = {
        tournament_active: tournamentActive,
      }
      if (settingsId) {
        const { error } = await supabase.from('settings').update(payload).eq('id', settingsId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('settings').insert(payload)
        if (error) throw error
      }
      setSettingsMsg('Settings saved.')
    } catch (err) {
      setSettingsMsg('Error: ' + err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const addGolfer = async () => {
    if (!newGolfer.name.trim()) { setGolferMsg('Name is required.'); return }
    setAddingGolfer(true)
    setGolferMsg('')
    try {
      const { error } = await supabase.from('golfers').insert({
        name: newGolfer.name.trim(),
        tier: parseInt(newGolfer.tier),
        espn_id: newGolfer.espn_id.trim() || null,
        score: 0,
        is_cut: false,
        holes_played: 0,
      })
      if (error) throw error
      setNewGolfer({ name: '', tier: 1, espn_id: '' })
      setGolferMsg('Golfer added.')
      await loadGolfers()
    } catch (err) {
      setGolferMsg('Error: ' + err.message)
    } finally {
      setAddingGolfer(false)
    }
  }

  const saveGolferEdit = async (golfer) => {
    const { error } = await supabase
      .from('golfers')
      .update({ name: golfer.name, tier: parseInt(golfer.tier), espn_id: golfer.espn_id })
      .eq('id', golfer.id)
    if (!error) {
      setEditingGolfer(null)
      await loadGolfers()
    }
  }

  const deleteGolfer = async (id) => {
    if (!confirm('Delete this golfer?')) return
    await supabase.from('golfers').delete().eq('id', id)
    await loadGolfers()
  }

  const triggerSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync-scores', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      setSyncMsg(`Sync complete. ${json.updated ?? 0} golfers updated.`)
      await loadGolfers()
    } catch (err) {
      setSyncMsg('Error: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading admin...</div>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold" style={{ color: '#006747' }}>Admin Panel</h1>

        {/* Settings */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: '#006747' }}>Tournament Settings</h2>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tournamentActive}
                onChange={e => setTournamentActive(e.target.checked)}
                className="w-4 h-4 accent-green-700"
                />
                <span className="text-sm font-medium text-gray-700">Tournament Active (locks picks)</span>
              </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#006747', color: '#FFD700' }}
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
            {settingsMsg && <span className="text-sm text-gray-600">{settingsMsg}</span>}
          </div>
        </section>

        {/* Score Sync */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-lg mb-2" style={{ color: '#006747' }}>Score Sync</h2>
          <p className="text-sm text-gray-600 mb-4">
            Fetches live scores from the ESPN golf API and recalculates points for all golfers.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#006747', color: '#FFD700' }}
            >
              {syncing ? 'Syncing...' : 'Trigger Score Sync'}
            </button>
            {syncMsg && <span className="text-sm text-gray-600">{syncMsg}</span>}
          </div>
        </section>

        {/* Golfer Management */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: '#006747' }}>Golfer Management</h2>

          {/* Add golfer form */}
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <input
              placeholder="Golfer name"
              value={newGolfer.name}
              onChange={e => setNewGolfer(prev => ({ ...prev, name: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={newGolfer.tier}
              onChange={e => setNewGolfer(prev => ({ ...prev, tier: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {[1,2,3,4,5,6].map(t => <option key={t} value={t}>Tier {t}</option>)}
            </select>
            <input
              placeholder="ESPN ID (optional)"
              value={newGolfer.espn_id}
              onChange={e => setNewGolfer(prev => ({ ...prev, espn_id: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={addGolfer}
              disabled={addingGolfer}
              className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#006747', color: '#FFD700' }}
            >
              {addingGolfer ? 'Adding...' : '+ Add Golfer'}
            </button>
            {golferMsg && <span className="text-sm text-gray-600">{golferMsg}</span>}
          </div>

          {/* Golfer list */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Tier</th>
                  <th className="pb-2 pr-4">ESPN ID</th>
                  <th className="pb-2 pr-4">Score</th>
                  <th className="pb-2 pr-4">Pos</th>
                  <th className="pb-2 pr-4">Cut</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {golfers.map(golfer => (
                  <tr key={golfer.id}>
                    {editingGolfer?.id === golfer.id ? (
                      <>
                        <td className="py-2 pr-4">
                          <input
                            value={editingGolfer.name}
                            onChange={e => setEditingGolfer(prev => ({ ...prev, name: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <select
                            value={editingGolfer.tier}
                            onChange={e => setEditingGolfer(prev => ({ ...prev, tier: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {[1,2,3,4,5,6].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            value={editingGolfer.espn_id || ''}
                            onChange={e => setEditingGolfer(prev => ({ ...prev, espn_id: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                          />
                        </td>
                        <td className="py-2 pr-4 text-gray-400">{golfer.score ?? 0}</td>
                        <td className="py-2 pr-4 text-gray-400">{golfer.position ?? '—'}</td>
                        <td className="py-2 pr-4">{golfer.is_cut ? 'Yes' : 'No'}</td>
                        <td className="py-2 flex gap-2">
                          <button onClick={() => saveGolferEdit(editingGolfer)} className="text-green-700 font-semibold text-xs">Save</button>
                          <button onClick={() => setEditingGolfer(null)} className="text-gray-500 text-xs">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-4 font-medium">{golfer.name}</td>
                        <td className="py-2 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">T{golfer.tier}</span>
                        </td>
                        <td className="py-2 pr-4 text-gray-500">{golfer.espn_id || '—'}</td>
                        <td className="py-2 pr-4 font-medium" style={{ color: (golfer.score ?? 0) > 0 ? '#006747' : (golfer.score ?? 0) < 0 ? '#c0392b' : '#666' }}>
                          {(golfer.score ?? 0) > 0 ? `+${golfer.score}` : golfer.score ?? 0}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">{golfer.position ?? '—'}</td>
                        <td className="py-2 pr-4">
                          {golfer.is_cut ? <span className="text-red-500 text-xs font-semibold">CUT</span> : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="py-2 flex gap-3">
                          <button onClick={() => setEditingGolfer(golfer)} className="text-blue-600 text-xs">Edit</button>
                          <button onClick={() => deleteGolfer(golfer.id)} className="text-red-500 text-xs">Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {golfers.length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-gray-400 text-sm">No golfers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* All Picks */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-lg mb-4" style={{ color: '#006747' }}>All Submitted Picks</h2>
          {allPicks.length === 0 ? (
            <p className="text-gray-400 text-sm">No picks submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase">
                    <th className="pb-2 pr-4">User</th>
                    {[1,2,3,4,5,6].map(s => (
                      <th key={s} className="pb-2 pr-4">
                        {s === 6 ? 'TB' : `Slot ${s}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allPicks.map(({ user_id, slots }) => (
                    <tr key={user_id}>
                      <td className="py-2 pr-4 font-medium">{profiles[user_id] || 'Unknown'}</td>
                      {[1,2,3,4,5,6].map(s => (
                        <td key={s} className="py-2 pr-4 text-gray-600">{slots[s] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
