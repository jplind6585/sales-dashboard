# Email Workflow - New Features

## Three Major Enhancements

### 1. ✏️ Editable Email Window

**What it does:**
- Generated emails now appear in an editable textarea instead of read-only text
- Edit the email directly before sending
- All changes are tracked for learning

**How to use:**
1. Click "Follow-up Email" on a transcript
2. Wait for generation (5-10 seconds)
3. Edit the text directly in the window
4. Click "Copy" or "Send to Gmail" when ready

**Visual indicator:**
- Shows "✏️ Edited - Changes will be learned for future emails" when you make changes

---

### 2. 📧 Gmail Integration

**What it does:**
- One-click send to Gmail with pre-filled recipients, subject, and body
- Automatically extracts email addresses from:
  - Attendee strings (if they contain emails)
  - Stakeholder records (matches by name)
- Opens Gmail compose window in new tab
- Includes reminder to attach checklist items

**How to use:**
1. Generate and edit your email
2. Click **"Send to Gmail"** button
3. Gmail opens with:
   - ✅ Recipients pre-filled (external attendees only)
   - ✅ Subject line populated
   - ✅ Body text ready to go
   - ✅ Note at top reminding you to attach checklist items
4. Attach documents from the checklist
5. Hit Send

**Smart recipient detection:**
- Filters out Banner/James emails automatically
- Falls back to stakeholder emails if attendees don't have emails
- Shows warning in body if no emails found

**Note about attachments:**
- Gmail security doesn't allow pre-attaching files via URL
- The system adds a reminder at the top: "📎 Note: Please attach the items from the checklist below before sending"
- You manually attach the documents listed in the checklist

---

### 3. 🧠 Learning System

**What it does:**
- Tracks original generated email vs. your edited version
- Analyzes patterns in your edits
- Learns your style preferences over time
- Applies learnings to future email generation
- Gets better with every email you send

**What it learns:**
1. **Subject line preferences** - How you phrase subjects
2. **Greeting style** - Name format, formality level
3. **Sign-off preferences** - How you close emails
4. **Length preferences** - If you consistently make emails shorter/longer
5. **Phrasing patterns** - Your specific word choices and tone

**How it works:**
```
Generate Email → You Edit → Send to Gmail → System Saves Edit
                                               ↓
                                    Analyzes what changed
                                               ↓
                                    Extracts style patterns
                                               ↓
                            Includes patterns in next generation
```

**Behind the scenes:**
- Saves last 100 email edits to `data/email_edits.json`
- Analyzes recent 20 edits for patterns
- Includes last 5 successful examples in prompts as few-shot learning
- Continuously improves as you use the system

**Example learning:**
```
If you consistently change:
"Best regards, James" → "James"

Future emails will generate:
"James" (your preference)
```

**Privacy:**
- Stored locally in `data/` directory
- Not committed to git (in .gitignore)
- Only used to improve your personal email generation

---

## Complete Workflow

```
1. Import Gong transcript
   ↓
2. System analyzes call
   ↓
3. Click "Follow-up Email"
   ↓
4. System generates email with:
   - Account context (stakeholders, pain points, MEDDICC)
   - Your learned style preferences
   - Banner's concise template
   ↓
5. Edit email in window
   ↓
6. Click "Send to Gmail"
   ↓
7. System learns from your edits
   ↓
8. Gmail opens with everything pre-filled
   ↓
9. Attach checklist items
   ↓
10. Send!
```

---

## Technical Details

### Files Modified/Created:

**Frontend:**
- `components/tabs/TranscriptsTab.jsx` - Added editing, Gmail integration, learning hooks

**Backend:**
- `pages/api/save-email-edit.js` - Saves edits and analyzes patterns
- `pages/api/get-email-patterns.js` - Retrieves learned patterns
- `pages/api/generate-follow-up.js` - Enhanced to use learned patterns

**Data Storage:**
- `data/email_edits.json` - Stores edit history (auto-created)

**Configuration:**
- `.gitignore` - Added `data/` directory

### Learning Algorithm:

1. **Capture**: Save original + edited versions
2. **Diff**: Compare to find changes
3. **Pattern Extract**: Identify what changed (subject, greeting, length, sign-off)
4. **Aggregate**: Look at last 20 edits for trends
5. **Apply**: Include patterns in system prompt for next generation

### Gmail URL Format:
```
https://mail.google.com/mail/?view=cm&fs=1
  &to=email1@example.com,email2@example.com
  &su=Banner Follow Up - 2/15
  &body=Email body text here
```

---

## Benefits

✅ **Faster**: Edit in-app instead of copy-paste to email client
✅ **Smarter**: System learns your style and gets better over time
✅ **Easier**: One-click to Gmail with everything pre-filled
✅ **Consistent**: Your personal style is maintained across all emails
✅ **Efficient**: Less manual work, more time selling

---

## Future Enhancements (Ideas)

- [ ] Outlook integration
- [ ] Automatic attachment linking (Drive, Dropbox)
- [ ] A/B testing email variations
- [ ] Style profiles (formal, casual, executive)
- [ ] Team-wide learning (opt-in to share patterns)
- [ ] Email performance tracking (open rates, response rates)
