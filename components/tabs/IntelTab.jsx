// Intel = what we know / still need to learn about the account. Merges the former "Current State"
// (16 business areas) and "Gaps" (open discovery questions + MEDDICC) under one tab (Phase 2 collapse).
import { useState } from 'react';
import SubToggle from './SubToggle';
import CurrentStateTab from './CurrentStateTab';
import InformationGapsTab from './InformationGapsTab';

export default function IntelTab({ account }) {
  const [view, setView] = useState('current_state');
  return (
    <div>
      <SubToggle
        value={view}
        onChange={setView}
        options={[{ id: 'current_state', label: 'Current State' }, { id: 'gaps', label: 'Gaps' }]}
      />
      {view === 'current_state'
        ? <CurrentStateTab account={account} />
        : <InformationGapsTab account={account} />}
    </div>
  );
}
