// Stakeholders = the people on the deal. Merges the former "People" (influence map: champion / EB /
// everyone-else with call receipts) and "Stakeholders" (editable list + HubSpot import) under one tab
// with a sub-toggle (Phase 2 tab collapse; James: "combine them, call it Stakeholders").
import { useState } from 'react';
import SubToggle from './SubToggle';
import PeopleTab from './PeopleTab';
import StakeholdersTab from './StakeholdersTab';

export default function StakeholdersMergedTab({ account, onOpenStakeholderModal, onBulkAddStakeholders }) {
  const [view, setView] = useState('influence');
  return (
    <div>
      <SubToggle
        value={view}
        onChange={setView}
        options={[{ id: 'influence', label: 'Influence map' }, { id: 'manage', label: 'Manage' }]}
      />
      {view === 'influence'
        ? <PeopleTab account={account} />
        : <StakeholdersTab account={account} onOpenStakeholderModal={onOpenStakeholderModal} onBulkAddStakeholders={onBulkAddStakeholders} />}
    </div>
  );
}
