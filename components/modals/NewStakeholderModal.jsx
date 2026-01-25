import { X } from 'lucide-react';
import { STAKEHOLDER_ROLES } from '../../lib/constants';

const NewStakeholderModal = ({
  stakeholderName,
  setStakeholderName,
  stakeholderTitle,
  setStakeholderTitle,
  stakeholderDept,
  setStakeholderDept,
  stakeholderRole,
  setStakeholderRole,
  onClose,
  onAdd
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Stakeholder</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={stakeholderName}
            onChange={(e) => setStakeholderName(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={stakeholderTitle}
            onChange={(e) => setStakeholderTitle(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="VP of Operations"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Department</label>
          <input
            type="text"
            value={stakeholderDept}
            onChange={(e) => setStakeholderDept(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Operations"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={stakeholderRole}
            onChange={(e) => setStakeholderRole(e.target.value)}
            className="w-full border rounded p-2"
          >
            {STAKEHOLDER_ROLES.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onAdd}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Add Stakeholder
        </button>
      </div>
    </div>
  </div>
);

export default NewStakeholderModal;
