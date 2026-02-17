# Deployment Guide - Sales Dashboard

This guide will walk you through deploying your Sales Dashboard to production so your team can access it tomorrow.

## Overview

We'll deploy to:
- **Vercel** - Hosting for the Next.js app (FREE tier is perfect)
- **Supabase** - Database for storing accounts, content, etc. (FREE tier)
- **Google Drive** - Already configured for content storage

---

## Step 1: Create Supabase Project (15 minutes)

### 1.1 Sign Up for Supabase

1. Go to https://supabase.com
2. Click **"Start your project"**
3. Sign in with GitHub (recommended) or email
4. Create a new organization (use your company name)

### 1.2 Create a New Project

1. Click **"New Project"**
2. Fill in:
   - **Name**: `Sales Dashboard` or `Banner Sales Platform`
   - **Database Password**: Generate a strong password and **SAVE IT SECURELY**
   - **Region**: Choose closest to you (e.g., `US East`)
   - **Pricing Plan**: Free (perfect to start)
3. Click **"Create new project"**
4. Wait 2-3 minutes for project to provision

### 1.3 Get Your Supabase Credentials

1. In your Supabase project, click **"Settings"** (gear icon) in sidebar
2. Click **"API"** in the settings menu
3. Copy these values (you'll need them later):
   - **Project URL**: `https://your-project.supabase.co`
   - **anon/public key**: Long string starting with `eyJ...`

**SAVE THESE - YOU'LL NEED THEM IN STEP 3!**

### 1.4 Run Database Migrations

1. In Supabase, click **"SQL Editor"** in the sidebar
2. Click **"New query"**
3. Copy the contents of `supabase/schema.sql` from your project
4. Paste into the SQL editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. You should see "Success" - this creates your accounts, transcripts, etc. tables

7. Create another new query
8. Copy the contents of `supabase/migrations/20260216_content_management.sql`
9. Paste and **"Run"**
10. You should see "Success" - this creates your content management tables

**✅ Supabase is now ready!**

---

## Step 2: Deploy to Vercel (10 minutes)

### 2.1 Sign Up for Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel to access your GitHub account

### 2.2 Import Your Project

1. On the Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find your `sales-dashboard` repository in the list
3. Click **"Import"**
4. **IMPORTANT**: Before clicking "Deploy", we need to add environment variables

### 2.3 Configure Environment Variables

Click **"Environment Variables"** to expand the section.

Add each of these variables (get them from your `.env.local` file):

**Anthropic AI:**
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Supabase** (from Step 1.3):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_USE_SUPABASE=true
```

**Gong API:**
```
GONG_ACCESS_KEY=your_gong_access_key
GONG_SECRET_KEY=your_gong_secret_key
```

**Google Drive API:**
```
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour_private_key_here\n-----END PRIVATE KEY-----\n
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
```

**📝 Copy these from your `.env.local` file!**

**NextAuth** (for Google OAuth):
```
NEXTAUTH_URL=https://your-project.vercel.app
NEXTAUTH_SECRET=your_nextauth_secret_from_env_local
```

**📝 Copy these from your `.env.local` file!**

**IMPORTANT NOTES:**
- For `GOOGLE_PRIVATE_KEY`, make sure to include the `\n` characters (they should be literal backslash-n, not actual newlines)
- For `NEXTAUTH_URL`, you'll need to update this after deployment (see Step 2.5)

### 2.4 Deploy

1. After adding all environment variables, click **"Deploy"**
2. Vercel will build and deploy your app (takes 2-3 minutes)
3. You'll see a success screen with confetti 🎉
4. Click **"Visit"** to see your live site!

### 2.5 Update Google OAuth Redirect URLs

1. Copy your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Select your "Sales Dashboard" project
4. Click on your OAuth client ID
5. Under **"Authorized redirect URIs"**, add:
   - `https://your-project.vercel.app/api/auth/callback/google`
6. Click **"Save"**

7. Back in Vercel, go to your project **Settings** → **Environment Variables**
8. Update `NEXTAUTH_URL` to your actual Vercel URL
9. Click **"Save"**
10. Redeploy: Go to **"Deployments"** tab → Click the three dots on latest deployment → **"Redeploy"**

**✅ Your app is now live!**

---

## Step 3: Test Your Deployment (5 minutes)

### 3.1 Access Your Site

1. Go to your Vercel URL (e.g., `https://sales-dashboard-abc123.vercel.app`)
2. You should see the modules page

### 3.2 Test Core Features

**Test Account Management:**
1. Click "Account Management"
2. Create a test account
3. Upload a sample transcript
4. Verify AI analysis works

**Test Outbound Engine:**
1. Click "Outbound Engine"
2. Browse the sample companies
3. Verify the interface loads

**Test Content Module:**
1. Click "Content"
2. Select a content type
3. Choose an account
4. Generate a preview
5. Verify it works

### 3.3 Test Google Drive Connection

1. In your browser, go to: `https://your-project.vercel.app/api/test-drive-connection`
2. You should see JSON with `"success": true`
3. Check your Google Drive - you should see the folder structure created

---

## Step 4: Share With Your Team (2 minutes)

### 4.1 Get the Production URL

Your Vercel project URL (e.g., `https://sales-dashboard.vercel.app`)

### 4.2 Optional: Set Up Custom Domain

If you want to use your own domain (e.g., `sales.banner.com`):

1. In Vercel, go to **Settings** → **Domains**
2. Add your custom domain
3. Follow the instructions to update your DNS settings
4. Wait for DNS propagation (5-60 minutes)

### 4.3 Share with Team

Send your team:
- The production URL
- Brief instructions on how to use each module
- Link to `TEAM_GUIDE_GONG_WORKFLOW.md` for the Gong workflow

---

## Troubleshooting

### "Error connecting to database"
- Check your Supabase credentials in Vercel environment variables
- Make sure you ran both SQL migrations in Supabase

### "Google Drive API error"
- Verify the service account has access to your Google Drive folder
- Check that `GOOGLE_PRIVATE_KEY` includes the `\n` characters
- Make sure you're using the correct folder ID

### "OAuth error" when logging in
- Make sure you added the Vercel URL to Google Cloud Console authorized redirect URIs
- Verify `NEXTAUTH_URL` in Vercel matches your deployment URL
- Redeploy after changing environment variables

### "AI analysis not working"
- Check your Anthropic API key is correct
- Verify the API key has sufficient credits

### Build fails in Vercel
- Check the build logs in Vercel
- Common issue: Missing dependencies (Vercel will auto-install from package.json)
- If needed, redeploy from the Deployments tab

---

## Post-Deployment Maintenance

### Weekly
- Check Vercel deployment logs for errors
- Review Supabase database usage (free tier has limits)
- Monitor Google Drive storage

### Monthly
- Review Anthropic API usage/costs
- Archive old content using the built-in archive system
- Update dependencies: `npm outdated` then `npm update`

### When Adding New Features
1. Develop and test locally
2. Commit to GitHub: `git add . && git commit -m "description" && git push`
3. Vercel automatically deploys from main branch
4. If you need new environment variables, add them in Vercel Settings

---

## Production URLs Checklist

- [ ] Vercel app URL: `_______________________`
- [ ] Supabase project URL: `_______________________`
- [ ] Google Drive folder: `_______________________`
- [ ] GitHub repo: `https://github.com/jplind6585/sales-dashboard`

---

## Security Notes

**DO NOT SHARE:**
- `.env.local` file (contains secrets)
- Supabase database password
- Google service account JSON file
- Anthropic API key

**SAFE TO SHARE:**
- Vercel deployment URL
- Public-facing documentation
- User guides

---

## Support

If you run into issues:
1. Check Vercel deployment logs
2. Check Supabase logs (Settings → Logs)
3. Check browser console for errors (F12)
4. Review this guide's Troubleshooting section

**Need help?** You can always ask me to help debug!

---

## Success! 🎉

Your Sales Dashboard is now live and ready for your team to use tomorrow!

**Next Steps:**
1. Share the URL with your team
2. Give them a quick walkthrough
3. Collect feedback
4. Continue building new features
