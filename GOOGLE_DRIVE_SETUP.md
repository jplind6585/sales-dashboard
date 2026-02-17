# Google Drive API Setup Guide

This guide walks you through setting up Google Drive API access for the Sales Dashboard content generation system.

## Prerequisites
- Google Workspace admin access
- Access to Google Cloud Console (free)
- Your Sales shared drive where content will be stored

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your work Google account
3. Click the project dropdown (top left, next to "Google Cloud")
4. Click "NEW PROJECT"
5. Enter project details:
   - **Project name**: `Sales Dashboard` (or your preferred name)
   - **Organization**: Select your company's organization
   - **Location**: Select your organization
6. Click "CREATE"
7. Wait for the project to be created (takes ~30 seconds)
8. Select the new project from the dropdown

---

## Step 2: Enable Google Drive API

1. In your new project, go to "APIs & Services" → "Library"
   - Or use this link: https://console.cloud.google.com/apis/library
2. Search for "Google Drive API"
3. Click on "Google Drive API"
4. Click "ENABLE"
5. Wait for it to enable (takes ~10 seconds)

---

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
   - Or use this link: https://console.cloud.google.com/apis/credentials
2. Click "CREATE CREDENTIALS" (top of page)
3. Select "OAuth client ID"
4. **If you see "Configure consent screen"**, click it and follow these steps:

   ### Configure OAuth Consent Screen
   a. Choose **Internal** (only users in your organization can use it)
   b. Click "CREATE"
   c. Fill in the required fields:
      - **App name**: `Sales Dashboard`
      - **User support email**: Your work email
      - **Developer contact information**: Your work email
   d. Click "SAVE AND CONTINUE"
   e. On "Scopes" page, click "ADD OR REMOVE SCOPES"
   f. Search for and select these scopes:
      - `https://www.googleapis.com/auth/drive.file` (View and manage files created by this app)
      - `https://www.googleapis.com/auth/drive` (See, edit, create, and delete all Google Drive files)
   g. Click "UPDATE" then "SAVE AND CONTINUE"
   h. Skip "Test users" (not needed for Internal apps)
   i. Review and click "BACK TO DASHBOARD"

5. Go back to "Credentials" → "CREATE CREDENTIALS" → "OAuth client ID"
6. Select **Application type**: "Web application"
7. Enter details:
   - **Name**: `Sales Dashboard Web Client`
   - **Authorized JavaScript origins**: Add these URLs (click "+ ADD URI" for each):
     - `http://localhost:3000`
     - `http://127.0.0.1:3000`
     - Add your production URL if you have one deployed
   - **Authorized redirect URIs**: Add these URLs (click "+ ADD URI" for each):
     - `http://localhost:3000/api/auth/callback/google`
     - `http://127.0.0.1:3000/api/auth/callback/google`
     - Add your production callback URL if deployed
8. Click "CREATE"

---

## Step 4: Save Your Credentials

1. A popup will appear with your **Client ID** and **Client Secret**
2. **IMPORTANT**: Copy both of these values immediately
3. Keep this information secure - treat it like a password

**What you need to save**:
```
Client ID: [looks like: 123456789-abc123def456.apps.googleusercontent.com]
Client Secret: [looks like: GOCSPX-abc123def456]
```

---

## Step 5: Create Service Account (for server-side operations)

Service accounts allow the app to access Drive without user interaction.

1. Go to "APIs & Services" → "Credentials"
2. Click "CREATE CREDENTIALS" → "Service account"
3. Enter details:
   - **Service account name**: `sales-dashboard-service`
   - **Service account ID**: (auto-generated)
   - **Description**: "Service account for automated content generation"
4. Click "CREATE AND CONTINUE"
5. Skip "Grant this service account access to project" (click "CONTINUE")
6. Skip "Grant users access to this service account" (click "DONE")

### Create Service Account Key

1. Click on the service account you just created
2. Go to the "KEYS" tab
3. Click "ADD KEY" → "Create new key"
4. Choose **JSON** format
5. Click "CREATE"
6. A JSON file will download - **SAVE THIS FILE SECURELY**

---

## Step 6: Share Your Sales Drive Folder with Service Account

This allows the service account to create and manage files in your shared drive.

1. Open Google Drive and navigate to your **Sales** shared drive
2. Create a new folder called `Banner Content` (if it doesn't exist)
3. Right-click on `Banner Content` → "Share"
4. In the "Add people and groups" field, paste the service account email
   - Find this in the downloaded JSON file: look for `"client_email"` field
   - It looks like: `sales-dashboard-service@your-project.iam.gserviceaccount.com`
5. Give it **Editor** access
6. Uncheck "Notify people" (no need to notify a service account)
7. Click "Share"

---

## Step 7: Add Credentials to Your App

Now we'll add these credentials to your Sales Dashboard.

1. Open the JSON file you downloaded (service account key)
2. Create a file in your project called `.env.local` (if it doesn't exist)
3. Add these variables:

```env
# Google OAuth (for user authentication)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Google Service Account (for automated Drive operations)
GOOGLE_SERVICE_ACCOUNT_EMAIL=email_from_json_file
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_private_key_here\n-----END PRIVATE KEY-----\n"

# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID=your_sales_folder_id

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_string_here
```

### How to get the values:

**GOOGLE_CLIENT_ID**: From Step 4
**GOOGLE_CLIENT_SECRET**: From Step 4
**GOOGLE_SERVICE_ACCOUNT_EMAIL**: From JSON file, field `client_email`
**GOOGLE_PRIVATE_KEY**: From JSON file, field `private_key` (copy the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
**GOOGLE_DRIVE_FOLDER_ID**:
   - Open your "Banner Content" folder in Google Drive
   - Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part
**NEXTAUTH_SECRET**:
   - Generate a random string (32+ characters)
   - Or run this in terminal: `openssl rand -base64 32`

---

## Step 8: Test the Connection

Once I've built the integration code, you'll be able to test by:

1. Starting the app: `npm run dev`
2. Going to the Content module
3. Clicking "Authenticate with Google Drive"
4. Following the OAuth flow
5. Attempting to generate and export a piece of content

---

## Troubleshooting

### "Access denied" or "403 Forbidden"
- Make sure you enabled Google Drive API (Step 2)
- Verify the service account has Editor access to the shared drive folder
- Check that the service account email is correct in `.env.local`

### "Invalid client" or OAuth errors
- Verify your redirect URIs match exactly in Google Cloud Console
- Check that `NEXTAUTH_URL` matches your local development URL
- Make sure you copied Client ID and Client Secret correctly

### "File not found" when creating content
- Verify `GOOGLE_DRIVE_FOLDER_ID` is correct
- Make sure the service account has access to that folder
- Check that you're using the folder ID, not the folder name

### Private key errors
- Make sure you wrapped `GOOGLE_PRIVATE_KEY` in quotes in `.env.local`
- Verify the entire key is copied including BEGIN/END markers
- Check for any line break issues (should have `\n` between lines)

---

## Security Best Practices

1. **Never commit** `.env.local` to git (it's in `.gitignore`)
2. **Never share** your service account JSON file
3. **Never share** your Client Secret
4. If credentials are compromised:
   - Revoke them immediately in Google Cloud Console
   - Generate new credentials
   - Update your `.env.local`
5. Use separate credentials for development and production
6. Regularly audit who has access to your Google Cloud Project

---

## Next Steps

Once you complete these steps and provide me the credentials in `.env.local`, I will:

1. Install necessary npm packages (`googleapis`, `google-auth-library`)
2. Build the Google Drive integration code
3. Create folder structure in your Sales drive
4. Implement OAuth flow for team members
5. Build export functionality for Docs/Slides/Sheets

**Ready to proceed?** Once you've completed these steps, let me know and I'll start building the integration!
