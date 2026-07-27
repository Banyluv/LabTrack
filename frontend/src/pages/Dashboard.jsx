import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
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
      <div className="w-10 h-10 border-4 border-slate-300 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData = report?.by_category?.map(c => ({ name: c.category, qty: parseInt(c.qty, 10) })) || [];
  const rawUserName = user?.name || user?.email || 'Team';
  const userName = rawUserName.includes('@')
    ? rawUserName.split('@')[0]
    : rawUserName.split(' ')[0];
  const userRole = user?.role ? `${user.role.replace('_', ' ')}` : 'User';

  const pieData = [
    { name: 'Adequate', value: stats?.ok || 0 },
    { name: 'Low Stock', value: stats?.low || 0 },
    { name: 'Out of Stock', value: stats?.out || 0 },
  ].filter(d => d.value > 0);
  const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6 px-4 py-6 max-w-7xl mx-auto sm:px-6 lg:px-8">
      <section className="rounded-[2rem] bg-slate-950/95 border border-slate-800 shadow-2xl shadow-slate-950/20 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1.2fr] gap-6 p-8 sm:p-10">
          <div className="space-y-5 text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Operations dashboard
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Hello, {userName}.</h1>
              <p className="max-w-2xl text-base text-slate-300 leading-8">
                Review stock status, track dispatch activity, and access actionable inventory insights from a single centralized workspace.
              </p>
              <p className="text-sm text-slate-400">Role: <span className="text-slate-100 font-semibold">{userRole}</span></p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2"></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/95 p-5 shadow-xl shadow-slate-950/20">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400 font-semibold">Stock health</p>
              <p className="mt-4 text-3xl font-semibold text-white">{stats?.ok || 0} items</p>
              <p className="mt-2 text-sm text-slate-300 leading-6">{stats?.out || 0} out of stock · {stats?.low || 0} below minimum threshold.</p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/95 p-5 shadow-xl shadow-slate-950/20">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400 font-semibold">Tracked inventory</p>
              <p className="mt-4 text-3xl font-semibold text-white">{stats?.total || 0}</p>
              <p className="mt-2 text-sm text-slate-300 leading-6">Total consumables across your facilities.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total consumables" value={stats?.total || 0} sub="Registered items" to="/inventory" />
        <StatCard label="In stock" value={stats?.ok || 0} sub="Adequate level" color="green" to="/inventory?status=ok" />
        <StatCard label="Low stock" value={stats?.low || 0} sub="Reorder threshold" color="amber" to="/inventory?status=low" />
        <StatCard label="Out of stock" value={stats?.out || 0} sub="Needs attention" color="red" to="/inventory?status=out" />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Dispatched today" value={stats?.dispatched_today || 0} sub="Units sent" color="green" />
          <StatCard label="Total dispatched" value={stats?.total_dispatched || 0} sub="All-time" />
          <StatCard label="Total received" value={stats?.total_received || 0} sub="All-time" />
          <StatCard label="This month" value={report?.summary?.total_dispatched || 0} sub="Dispatch volume" color="green" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Stock distribution</h3>
              <p className="text-sm text-slate-400 mt-1">Breakdown by availability status.</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
              Live data
            </span>
          </div>

          {pieData.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr] items-center">
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={6}
                      onClick={(entry) => {
                        const map = { Adequate: 'ok', 'Low Stock': 'low', 'Out of Stock': 'out' };
                        const status = map[entry?.name];
                        if (status) navigate(`/inventory?status=${status}`);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                {pieData.map((segment, index) => (
                  <div key={segment.name} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{segment.name}</p>
                        <p className="text-xs text-slate-400">Click to filter inventory</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">{segment.value}</p>
                  </div>
                ))}
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400 font-semibold">Tracked total</p>
                  <p className="mt-2 text-3xl font-bold text-slate-100">{pieData.reduce((sum, item) => sum + item.value, 0)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-400 py-16">No stock data available yet.</p>
          )}
        </div>

        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Monthly dispatch by category</h3>
              <p className="text-sm text-slate-400">Track how each category is moving this month.</p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barSize={22}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} interval={0} angle={-30} textAnchor="end" height={72} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '0.75rem', border: '1px solid #334155' }} itemStyle={{ color: '#F8FAFC' }} labelStyle={{ color: '#94A3B8' }} />
                <Bar dataKey="qty" fill="#14B8A6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-400 py-16">No dispatch data available this month.</p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-base font-semibold text-slate-100">Recent dispatches</h3>
            <button onClick={() => navigate('/dispatch')} className="text-sm text-slate-300 hover:text-white transition">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {stats?.recent_dispatches?.length ? stats.recent_dispatches.map((d) => (
              <div key={d.id} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-100">{d.consumable_name}</p>
                    <p className="text-sm text-slate-400">{d.destination}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-300">-{d.quantity}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{format(new Date(d.dispatched_at), 'MMM d, h:mm a')}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-400 text-center py-10">No dispatch records found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
