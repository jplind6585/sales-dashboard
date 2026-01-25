import { Users } from 'lucide-react';
import { getRoleBadgeClasses, STAKEHOLDER_ROLES } from '../../lib/constants';

const StakeholdersTab = ({ account, onOpenStakeholderModal, onUpdateRole }) => {
  const stakeholders = account?.stakeholders || [];

  // Group stakeholders by role for quick overview
  const roleGroups = STAKEHOLDER_ROLES.reduce((acc, role) => {
    acc[role.value] = stakeholders.filter(s => s.role === role.value);
    return acc;
  }, {});

  const hasChampion = roleGroups['Champion']?.length > 0;
  const hasEconomicBuyer = roleGroups['Economic Buyer']?.length > 0;

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

      {stakeholders.length > 0 ? (
        <>
          {stakeholders.map(s => (
            <div key={s.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  {s.title && <div className="text-sm text-gray-600">{s.title}</div>}
                  {s.department && <div className="text-sm text-gray-500">{s.department}</div>}
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
