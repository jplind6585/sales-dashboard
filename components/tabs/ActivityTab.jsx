// Activity = unified account activity. Merges the former "Activity" (timeline feed) and "Transcripts"
// (call list + AI analysis + generate actions) under one tab with a sub-toggle (Phase 2 tab collapse).
import { useState } from 'react';
import SubToggle from './SubToggle';
import TimelineTab from './TimelineTab';
import TranscriptsTab from './TranscriptsTab';

export default function ActivityTab({ account, onOpenTranscriptModal }) {
  const [view, setView] = useState('timeline');
  return (
    <div>
      <SubToggle
        value={view}
        onChange={setView}
        options={[{ id: 'timeline', label: 'Timeline' }, { id: 'calls', label: 'Call transcripts' }]}
      />
      {view === 'timeline'
        ? <TimelineTab account={account} />
        : <TranscriptsTab account={account} onOpenTranscriptModal={onOpenTranscriptModal} />}
    </div>
  );
}
