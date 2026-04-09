import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

/**
 * Calculate pool points from a golfer's hole scores across all rounds.
 * ESPN provides linescores per round, each with a "value" per hole (strokes).
 * We compute score relative to par per hole, then map to pool points.
 */
function pointsForRelativeToPar(relativeToPar) {
  if (relativeToPar <= -3) return 8  // Albatross or better
  if (relativeToPar === -2) return 5  // Eagle
  if (relativeToPar === -1) return 2  // Birdie
  if (relativeToPar === 0) return 0   // Par
  if (relativeToPar === 1) return -1  // Bogey
  return -3                            // Double bogey or worse
}

function calcGolferPoints(competitor) {
  let totalPoints = 0

  const linescores = competitor?.linescores ?? []
  for (const round of linescores) {
    const holes = round?.linescores ?? []
    for (const hole of holes) {
      const strokes = hole.value
      const par = hole.par
      if (strokes == null || par == null || strokes === 0) continue
      const rel = strokes - par
      totalPoints += pointsForRelativeToPar(rel)
    }
  }

  return totalPoints
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

    const updates = []

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

      // Safety check: if somehow a golfer has no name in the DB, skip rather than corrupt
      if (!golfer.name) {
        console.error(`[sync-scores] Skipping golfer id=${golfer.id} — name is null/empty in DB`)
        continue
      }

      const score = calcGolferPoints(competitor)

      // Include ALL fields (id, name, tier, espn_id) so a PUT-style update never
      // overwrites required columns with null
      updates.push({
        id: golfer.id,
        name: golfer.name,
        tier: golfer.tier,
        espn_id: golfer.espn_id ?? null,
        score,
        position: position ? parseInt(position) : null,
        is_cut: isCut,
        holes_played: holesPlayed,
        updated_at: new Date().toISOString(),
      })
    }

    console.log(`[sync-scores] ${updates.length} golfer(s) matched. Sample:`, updates[0] ?? 'none')

    // Update existing golfers one at a time — never insert
    for (const update of updates) {
      const { id, ...fields } = update
      const { error: updateError } = await supabase
        .from('golfers')
        .update(fields)
        .eq('id', id)
      if (updateError) {
        console.error(`[sync-scores] Failed update for "${fields.name}" (id=${id}):`, updateError)
        throw new Error(`Failed to update golfer "${fields.name}": ${updateError.message}`)
      }
    }

    // Update last_score_sync in settings
    await supabase
      .from('settings')
      .update({ last_score_sync: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000') // update all rows

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (err) {
    console.error('sync-scores error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
