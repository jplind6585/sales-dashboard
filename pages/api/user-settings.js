// API endpoint for user settings management
// Handles save/retrieve of user preferences like email signature

export default async function handler(req, res) {
  // GET - retrieve settings
  if (req.method === 'GET') {
    // For now, settings are stored client-side in localStorage
    // This endpoint exists for future Supabase migration
    return res.status(200).json({
      success: true,
      message: 'Settings are stored client-side',
    });
  }

  // POST - save settings
  if (req.method === 'POST') {
    const { emailSignature, emailPreferences } = req.body;

    // Validate signature length (prevent abuse)
    if (emailSignature && emailSignature.length > 5000) {
      return res.status(400).json({
        error: 'Signature too long (max 5000 characters)',
      });
    }

    // For now, acknowledge the save (client handles localStorage)
    // When Supabase auth is enabled, we'll save to database here
    return res.status(200).json({
      success: true,
      message: 'Settings saved successfully',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
