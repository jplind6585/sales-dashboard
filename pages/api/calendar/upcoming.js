/**
 * POST /api/calendar/upcoming
 *
 * Fetches the user's Google Calendar events for the next 7 days.
 * For each event with external attendees (non-@withbanner.com),
 * flags it as a "sales meeting" that likely needs prep.
 *
 * Returns structured event list with prep task suggestions.
 */

const CAL_BASE = 'https://www.googleapis.com/calendar/v3'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Google token required' })

  try {
    const now = new Date()
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: sevenDaysOut.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    })

    const calRes = await fetch(`${CAL_BASE}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (calRes.status === 401) {
      return res.status(401).json({ error: 'Google token expired — please refresh the page.' })
    }
    if (!calRes.ok) {
      throw new Error(`Calendar API error: ${calRes.status}`)
    }

    const data = await calRes.json()
    const items = data.items || []

    const events = items
      .filter(e => {
        // Skip all-day events and events you declined
        if (!e.start?.dateTime) return false
        const myResponse = e.attendees?.find(a => a.self)?.responseStatus
        if (myResponse === 'declined') return false
        return true
      })
      .map(e => {
        const attendees = e.attendees || []
        const externalAttendees = attendees.filter(
          a => !a.self && !a.email?.endsWith('@withbanner.com')
        )
        const internalAttendees = attendees.filter(
          a => !a.self && a.email?.endsWith('@withbanner.com')
        )

        const startDt = new Date(e.start.dateTime)
        const endDt = new Date(e.end.dateTime)
        const durationMin = Math.round((endDt - startDt) / 60000)

        // Hoursuntil
        const hoursUntil = Math.round((startDt - now) / (1000 * 60 * 60))

        return {
          id: e.id,
          title: e.summary || 'Untitled meeting',
          start: e.start.dateTime,
          end: e.end.dateTime,
          durationMin,
          hoursUntil,
          location: e.location || null,
          description: e.description?.slice(0, 200) || null,
          meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri || null,
          externalAttendees: externalAttendees.map(a => ({
            name: a.displayName || a.email,
            email: a.email,
          })),
          internalAttendees: internalAttendees.map(a => ({
            name: a.displayName || a.email,
            email: a.email,
          })),
          isExternalMeeting: externalAttendees.length > 0,
          // Suggest prep task if: external attendees + happening in < 48 hours
          needsPrep: externalAttendees.length > 0 && hoursUntil <= 48,
        }
      })

    // Separate into sales meetings (external) and internal
    const salesMeetings = events.filter(e => e.isExternalMeeting)
    const internalMeetings = events.filter(e => !e.isExternalMeeting)

    return res.status(200).json({
      salesMeetings,
      internalMeetings,
      total: events.length,
    })
  } catch (err) {
    console.error('Calendar upcoming error:', err)
    return res.status(500).json({ error: err.message })
  }
}
