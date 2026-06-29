import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/consumables/dashboard').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: report } = useQuery({
    queryKey: ['report-monthly'],
    queryFn: () => api.get('/reports?period=monthly').then(r => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData = report?.by_category?.map(c => ({ name: c.category, qty: parseInt(c.qty) })) || [];

  const pieData = [
    { name: 'Adequate', value: stats?.ok || 0 },
    { name: 'Low Stock', value: stats?.low || 0 },
    { name: 'Out of Stock', value: stats?.out || 0 },
  ].filter(d => d.value > 0);
  const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-green-800 dark:text-green-300">Dashboard</h1>
        <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">ECEWS Consumables overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Consumables" value={stats?.total || 0} sub="registered items" to="/inventory" />
        <StatCard label="In Stock" value={stats?.ok || 0} sub="adequate levels" color="green" to="/inventory?status=ok" />
        <StatCard label="Low Stock" value={stats?.low || 0} sub="below minimum" color="amber" to="/inventory?status=low" />
        <StatCard label="Out of Stock" value={stats?.out || 0} sub="needs restocking" color="red" to="/inventory?status=out" />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Dispatched Today" value={stats?.dispatched_today || 0} sub="units sent" color="green" />
          <StatCard label="Total Dispatched" value={stats?.total_dispatched || 0} sub="all time" />
          <StatCard label="Total Received" value={stats?.total_received || 0} sub="all time" />
          <StatCard label="This Month" value={report?.summary?.total_dispatched || 0} sub="units dispatched" color="green" />
        </div>
      )}

      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Stock distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} onClick={(entry) => { const map = { 'Adequate': 'ok', 'Low Stock': 'low', 'Out of Stock': 'out' }; const s = map[entry?.name]; if (s) navigate(`/dashboard/inventory?status=${s}`); }} style={{ cursor: 'pointer' }}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-green-100 text-center py-10">No stock data</p>}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Monthly dispatch by category</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={20}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={55} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#10B981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-green-100 text-center py-10">No dispatch data this month</p>}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Recent dispatches</h3>
            <div className="space-y-0">
              {stats?.recent_dispatches?.length ? stats.recent_dispatches.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-green-500 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{d.consumable_name}</p>
                    <p className="text-xs text-green-100">{d.destination} · {format(new Date(d.dispatched_at), 'MMM d, h:mm a')}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-200">-{d.quantity}</span>
                </div>
              )) : <p className="text-sm text-green-100 text-center py-8">No dispatches yet</p>}
            </div>
              <button onClick={() => navigate('/dashboard/dispatch')} className="mt-3 text-xs text-white font-medium hover:underline underline-offset-2">View all dispatches →</button>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Stock distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} onClick={(entry) => { const map = { 'Adequate': 'ok', 'Low Stock': 'low', 'Out of Stock': 'out' }; const s = map[entry?.name]; if (s) navigate(`/dashboard/inventory?status=${s}`); }} style={{ cursor: 'pointer' }}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-green-100 text-center py-10">No stock data</p>}
        </div>
      )}
    </div>
  );
}
