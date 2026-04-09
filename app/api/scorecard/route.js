import { NextResponse } from 'next/server'

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

const AUGUSTA_PARS = [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4]

function resultName(relToPar) {
  if (relToPar <= -3) return 'Albatross'
  if (relToPar === -2) return 'Eagle'
  if (relToPar === -1) return 'Birdie'
  if (relToPar === 0) return 'Par'
  if (relToPar === 1) return 'Bogey'
  if (relToPar === 2) return 'Double Bogey'
  if (relToPar === 3) return 'Triple Bogey'
  return `+${relToPar}`
}

function contestPoints(relToPar) {
  if (relToPar <= -3) return 8
  if (relToPar === -2) return 5
  if (relToPar === -1) return 2
  if (relToPar === 0) return 0
  if (relToPar === 1) return -1
  return -3
}

export async function GET() {
  try {
    const res = await fetch(ESPN_URL, {
      headers: { 'User-Agent': 'MastersPool/1.0' },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ error: `ESPN API returned ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const events = data?.events ?? []

    const mastersEvent = events.find(e =>
      e.name?.toLowerCase().includes('masters') ||
      e.shortName?.toLowerCase().includes('masters')
    ) ?? events[0]

    const eventName = mastersEvent?.name ?? 'No event'
    const competitors = mastersEvent?.competitions?.[0]?.competitors ?? []

    const players = competitors.map(competitor => {
      const espnId = competitor.id?.toString()
      const name = competitor.athlete?.displayName ?? competitor.athlete?.fullName ?? ''
      const statusType = competitor.status?.type?.name ?? ''
      const isCut = statusType === 'cut' || statusType === 'WD' || statusType === 'DQ'
      const position = competitor.status?.position?.displayText ?? null

      const rounds = (competitor.linescores ?? []).map((round, roundIndex) => {
        const holes = (round.linescores ?? []).map((hole, holeIndex) => {
          const strokes = Number(hole.value)
          if (!strokes || isNaN(strokes)) return null
          const par = hole.par != null ? Number(hole.par) : AUGUSTA_PARS[holeIndex]
          if (!par) return null
          const relToPar = strokes - par
          return {
            hole: holeIndex + 1,
            par,
            strokes,
            relToPar,
            result: resultName(relToPar),
            points: contestPoints(relToPar),
          }
        }).filter(Boolean)

        const roundPoints = holes.reduce((sum, h) => sum + h.points, 0)
        const roundScoreToPar = holes.reduce((sum, h) => sum + h.relToPar, 0)
        return { round: roundIndex + 1, holes, roundPoints, roundScoreToPar }
      })

      const totalPoints = rounds.reduce((sum, r) => sum + r.roundPoints, 0)
      const holesPlayed = rounds.reduce((sum, r) => sum + r.holes.length, 0)
      const scoreToPar = holesPlayed > 0
        ? rounds.reduce((sum, r) => sum + r.roundScoreToPar, 0)
        : null

      return { espnId, name, isCut, position, rounds, totalPoints, scoreToPar, holesPlayed }
    })

    return NextResponse.json({ players, eventName })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
