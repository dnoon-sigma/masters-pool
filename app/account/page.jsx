'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

export default function AccountPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Username
  const [username, setUsername] = useState('')
  const [usernameMsg, setUsernameMsg] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)

  // Email
  const [email, setEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single()

      if (profile) setUsername(profile.username)
      setLoading(false)
    }
    load()
  }, [])

  const saveUsername = async () => {
    setUsernameMsg('')
    if (!username.trim()) { setUsernameMsg('Username cannot be empty.'); return }
    if (username.trim().length < 3) { setUsernameMsg('Username must be at least 3 characters.'); return }

    setSavingUsername(true)
    try {
      // Check uniqueness (excluding current user)
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('user_id', user.id)
        .maybeSingle()

      if (existing) { setUsernameMsg('That username is already taken.'); return }

      const { error } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('user_id', user.id)

      if (error) throw error
      setUsernameMsg('Username updated!')
    } catch (err) {
      setUsernameMsg('Error: ' + err.message)
    } finally {
      setSavingUsername(false)
    }
  }

  const saveEmail = async () => {
    setEmailMsg('')
    if (!email.trim()) { setEmailMsg('Email cannot be empty.'); return }

    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() })
      if (error) throw error
      setEmailMsg('Confirmation email sent. Check your inbox to verify the new address.')
    } catch (err) {
      setEmailMsg('Error: ' + err.message)
    } finally {
      setSavingEmail(false)
    }
  }

  const savePassword = async () => {
    setPasswordMsg('')
    if (!newPassword) { setPasswordMsg('Please enter a new password.'); return }
    if (newPassword.length < 6) { setPasswordMsg('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordMsg('Passwords do not match.'); return }

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMsg('Password updated successfully!')
    } catch (err) {
      setPasswordMsg('Error: ' + err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
        <h1 className="text-3xl font-bold mb-8" style={{ color: '#006747' }}>Account Settings</h1>

        <div className="space-y-6">

          {/* Username */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-lg mb-4" style={{ color: '#006747' }}>Username</h2>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setUsernameMsg('') }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 mb-3"
              placeholder="Your username"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveUsername}
                disabled={savingUsername}
                className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: '#006747', color: '#FFD700' }}
              >
                {savingUsername ? 'Saving...' : 'Save Username'}
              </button>
              {usernameMsg && (
                <span className={`text-sm ${usernameMsg.startsWith('Error') || usernameMsg.includes('taken') ? 'text-red-600' : 'text-green-700'}`}>
                  {usernameMsg}
                </span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-lg mb-4" style={{ color: '#006747' }}>Email Address</h2>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailMsg('') }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 mb-3"
              placeholder="you@example.com"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveEmail}
                disabled={savingEmail}
                className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: '#006747', color: '#FFD700' }}
              >
                {savingEmail ? 'Saving...' : 'Save Email'}
              </button>
              {emailMsg && (
                <span className={`text-sm ${emailMsg.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
                  {emailMsg}
                </span>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-lg mb-4" style={{ color: '#006747' }}>Change Password</h2>
            <div className="space-y-3 mb-3">
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordMsg('') }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
                placeholder="New password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordMsg('') }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={savePassword}
                disabled={savingPassword}
                className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: '#006747', color: '#FFD700' }}
              >
                {savingPassword ? 'Saving...' : 'Save Password'}
              </button>
              {passwordMsg && (
                <span className={`text-sm ${passwordMsg.startsWith('Error') || passwordMsg.includes('match') ? 'text-red-600' : 'text-green-700'}`}>
                  {passwordMsg}
                </span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
