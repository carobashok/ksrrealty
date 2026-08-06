// src/pages/Dashboard.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Download } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'financial', label: 'Plot Financial Summary' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">KSR Realty — Sales Module</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-[#0a1f44] text-[#0a1f44]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'financial' && <FinancialSummaryTab />}
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
      More dashboard widgets coming soon.
    </div>
  );
}

function InventoryTab() {
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
    <>
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
    </>
  );
}

const CENTS_TO_SQFT = 435.6;

function inr(val) {
  const n = Number(val) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

function FinancialSummaryTab() {
  const [projectId, setProjectId] = useState('');

  // Fetch all projects for filter dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['financial-summary-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('projects')
        .select('id, name, unit_of_measure')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all plots
  const { data: plots = [], isLoading: loadingPlots } = useQuery({
    queryKey: ['financial-summary-plots', projectId],
    queryFn: async () => {
      let q = supabase
        .schema('ksr')
        .from('plots')
        .select('id, plot_number, facing, area_sqft, status, project_id')
        .eq('plot_type', 'plot')
        .order('plot_number');
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch all bookings
  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['financial-summary-bookings', projectId],
    queryFn: async () => {
      let q = supabase
        .schema('ksr')
        .from('bookings')
        .select('id, plot_id, project_id, status, registration_date, total_consideration, company_share_amt, landowner_share_amt, ksr_owes_landowner');
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch all payments separately
  const bookingIds = bookings.map(b => b.id);
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['financial-summary-payments', bookingIds.join(',')],
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('ksr')
        .from('payments')
        .select('booking_id, payment_type, amount')
        .in('booking_id', bookingIds);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingPlots || loadingBookings || (bookingIds.length > 0 && loadingPayments);

  // Build project lookup
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  // Build booking lookup by plot_id
  const bookingByPlot = Object.fromEntries(
    bookings.map(b => [b.plot_id, b])
  );

  // Build rows
  const rows = plots.map(plot => {
    const project = projectMap[plot.project_id] || {};
    const booking = bookingByPlot[plot.id];
    const isCents = project.unit_of_measure === 'cents';
    const areaSqft = Number(plot.area_sqft) || 0;
    const areaCents = parseFloat((areaSqft / CENTS_TO_SQFT).toFixed(2));
    const areaDisplay = isCents
      ? `${areaCents} Cents (${areaSqft.toLocaleString('en-IN')} Sq.ft)`
      : `${areaSqft.toLocaleString('en-IN')} Sq.ft`;

    let totalConsideration = 0, ksrShare = 0, landownerShare = 0;
    let ksrReceived = 0, landownerReceived = 0, ksrNetRealisation = 0;
    let regDate = '', bookingStatus = '';

    if (booking) {
      totalConsideration = Number(booking.total_consideration) || 0;
      ksrShare = Number(booking.company_share_amt) || 0;
      landownerShare = Number(booking.landowner_share_amt) || 0;
      regDate = booking.registration_date
        ? new Date(booking.registration_date).toLocaleDateString('en-IN')
        : '';
      bookingStatus = booking.status || '';

      const bookingPayments = payments.filter(p => p.booking_id === booking.id);
      for (const pmt of bookingPayments) {
        if (pmt.payment_type === 'company_share') ksrReceived += Number(pmt.amount) || 0;
        if (pmt.payment_type === 'landowner_share') landownerReceived += Number(pmt.amount) || 0;
      }

      const ksrOwes = Number(booking.ksr_owes_landowner) || 0;
      ksrNetRealisation = ksrShare - ksrOwes;
    }

    const ksrPending = ksrShare - ksrReceived;
    const landownerPending = landownerShare - landownerReceived;

    return {
      projectName: project.name || '',
      plotNo: plot.plot_number || '',
      facing: plot.facing || '—',
      areaDisplay,
      status: plot.status || '',
      totalConsideration,
      ksrShare,
      ksrReceived,
      ksrPending,
      landownerShare,
      landownerReceived,
      landownerPending,
      ksrNetRealisation,
      regDate,
      bookingStatus,
      hasBooking: !!booking,
    };
  });

  // CSV export
  const handleExport = () => {
    const headers = [
      'Project', 'Plot', 'Facing', 'Area',
      'Total Consideration', 'KSR Share', 'KSR Received', 'KSR Pending',
      'Landowner Share', 'Landowner Received', 'Landowner Pending',
      'KSR Net Realisation', 'Reg Date', 'Booking Status', 'Plot Status'
    ];
    const csvRows = rows.map(r => [
      r.projectName, r.plotNo, r.facing, r.areaDisplay,
      r.totalConsideration, r.ksrShare, r.ksrReceived, r.ksrPending,
      r.landownerShare, r.landownerReceived, r.landownerPending,
      r.ksrNetRealisation, r.regDate, r.bookingStatus, r.status
    ]);
    const csv = [headers, ...csvRows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ksr-plot-financial-summary-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status) => {
    if (status === 'available') return 'text-green-700';
    if (status === 'blocked') return 'text-amber-700';
    if (status === 'booked') return 'text-blue-700';
    if (status === 'registered') return 'text-slate-700';
    return 'text-slate-500';
  };

  return (
    <>
      {/* Filters + Export */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1f44]/30"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={handleExport}
          disabled={isLoading || rows.length === 0}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={15} />
          Export CSV
        </button>
        <span className="text-sm text-slate-500 ml-auto">{rows.length} plots</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading financial summary...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No plots found</div>
        ) : (
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3 sticky left-0 bg-slate-50">Project</th>
                <th className="text-left px-3 py-3">Plot</th>
                <th className="text-left px-3 py-3">Facing</th>
                <th className="text-right px-3 py-3">Area</th>
                <th className="text-right px-3 py-3">Total Consid.</th>
                <th className="text-right px-3 py-3 border-l border-slate-200">KSR Share</th>
                <th className="text-right px-3 py-3">KSR Received</th>
                <th className="text-right px-3 py-3">KSR Pending</th>
                <th className="text-right px-3 py-3 border-l border-slate-200">LO Share</th>
                <th className="text-right px-3 py-3">LO Received</th>
                <th className="text-right px-3 py-3">LO Pending</th>
                <th className="text-right px-3 py-3 border-l border-slate-200">KSR Net Real.</th>
                <th className="text-center px-3 py-3">Reg Date</th>
                <th className="text-center px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50 ${!r.hasBooking ? 'text-slate-400' : ''}`}>
                  <td className="px-3 py-2.5 font-medium text-slate-700 sticky left-0 bg-white">{r.projectName}</td>
                  <td className="px-3 py-2.5 font-medium text-[#0a1f44]">{r.plotNo}</td>
                  <td className="px-3 py-2.5">{r.facing}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">{r.areaDisplay}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{r.hasBooking ? inr(r.totalConsideration) : '—'}</td>
                  <td className="px-3 py-2.5 text-right border-l border-slate-100">{r.hasBooking ? inr(r.ksrShare) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-green-700">{r.hasBooking ? inr(r.ksrReceived) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.hasBooking ? inr(r.ksrPending) : '—'}</td>
                  <td className="px-3 py-2.5 text-right border-l border-slate-100">{r.hasBooking && r.landownerShare > 0 ? inr(r.landownerShare) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-green-700">{r.hasBooking && r.landownerShare > 0 ? inr(r.landownerReceived) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.hasBooking && r.landownerShare > 0 ? inr(r.landownerPending) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#0a1f44] border-l border-slate-100">{r.hasBooking ? inr(r.ksrNetRealisation) : '—'}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{r.regDate || '—'}</td>
                  <td className={`px-3 py-2.5 text-center font-medium capitalize ${r.hasBooking ? statusColor(r.bookingStatus) : statusColor(r.status)}`}>
                    {r.hasBooking ? r.bookingStatus : r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
