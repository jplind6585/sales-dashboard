# Banner Team Configuration Guide

## Overview

The `lib/bannerTeam.js` file maintains a list of Banner employees. When transcripts are analyzed, any stakeholder matching a Banner team member is automatically labeled with:
- Full canonical name
- Official title
- Department set to "Banner"
- `isBannerTeam: true` flag

This ensures Banner team members are consistently identified across all accounts and sessions.

## Adding Team Members

Edit `lib/bannerTeam.js` and add entries to the `BANNER_TEAM` array:

```javascript
export const BANNER_TEAM = [
  {
    name: 'James Banner',           // Canonical full name
    title: 'CEO',                   // Official title
    department: 'Executive',        // Internal department
    variants: [                     // Name variations to match
      'james',
      'jim banner',
      'james b'
    ]
  },
  {
    name: 'Sarah Smith',
    title: 'VP of Sales',
    department: 'Sales',
    variants: ['sarah', 'sarah s']
  },
  // Add more team members here
];
```

## How Matching Works

The system tries multiple matching strategies:
1. **Exact match**: "James Banner" matches "James Banner"
2. **Variant match**: "Jim Banner" matches "James Banner" (via variants)
3. **Last name match**: "Banner" matches "James Banner" (if last name > 3 chars)

## What Gets Updated

When a Banner team member is identified in a transcript:
- `name` → Canonical name from config
- `title` → Official title from config
- `department` → "Banner"
- `isBannerTeam` → true
- `notes` → Prefixed with "Banner team member"

## Where It Applies

Banner team labeling happens automatically in:
- New transcript analysis (`pages/api/analyze-transcript.js`)
- All existing stakeholder data is preserved (only new analysis is labeled)

To re-label existing stakeholders, re-upload their transcripts or manually update them.
