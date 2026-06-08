import { useState } from 'react';
import { FileText, Download, BarChart, Calendar, Users, AlertCircle } from 'lucide-react';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';

const WEEKLY_DATA = [
  { day: 'Mon', normal: 12, warning: 3, critical: 1 },
  { day: 'Tue', normal: 14, warning: 4, critical: 0 },
  { day: 'Wed', normal: 10, warning: 6, critical: 2 },
  { day: 'Thu', normal: 15, warning: 2, critical: 1 },
  { day: 'Fri', normal: 13, warning: 5, critical: 0 },
  { day: 'Sat', normal: 9,  warning: 3, critical: 1 },
  { day: 'Sun', normal: 8,  warning: 2, critical: 0 },
];

const MOCK_REPORTS = [
  { id: 'R-001', title: 'Weekly Vitals Summary',      patient: 'All Patients',    type: 'Summary',    generated: new Date(Date.now() - 1 * 86400000), size: '2.4 MB' },
  { id: 'R-002', title: 'John Smith — Monthly Report', patient: 'John Smith',     type: 'Individual', generated: new Date(Date.now() - 3 * 86400000), size: '1.1 MB' },
  { id: 'R-003', title: 'Critical Alerts Export',     patient: 'Multiple',        type: 'Alerts',     generated: new Date(Date.now() - 5 * 86400000), size: '0.8 MB' },
  { id: 'R-004', title: 'Jane Doe — Trend Analysis',  patient: 'Jane Doe',        type: 'Individual', generated: new Date(Date.now() - 7 * 86400000), size: '1.3 MB' },
];

const TYPE_BADGE = {
  Summary:    'bg-blue-100   text-blue-700',
  Individual: 'bg-violet-100 text-violet-700',
  Alerts:     'bg-red-100    text-red-700',
};

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [type,     setType]     = useState('all');

  const filtered = MOCK_REPORTS.filter((r) => {
    if (type !== 'all' && r.type !== type) return false;
    if (dateFrom && new Date(r.generated) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(r.generated) > new Date(dateTo))   return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Reports Generated" value={42}   subtitle="This month"    icon={FileText}    color="blue"   />
        <StatCard title="Patients Covered"  value={8}    subtitle="Active records" icon={Users}       color="green"  />
        <StatCard title="Alert Reports"     value={6}    subtitle="This month"    icon={AlertCircle} color="red"    />
        <StatCard title="Exports Today"     value={3}    subtitle="PDF & CSV"     icon={Download}    color="purple" />
      </div>

      {/* Weekly chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Weekly Reading Summary</h3>
          <p className="text-xs text-gray-500 mt-0.5">Status distribution across all patients this week</p>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={220}>
            <ReBarChart data={WEEKLY_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="normal"   name="Normal"   fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="warning"  name="Warning"  fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reports table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="text-base font-semibold text-gray-800 flex-1">Recent Reports</h3>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30" />
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30">
                <option value="all">All Types</option>
                <option value="Summary">Summary</option>
                <option value="Individual">Individual</option>
                <option value="Alerts">Alerts</option>
              </select>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors">
                <Download size={13} /> Export All
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80">
                {['Report ID', 'Title', 'Patient', 'Type', 'Generated', 'Size', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{r.patient}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[r.type]}`}>{r.type}</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {r.generated.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">{r.size}</td>
                  <td className="px-6 py-4">
                    <button className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-medium">
                      <Download size={13} /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={FileText} title="No reports found" description="Try adjusting the date range or type filter." />
          )}
        </div>
      </div>
    </div>
  );
}
