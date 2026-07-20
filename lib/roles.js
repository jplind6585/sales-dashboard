// Access roles: rep (default) < manager < admin. Admin has every manager power plus user
// management and sales-process editing. Route ALL gates through these helpers so a bare
// role === 'manager' check can never accidentally lock admins out of manager surfaces.
export const ROLES = ['rep', 'manager', 'admin']
export const ROLE_LABELS = { rep: 'Rep', manager: 'Manager', admin: 'Admin' }
export const REP_TYPES = ['ae', 'sdr']
export const REP_TYPE_LABELS = { ae: 'Account Executive', sdr: 'SDR' }

const roleOf = (x) => (typeof x === 'string' ? x : x?.role) || 'rep'

export const isAdmin = (x) => roleOf(x) === 'admin'
export const isManager = (x) => { const r = roleOf(x); return r === 'manager' || r === 'admin' }
export const canManageUsers = (x) => isAdmin(x)
