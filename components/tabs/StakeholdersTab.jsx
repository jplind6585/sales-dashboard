import { useState } from 'react';
import { Users, Download, X, Check, Loader } from 'lucide-react';
import { getRoleBadgeClasses, STAKEHOLDER_ROLES } from '../../lib/constants';

const StakeholdersTab = ({ account, onOpenStakeholderModal, onUpdateRole, onBulkAddStakeholders }) => {
  const stakeholders = account?.stakeholders || [];

  // HubSpot import state
  const [hsContacts, setHsContacts] = useState(null);
  const [hsLoading, setHsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);

  // Group stakeholders by role for quick overview
  const roleGroups = STAKEHOLDER_ROLES.reduce((acc, role) => {
    acc[role.value] = stakeholders.filter(s => s.role === role.value);
    return acc;
  }, {});

  const hasChampion = roleGroups['Champion']?.length > 0;
  const hasEconomicBuyer = roleGroups['Economic Buyer']?.length > 0;

  async function fetchHsContacts() {
    setHsLoading(true);
    try {
      const r = await fetch(`/api/hubspot/account-contacts?accountId=${account.id}`);
      const d = await r.json();
      if (d.success) {
        setHsContacts(d.contacts);
        setSelectedContacts(d.contacts.map(c => c.hubspotContactId));
      }
    } catch (e) {
      console.error('HubSpot contacts fetch error:', e);
    } finally {
      setHsLoading(false);
    }
  }

  function toggleContact(id) {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function importSelected() {
    if (!hsContacts || !onBulkAddStakeholders) return;
    setImporting(true);
    const toImport = hsContacts.filter(c => selectedContacts.includes(c.hubspotContactId));
    await onBulkAddStakeholders(toImport);
    setHsContacts(null);
    setImporting(false);
  }

  return (
    <div className="space-y-4">
      {/* MEDDICC Status */}
      <div className="flex gap-4 p-3 bg-gray-50 rounded-lg text-sm">
        <div className={`flex items-center gap-2 ${hasChampion ? 'text-green-700' : 'text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full ${hasChampion ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          Champion {hasChampion ? 'Identified' : 'Needed'}
        </div>
        <div className={`flex items-center gap-2 ${hasEconomicBuyer ? 'text-blue-700' : 'text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full ${hasEconomicBuyer ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
          Economic Buyer {hasEconomicBuyer ? 'Identified' : 'Needed'}
        </div>
      </div>

      {/* HubSpot Import Panel */}
      {account?.hubspotDealId && !hsContacts && (
        <div className="flex justify-end">
          <button
            onClick={fetchHsContacts}
            disabled={hsLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-orange-200 text-orange-700 bg-orange-50 rounded hover:bg-orange-100 disabled:opacity-50 transition-colors"
          >
            {hsLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Import from HubSpot
          </button>
        </div>
      )}

      {/* HubSpot contact checklist */}
      {hsContacts && (
        <div className="border border-orange-200 rounded-lg bg-orange-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-orange-800">
              {hsContacts.length} contacts found in HubSpot
            </div>
            <button onClick={() => setHsContacts(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {hsContacts.length === 0 ? (
            <p className="text-sm text-orange-700">No contacts associated with this deal in HubSpot.</p>
          ) : (
            <>
              <div className="space-y-2 mb-3 max-h-52 overflow-y-auto">
                {hsContacts.map(c => (
                  <label key={c.hubspotContactId} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(c.hubspotContactId)}
                      onChange={() => toggleContact(c.hubspotContactId)}
                      className="mt-0.5 accent-orange-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        {[c.title, c.department].filter(Boolean).join(' · ')}
                        {c.email && <span className="ml-1 text-gray-400">{c.email}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={importSelected}
                  disabled={importing || selectedContacts.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {importing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Import {selectedContacts.length} selected
                </button>
                <button
                  onClick={() => setHsContacts(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stakeholders.length > 0 ? (
        <>
          {stakeholders.map(s => (
            <div key={s.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  {s.title && <div className="text-sm text-gray-600">{s.title}</div>}
                  {s.department && <div className="text-sm text-gray-500">{s.department}</div>}
                  {s.email && <div className="text-sm text-blue-600">{s.email}</div>}
                  {s.notes && (
                    <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {s.notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded text-sm ${getRoleBadgeClasses(s.role)}`}>
                    {s.role}
                  </span>
                  {s.addedAt && (
                    <span className="text-xs text-gray-400">
                      {s.addedAt.includes('T') ? 'Auto-detected' : 'Manual'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <button
              onClick={onOpenStakeholderModal}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              <Users className="w-4 h-4" />
              Add Stakeholder
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">
            No stakeholders yet. Add a transcript to auto-detect stakeholders, or add them manually.
          </div>
          <button
            onClick={onOpenStakeholderModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 mx-auto"
          >
            <Users className="w-4 h-4" />
            Add Stakeholder
          </button>
        </div>
      )}
    </div>
  );
};

export default StakeholdersTab;
