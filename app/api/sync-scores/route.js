import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

// Augusta National hole pars, holes 1–18
const AUGUSTA_PARS = [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4]

function pointsForRelativeToPar(relativeToPar) {
  if (relativeToPar <= -3) return 8  // Albatross or better
  if (relativeToPar === -2) return 5  // Eagle
  if (relativeToPar === -1) return 2  // Birdie
  if (relativeToPar === 0) return 0   // Par
  if (relativeToPar === 1) return -1  // Bogey
  return -3                            // Double bogey or worse
}

function holePar(hole) {
  // Try ESPN's statistics array for a "par" entry
  const parStat = hole.statistics?.find(s => s.name?.toLowerCase() === 'par')
  if (parStat) {
    const v = Number(parStat.value)
    if (v) return v
  }
  // Fall back to Augusta National layout using hole number (period field)
  const holeNum = Number(hole.period)
  if (holeNum >= 1 && holeNum <= 18) return AUGUSTA_PARS[holeNum - 1]
  return null
}

function scoreHoles(holes) {
  let pts = 0
  for (const hole of holes) {
    const strokes = Number(hole.value)
    if (!strokes || isNaN(strokes)) continue
    const par = holePar(hole)
    if (!par) continue
    pts += pointsForRelativeToPar(strokes - par)
  }
  return pts
}

/**
 * Calculate pool points from ESPN competitor data.
 * ESPN returns nested rounds: competitor.linescores = [{ linescores: [hole, …] }, …]
 * Each hole has value (strokes) and a period (hole number 1–18).
 * Par comes from hole.statistics["par"] or from the Augusta National layout.
 */
function calcGolferPoints(competitor) {
  const rounds = competitor?.linescores ?? []
  let pts = 0
  for (const round of rounds) {
    pts += scoreHoles(round.linescores ?? [])
  }
  return pts
}

/**
 * Update a single golfer row using a direct PATCH to PostgREST.
 * Bypasses the supabase-js client to guarantee a partial-column UPDATE
 * with no INSERT path (unlike upsert).
 */
async function patchGolfer(id, fields) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/golfers?id=eq.${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PATCH failed for golfer ${id}: ${body}`)
  }
}

export async function POST(request) {
  try {
    const supabase = createAdminClient()

    // Fetch ESPN scoreboard
    const res = await fetch(ESPN_URL, {
      headers: { 'User-Agent': 'MastersPool/1.0' },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `ESPN API returned ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()

    const events = data?.events ?? []
    if (events.length === 0) {
      return NextResponse.json({ error: 'No events found in ESPN response' }, { status: 422 })
    }

    // Find the Masters specifically — fall back to first event if not found yet
    const mastersEvent = events.find(e =>
      e.name?.toLowerCase().includes('masters') ||
      e.shortName?.toLowerCase().includes('masters')
    ) ?? events[0]

    const eventName = mastersEvent?.name ?? 'Unknown event'
    const competition = mastersEvent?.competitions?.[0]
    const competitors = competition?.competitors ?? []

    if (competitors.length === 0) {
      return NextResponse.json({ error: `No competitors found in "${eventName}"` }, { status: 422 })
    }

    // Fetch all golfers from DB so we can match by espn_id or name
    const { data: golfers, error: fetchError } = await supabase.from('golfers').select('*')
    if (fetchError) throw fetchError

    let updated = 0

    for (const competitor of competitors) {
      const espnId = competitor.id?.toString()
      const athleteName = competitor.athlete?.displayName ?? competitor.athlete?.fullName ?? ''
      const statusType = competitor.status?.type?.name ?? ''
      const isCut = statusType === 'cut' || statusType === 'WD' || statusType === 'DQ'
      const position = competitor.status?.position?.displayText?.replace('T', '') ?? null
      const holesPlayed = competitor.status?.holesPlayed ?? 0

      // Match golfer by espn_id first, then by name
      const golfer =
        golfers.find(g => g.espn_id && g.espn_id === espnId) ||
        golfers.find(g => g.name?.toLowerCase() === athleteName.toLowerCase())

      if (!golfer) continue

      const score = calcGolferPoints(competitor)

      // PATCH score columns + espn_id (if ESPN provided one) so future
      // syncs can match by ID instead of name
      await patchGolfer(golfer.id, {
        ...(espnId ? { espn_id: espnId } : {}),
        score,
        position: position ? parseInt(position) : null,
        is_cut: isCut,
        holes_played: holesPlayed,
        updated_at: new Date().toISOString(),
      })

      updated++
    }

    // Update last_score_sync in settings
    const { error: settingsError } = await supabase
      .from('settings')
      .update({ last_score_sync: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (settingsError) console.error('settings update error:', settingsError)

    // Temporary diagnostic: drill into hole-level data
    const sample = competitors[0]
    const sampleLinescores = sample?.linescores ?? []
    const sampleRound = sampleLinescores[0]
    const sampleHoles = sampleRound?.linescores ?? []
    const sampleHole = sampleHoles[0]
    const debug = {
      topLevelCount: sampleLinescores.length,
      nestedHoleCount: sampleHoles.length,
      roundKeys: Object.keys(sampleRound ?? {}),
      roundValue: sampleRound?.value,
      holeKeys: Object.keys(sampleHole ?? {}),
      holeValue: sampleHole?.value,
      holePeriod: sampleHole?.period,
      holePar: sampleHole?.par,
      holeStatistics: sampleHole?.statistics,
      sampleName: sample?.athlete?.displayName,
      sampleScore: calcGolferPoints(sample),
    }

    return NextResponse.json({ success: true, updated, debug })
  } catch (err) {
    console.error('sync-scores error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
