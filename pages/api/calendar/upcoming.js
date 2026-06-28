import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'

const CAL_BASE = 'https://www.googleapis.com/calendar/v3'

function inferCallType(title) {
  const t = title.toLowerCase()
  if (/\bintro\b|introduction|inaugural/.test(t)) return 'Intro Call'
  if (/\bdemo\b/.test(t)) return 'Demo'
  if (/discovery/.test(t)) return 'Discovery Call'
  if (/proposal/.test(t)) return 'Proposal Review'
  if (/follow.?up/.test(t)) return 'Follow-Up'
  if (/check.?in/.test(t)) return 'Check-In'
  if (/\bqbr\b/.test(t)) return 'QBR'
  if (/onboarding/.test(t)) return 'Onboarding'
  if (/renewal/.test(t)) return 'Renewal Discussion'
  if (/debrief/.test(t)) return 'Debrief'
  return null
}

function domainToCompany(email) {
  const domain = email?.split('@')[1] || ''
  const base = domain.replace(/\.(com|org|net|io|co|gov|edu)(\.[a-z]{2})?$/, '')
  const parts = base.split('.')
  return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function fuzzyMatchAccount(title, accounts) {
  if (!title || !accounts?.length) return null
  const titleLower = title.toLowerCase()
  let best = null
  let bestScore = 0
  for (const acc of accounts) {
    const nameLower = acc.name.toLowerCase()
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2)
    let score = 0
    if (titleLower.includes(nameLower)) score = 100
    else if (nameLower.includes(titleLower)) score = 90
    else {
      for (const word of nameWords) {
        if (titleLower.includes(word)) score += 20
      }
    }
    if (score > bestScore) { bestScore = score; best = acc }
  }
  return bestScore >= 15 ? best : null
}

const GENERIC_DOMAINS = new Set(['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'protonmail'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Google token required' })

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()

  try {
    const now = new Date()
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    // Reach 24h into the past too, so meetings that just ended can trigger a follow-up task.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const params = new URLSearchParams({
      timeMin: oneDayAgo.toISOString(),
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
    if (!calRes.ok) throw new Error(`Calendar API error: ${calRes.status}`)

    const data = await calRes.json()
    const items = data.items || []

    const rawEvents = items
      .filter(e => {
        if (!e.start?.dateTime) return false
        const myResponse = e.attendees?.find(a => a.self)?.responseStatus
        return myResponse !== 'declined'
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
        return {
          id: e.id,
          rawTitle: e.summary || 'Untitled meeting',
          description: e.description?.slice(0, 300) || null,
          start: e.start.dateTime,
          end: e.end.dateTime,
          durationMin: Math.round((endDt - startDt) / 60000),
          hoursUntil: Math.round((startDt - now) / (1000 * 60 * 60)),
          location: e.location || null,
          meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri || null,
          externalAttendees: externalAttendees.map(a => ({ name: a.displayName || a.email, email: a.email })),
          internalAttendees: internalAttendees.map(a => ({ name: a.displayName || a.email, email: a.email })),
          isExternalMeeting: externalAttendees.length > 0,
        }
      })

    const externalEvents = rawEvents.filter(e => e.isExternalMeeting)
    const internalMeetings = rawEvents.filter(e => !e.isExternalMeeting).map(({ rawTitle, ...e }) => ({
      ...e, title: rawTitle,
    }))

    if (externalEvents.length === 0) {
      return res.status(200).json({ salesMeetings: [], internalMeetings, total: rawEvents.length })
    }

    // Collect all external emails for stakeholder lookup
    const allExternalEmails = [...new Set(
      externalEvents.flatMap(e => e.externalAttendees.map(a => a.email).filter(Boolean))
    )]

    const [stakeholderRes, accountsRes] = await Promise.all([
      allExternalEmails.length
        ? db.from('stakeholders').select('email, account_id').in('email', allExternalEmails)
        : Promise.resolve({ data: [] }),
      db.from('accounts')
        .select('id, name, stage, user_id, owner_name')
        .not('stage', 'in', '(closed_won,closed_lost)')
        .limit(300),
    ])

    // email → account_id from stakeholders table
    const emailToAccountId = {}
    for (const s of stakeholderRes.data || []) {
      if (s.email && s.account_id) emailToAccountId[s.email] = s.account_id
    }

    const activeAccounts = accountsRes.data || []
    const accountById = Object.fromEntries(activeAccounts.map(a => [a.id, a]))

    const salesMeetings = externalEvents.map(({ rawTitle, ...event }) => {
      let matchedAccount = null

      // 1. Exact email match via stakeholders table
      for (const att of event.externalAttendees) {
        const accId = emailToAccountId[att.email]
        if (accId && accountById[accId]) {
          matchedAccount = accountById[accId]
          break
        }
      }

      // 2. Attendee domain match against account names
      if (!matchedAccount) {
        for (const att of event.externalAttendees) {
          const domainBase = att.email?.split('@')[1]?.split('.')[0]?.toLowerCase()
          if (!domainBase || domainBase.length < 3 || GENERIC_DOMAINS.has(domainBase)) continue
          const found = activeAccounts.find(a =>
            a.name.toLowerCase().includes(domainBase) ||
            domainBase.includes(a.name.toLowerCase().split(/\s+/)[0])
          )
          if (found) { matchedAccount = found; break }
        }
      }

      // 3. Fuzzy title match against account names
      if (!matchedAccount) {
        matchedAccount = fuzzyMatchAccount(rawTitle, activeAccounts)
      }

      // Build enriched title
      const callType = inferCallType(rawTitle)
      let title = rawTitle
      if (matchedAccount) {
        title = callType ? `${matchedAccount.name} ${callType}` : matchedAccount.name
      } else if (!callType && event.externalAttendees.length === 1) {
        const email = event.externalAttendees[0].email
        const domainBase = email?.split('@')[1]?.split('.')[0]
        if (domainBase && !GENERIC_DOMAINS.has(domainBase)) {
          const companyName = domainToCompany(email)
          title = callType ? `${companyName} ${callType}` : `Meeting with ${companyName}`
        }
      } else if (callType && event.externalAttendees.length === 1) {
        const email = event.externalAttendees[0].email
        const domainBase = email?.split('@')[1]?.split('.')[0]
        if (domainBase && !GENERIC_DOMAINS.has(domainBase)) {
          title = `${domainToCompany(email)} ${callType}`
        }
      }

      const isOwned = !matchedAccount || matchedAccount.user_id === user.id
      const transferredTo = !isOwned ? (matchedAccount.owner_name || 'another rep') : null

      return {
        ...event,
        title,
        originalTitle: title !== rawTitle ? rawTitle : null,
        matchedAccount: matchedAccount
          ? { id: matchedAccount.id, name: matchedAccount.name, stage: matchedAccount.stage }
          : null,
        isOwned,
        transferredTo,
        needsPrep: isOwned && event.externalAttendees.length > 0 && new Date(event.start) > now && event.hoursUntil <= 48,
        needsFollowup: isOwned && event.externalAttendees.length > 0 && new Date(event.end) < now && (now - new Date(event.end)) / 3600000 <= 24,
      }
    })

    return res.status(200).json({ salesMeetings, internalMeetings, total: rawEvents.length })
  } catch (err) {
    console.error('Calendar upcoming error:', err)
    return res.status(500).json({ error: err.message })
  }
}
