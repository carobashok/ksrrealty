// src/pages/Employees.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Search, Plus, Pencil, Trash2, X, Phone, Mail } from 'lucide-react';

// Must exactly match the DB check constraint "employees_role_check"
const ROLE_OPTIONS = [
  { value: 'sales_executive', label: 'Sales Executive' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'project_head', label: 'Project Head' },
  { value: 'md', label: 'MD' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'admin', label: 'Admin' },
];

const roleLabel = (value) => ROLE_OPTIONS.find((r) => r.value === value)?.label || value;

const emptyForm = {
  id: null,
  name: '',
  employee_code: '',
  role: '',
  reporting_to: '',
  mobile: '',
  email: '',
  active: true,
};

export default function Employees() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('employees')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .schema('ksr')
          .from('employees')
          .update(rest)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { id, ...rest } = payload;
        const { error } = await supabase.schema('ksr').from('employees').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Employee updated' : 'Employee added');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Something went wrong'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.schema('ksr').from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Employee deleted');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Cannot delete — this employee may be linked to bookings or reports');
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setForm(emptyForm);
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEditModal = (emp) => {
    setForm({
      id: emp.id,
      name: emp.name || '',
      employee_code: emp.employee_code || '',
      role: emp.role || '',
      reporting_to: emp.reporting_to || '',
      mobile: emp.mobile || '',
      email: emp.email || '',
      active: emp.active ?? true,
    });
    setIsEdit(true);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.role.trim()) {
      toast.error('Role is required');
      return;
    }
    saveMutation.mutate({ ...form, reporting_to: form.reporting_to || null });
  };

  const filtered = employees.filter((e) => {
    if (!showInactive && e.active === false) return false;
    const q = search.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.employee_code?.toLowerCase().includes(q) ||
      e.role?.toLowerCase().includes(q) ||
      e.mobile?.toLowerCase().includes(q)
    );
  });

  // Exclude self from "Reports To" options when editing
  const reportingOptions = employees.filter((e) => e.id !== form.id);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Employees</h1>
          <p className="text-sm text-slate-500">
            {employees.filter((e) => e.active !== false).length} active · {employees.length} total
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#0a1f44] text-white px-4 py-2 rounded-lg hover:bg-[#122a5c] transition"
        >
          <Plus size={18} />
          New Employee
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code, role, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading employees...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {search ? 'No employees match your search' : 'No employees yet — add one to get started'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Reports To</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.employee_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{roleLabel(e.role)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.reporting_to ? employeeMap[e.reporting_to] || '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col gap-0.5">
                      {e.mobile && (
                        <span className="flex items-center gap-1 text-xs">
                          <Phone size={12} className="text-slate-400" /> {e.mobile}
                        </span>
                      )}
                      {e.email && (
                        <span className="flex items-center gap-1 text-xs">
                          <Mail size={12} className="text-slate-400" /> {e.email}
                        </span>
                      )}
                      {!e.mobile && !e.email && '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs border ${
                        e.active === false
                          ? 'bg-slate-50 text-slate-500 border-slate-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {e.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(e)}
                        className="p-1.5 text-slate-500 hover:text-[#0a1f44] hover:bg-slate-100 rounded"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(e)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {isEdit ? 'Edit Employee' : 'New Employee'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  placeholder="Full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Employee Code</label>
                  <input
                    type="text"
                    value={form.employee_code}
                    onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                    placeholder="e.g. KSR-EMP-014"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  >
                    <option value="">Select role...</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">Reports To</label>
                <select
                  value={form.reporting_to}
                  onChange={(e) => setForm({ ...form, reporting_to: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                >
                  <option value="">None</option>
                  {reportingOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.role ? `(${roleLabel(r.role)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Mobile</label>
                  <input
                    type="text"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active (shows up in booking / block dropdowns)
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-[#0a1f44] text-white rounded-lg hover:bg-[#122a5c] disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete employee?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently remove <span className="font-medium">{deleteTarget.name}</span>.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
