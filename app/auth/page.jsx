'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

export default function AuthPage() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [sendingReset, setSendingReset] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotMsg('')
    if (!forgotEmail.trim()) { setForgotMsg('Please enter your email.'); return }
    setSendingReset(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setForgotMsg('Check your email for a password reset link.')
    } catch (err) {
      setForgotMsg('Error: ' + err.message)
    } finally {
      setSendingReset(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!username.trim()) {
          setError('Username is required.')
          return
        }
        if (username.trim().length < 3) {
          setError('Username must be at least 3 characters.')
          return
        }

        // Check username uniqueness
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim())
          .maybeSingle()

        if (existing) {
          setError('That username is already taken.')
          return
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            user_id: data.user.id,
            username: username.trim(),
            is_admin: false,
          })
          if (profileError) throw profileError
        }

        setSuccess('Account created! Redirecting to picks...')
        setTimeout(() => router.push('/picks'), 1500)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        router.push('/picks')
        router.refresh()
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f6f0' }}>
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 text-center" style={{ backgroundColor: '#006747' }}>
              <h1 className="text-2xl font-bold text-white">Sigma Masters Pool 2026</h1>
              <p className="text-sm mt-1" style={{ color: '#FFD700' }}>
                {mode === 'signin' ? 'Sign in to manage your picks' : 'Create your account'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {['signin', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); setSuccess('') }}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    mode === m
                      ? 'border-b-2 text-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={mode === m ? { borderColor: '#006747', color: '#006747' } : {}}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. tiger_fan_99"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': '#006747' }}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotMsg('') }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-sm transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#006747', color: '#FFD700' }}
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Forgot password overlay */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg mb-1" style={{ color: '#006747' }}>Reset Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
                required
              />
              {forgotMsg && (
                <p className={`text-sm px-3 py-2 rounded-lg border ${forgotMsg.startsWith('Error') ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
                  {forgotMsg}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={sendingReset}
                  className="flex-1 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#006747', color: '#FFD700' }}
                >
                  {sendingReset ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setForgotMsg('') }}
                  className="flex-1 py-2 rounded-lg font-bold text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
