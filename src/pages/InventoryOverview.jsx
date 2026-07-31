// src/pages/InventoryOverview.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search } from 'lucide-react';

export default function InventoryOverview() {
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['inventory-overview-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name, region, location, district')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: plots = [], isLoading: loadingPlots } = useQuery({
    queryKey: ['inventory-overview-plots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('plots')
        .select('project_id, status')
        .eq('plot_type', 'plot');
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingProjects || loadingPlots;

  const rows = projects.map((proj) => {
    const projectPlots = plots.filter((p) => p.project_id === proj.id);
    const counts = { total: projectPlots.length, available: 0, blocked: 0, booked: 0, registered: 0 };
    for (const p of projectPlots) {
      if (counts[p.status] !== undefined) counts[p.status]++;
    }
    const locationParts = [proj.region, proj.location, proj.district].filter(Boolean);
    return {
      id: proj.id,
      name: proj.name,
      location: locationParts.join(' · ') || '—',
      ...counts,
    };
  });

  const q = search.toLowerCase();
  const filtered = rows.filter(
    (r) => !q || r.name?.toLowerCase().includes(q) || r.location?.toLowerCase().includes(q)
  );

  const totals = filtered.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      available: acc.available + r.available,
      blocked: acc.blocked + r.blocked,
      booked: acc.booked + r.booked,
      registered: acc.registered + r.registered,
    }),
    { total: 0, available: 0, blocked: 0, booked: 0, registered: 0 }
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Inventory Overview</h1>
        <p className="text-sm text-slate-500">Plot status summary across all projects</p>
      </div>

      <div className="relative max-w-md mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by project or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading inventory...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No projects match your search</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 w-12">S.No</th>
                <th className="text-left px-4 py-3">Project Name</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-right px-4 py-3">No. of Plots</th>
                <th className="text-right px-4 py-3">Available</th>
                <th className="text-right px-4 py-3">Blocked</th>
                <th className="text-right px-4 py-3">Booked</th>
                <th className="text-right px-4 py-3">Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link to={`/projects/${r.id}`} className="font-medium text-[#0a1f44] hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.location}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{r.total}</td>
                  <td className="px-4 py-3 text-right text-green-700">{r.available}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{r.blocked}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{r.booked}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.registered}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-4 py-3" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right text-slate-800">{totals.total}</td>
                <td className="px-4 py-3 text-right text-green-700">{totals.available}</td>
                <td className="px-4 py-3 text-right text-amber-700">{totals.blocked}</td>
                <td className="px-4 py-3 text-right text-blue-700">{totals.booked}</td>
                <td className="px-4 py-3 text-right text-slate-700">{totals.registered}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
