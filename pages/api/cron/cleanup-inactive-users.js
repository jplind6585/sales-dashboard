/**
 * GET /api/cron/cleanup-inactive-users
 *
 * Deletes Supabase Auth users (and their data) who haven't signed in for 6+ months.
 * Designed to be called by a Vercel cron job — protected by CRON_SECRET.
 *
 * Supabase cascades: deleting auth.users removes the profile and all user data
 * (accounts, tasks, etc.) via foreign key cascades.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Protect with shared secret
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers['authorization']
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key not configured' })
  }

  try {
    // Use the Admin API to list users (requires service role key)
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all users via Supabase Admin API
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    })

    if (!listRes.ok) {
      const err = await listRes.text()
      throw new Error(`Failed to list users: ${err}`)
    }

    const { users } = await listRes.json()

    // Find users inactive for 6+ months
    const toDelete = (users || []).filter(user => {
      const lastSignIn = user.last_sign_in_at
      if (!lastSignIn) {
        // Never signed in — use created_at as proxy
        return user.created_at < sixMonthsAgo
      }
      return lastSignIn < sixMonthsAgo
    })

    const deleted = []
    const errors = []

    for (const user of toDelete) {
      const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      })

      if (delRes.ok) {
        deleted.push({ id: user.id, email: user.email, lastSignIn: user.last_sign_in_at })
      } else {
        const err = await delRes.text()
        errors.push({ id: user.id, email: user.email, error: err })
      }
    }

    console.log(`Cleanup: ${deleted.length} users deleted, ${errors.length} errors`)

    return res.status(200).json({
      success: true,
      deleted: deleted.length,
      errors: errors.length,
      deletedUsers: deleted,
    })
  } catch (err) {
    console.error('Cleanup cron error:', err)
    return res.status(500).json({ error: err.message })
  }
}
