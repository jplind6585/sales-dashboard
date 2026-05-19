import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { getChannelMessages, deriveChannelName } from '../../../lib/slack'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { channel, accountId } = req.query
  let channelName = channel

  if (!channelName && !accountId) {
    return res.status(400).json({ error: 'Provide channel or accountId' })
  }

  if (accountId) {
    const db = getSupabase()
    const { data: account, error } = await db
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .single()

    if (error || !account) {
      return res.status(404).json({ messages: [], channelName: null, error: 'Account not found' })
    }

    channelName = deriveChannelName(account.name)
    if (!channelName) {
      return res.status(400).json({ messages: [], channelName: null, error: 'Could not derive channel name' })
    }
  }

  try {
    const messages = await getChannelMessages(channelName, 25)
    return res.status(200).json({ messages, channelName })
  } catch (err) {
    return res.status(200).json({ messages: [], channelName, error: err.message })
  }
}
