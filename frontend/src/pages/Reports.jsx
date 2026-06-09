import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../utils/api';
import StatCard from '../components/StatCard';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
];

const PIE_COLORS = ['#1D9E75','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#10B981'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calView, setCalView] = useState('calendar'); // 'calendar' | 'years' | 'months'
  const [calYear, setCalYear] = useState(new Date().getFullYear()); // independent year for picker
  const [calMonth, setCalMonth] = useState(new Date().getMonth());   // independent month for picker

  // Parse current state
  const selectedDate = new Date(date);
  const todayStr = new Date().toISOString().slice(0,10);
  const todayYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth();

  // Sync calYear/calMonth when opening calendar, but keep independent during browsing
  const openCalendar = () => {
    setCalYear(selectedDate.getFullYear());
    setCalMonth(selectedDate.getMonth());
    setCalView('calendar');
    setShowCalendar(!showCalendar);
  };

  // Sync when date changes externally (nav buttons)
  useMemo(() => {
    if (showCalendar) {
      setCalYear(selectedDate.getFullYear());
      setCalMonth(selectedDate.getMonth());
    }
  }, [date]);

  // ── Hierarchical report query ──
  const { data, isLoading } = useQuery({
    queryKey: ['hierarchical-report', period, date],
    queryFn: () => api.get('/reports/hierarchical', { params: { period, date } }).then(r => r.data),
  });

  // ── Calendar data query ──
  const calQueryMonth = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  const { data: calData } = useQuery({
    queryKey: ['calendar', calQueryMonth],
    queryFn: () => api.get('/reports/calendar', {
      params: { month: calQueryMonth }
    }).then(r => r.data),
    enabled: showCalendar && calView === 'calendar',
  });

  const handleExport = () => {
    window.open(`${import.meta.env.VITE_API_URL || '/api'}/reports/export?period=${period}`, '_blank');
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    // Reset date to today when switching period type
    setDate(new Date().toISOString().slice(0,10));
  };

  const navPrev = () => {
    const d = new Date(date);
    switch (period) {
      case 'daily': d.setDate(d.getDate() - 1); break;
      case 'weekly': d.setDate(d.getDate() - 7); break;
      case 'monthly': d.setMonth(d.getMonth() - 1); break;
      case 'quarterly': d.setMonth(d.getMonth() - 3); break;
      case 'yearly': d.setFullYear(d.getFullYear() - 1); break;
    }
    setDate(d.toISOString().slice(0,10));
  };

  const navNext = () => {
    const d = new Date(date);
    switch (period) {
      case 'daily': d.setDate(d.getDate() + 1); break;
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    }
    setDate(d.toISOString().slice(0,10));
  };

  const navToday = () => {
    setDate(todayStr);
  };

  // Calendar navigation (operates on independent calYear/calMonth)
  const calNavPrev = () => {
    if (calView === 'calendar') {
      if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
      else setCalMonth(calMonth - 1);
    } else if (calView === 'months') {
      setCalYear(calYear - 1);
      setCalView('years');
    }
  };
  const calNavNext = () => {
    if (calView === 'calendar') {
      // Can't go beyond current month
      if (calYear === todayYear && calMonth >= todayMonth) return;
      if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
      else setCalMonth(calMonth + 1);
    }
  };

  const selectDay = (day) => {
    setPeriod('daily');
    setDate(day);
    setShowCalendar(false);
  };

  const selectMonth = (m) => {
    setCalMonth(m);
    setCalView('calendar');
  };

  const selectYear = (y) => {
    setCalYear(y);
    setCalView('months');
  };

  // Build year list: current year down to 2020
  const yearOptions = [];
  for (let y = todayYear; y >= 2020; y--) yearOptions.push(y);

  // Build month grid for year picker
  const monthGrid = MONTHS.map((label, idx) => {
    const isFuture = calYear === todayYear && idx > todayMonth;
    return { idx, label, disabled: isFuture };
  });

  // Go to selected month
  const goToMonth = () => {
    setDate(`${calYear}-${String(calMonth+1).padStart(2,'0')}-01`);
    setShowCalendar(false);
    if (period !== 'monthly') setPeriod('monthly');
  };

  // ── Build calendar grid ──
  const calGrid = useMemo(() => {
    if (!calData?.days || calView !== 'calendar') return [];
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const grid = [];
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) grid.push(null);
    calData.days.forEach(d => grid.push(d));
    return grid;
  }, [calData, calYear, calMonth, calView]);

  // Chart data
  const byItemChart = (data?.by_item || []).slice(0, 10).map(i => ({ name: i.name?.substring(0, 18), qty: parseInt(i.qty) }));
  const byFacilityChart = (data?.by_destination || []).map(d => ({ name: d.destination?.substring(0, 22), value: parseInt(d.qty) }));

  // Trend indicator
  const trendDelta = data?.trend?.current - data?.trend?.previous;
  const trendPct = data?.trend?.previous ? ((trendDelta / data.trend.previous) * 100).toFixed(1) : 0;
  const trendUp = trendDelta > 0;

  // Period label helper
  const periodLabel = () => {
    switch (period) {
      case 'daily': return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      case 'weekly': {
        const start = new Date(date); start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
        const end = new Date(start); end.setDate(end.getDate() + 6);
        return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'monthly': return MONTHS[calMonth] + ' ' + calYear;
      case 'quarterly': {
        const q = Math.floor(calMonth / 3) + 1;
        return `Q${q} ${calYear}`;
      }
      case 'yearly': return `${calYear}`;
      default: return '';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Dispatch & receive analytics with rollup hierarchy</p>
        </div>
        <button className="btn btn-secondary text-sm" onClick={handleExport}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export Excel
        </button>
      </div>

      {/* ── Period Selector ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => handlePeriodChange(p.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                period === p.key ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Date Navigator ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={navPrev} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 min-w-[200px] text-center">{periodLabel()}</h2>
        <button onClick={navNext} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7"/></svg>
        </button>
        <button onClick={navToday} className="px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 border border-teal-200">
          Today
        </button>
        <div className="relative ml-2">
          <button
            onClick={openCalendar}
            className={`p-2 rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors ${showCalendar ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 bg-white'}`}
            title="Calendar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </button>

          {/* ── Calendar Dropdown ── */}
          {showCalendar && (
            <div className="absolute top-full mt-2 right-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
              {/* ── YEARS VIEW ── */}
              {calView === 'years' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCalView('calendar')} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-800">Select Year</span>
                    <div className="w-5" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {yearOptions.map(y => (
                      <button key={y} onClick={() => selectYear(y)}
                        className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          y === calYear ? 'bg-teal-500 text-white' : 'hover:bg-gray-100 text-gray-700'
                        }`}>
                        {y}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── MONTHS VIEW ── */}
              {calView === 'months' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCalView('years')} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <button onClick={() => setCalView('years')}
                      className="text-sm font-semibold text-teal-600 hover:text-teal-700">
                      {calYear}
                    </button>
                    <div className="w-5" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {monthGrid.map(m => (
                      <button key={m.idx}
                        onClick={() => !m.disabled && selectMonth(m.idx)}
                        disabled={m.disabled}
                        className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                          m.disabled ? 'text-gray-300 cursor-not-allowed bg-gray-50' :
                          calMonth === m.idx && calYear === selectedDate.getFullYear() ? 'bg-teal-500 text-white' :
                          'hover:bg-gray-100 text-gray-700'
                        }`}>
                        {m.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── CALENDAR DAY VIEW ── */}
              {calView === 'calendar' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={calNavPrev} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setCalView('months'); setCalMonth(selectedDate.getMonth()); }}
                        className="text-xs font-semibold text-gray-700 hover:text-teal-600">
                        {MONTHS[calMonth].substring(0, 3)}
                      </button>
                      <button onClick={() => setCalView('years')}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                        {calYear}
                      </button>
                    </div>
                    <button onClick={calNavNext}
                      disabled={calYear === todayYear && calMonth >= todayMonth}
                      className={`p-1 rounded text-gray-500 ${
                        calYear === todayYear && calMonth >= todayMonth ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'
                      }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5">
                    {DOW.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}
                    {calGrid.map((day, i) => {
                      if (!day) return <div key={`e${i}`} className="aspect-square" />;
                      const isToday = day.date === todayStr;
                      const isSelected = day.date === date && period === 'daily';
                      return (
                        <button
                          key={day.date}
                          onClick={() => selectDay(day.date)}
                          className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition-colors relative ${
                            isSelected ? 'bg-teal-500 text-white' :
                            isToday ? 'bg-teal-50 text-teal-700 border border-teal-300' :
                            'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <span className="font-semibold">{day.day}</span>
                          {day.hasData > 0 && !isSelected && (
                            <span className={`absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full ${day.received ? 'bg-blue-400' : 'bg-teal-400'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400 justify-center">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400" /> Dispatched</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Received</span>
                  </div>

                  <button onClick={goToMonth}
                    className="w-full mt-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 border border-teal-200">
                    Go to {MONTHS[calMonth]} {calYear}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total Dispatched" value={data?.summary?.total_dispatched || 0} sub={`units this ${period}`} color="teal" />
            <StatCard label="Dispatch Events" value={data?.summary?.total_events || 0} sub="transactions" />
            <StatCard label="Unique Items" value={data?.summary?.unique_items || 0} sub="consumable types" />
            <StatCard label="Destinations" value={data?.summary?.destinations || 0} sub="facilities / depts" />
            <div className="card p-4 flex flex-col justify-center">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">vs Previous</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-2xl font-bold ${trendUp ? 'text-red-500' : 'text-teal-500'}`}>
                  {trendUp ? '↑' : trendDelta < 0 ? '↓' : '→'}
                </span>
                <span className="text-xl font-semibold text-gray-700">
                  {trendPct > 0 ? `${trendPct}%` : '—'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">previous {period}</p>
            </div>
          </div>

          {/* ── Breakdown Panels (the "makeup") ── */}
          {/* Daily breakdown in weekly view */}
          {period === 'weekly' && data?.daily_breakdown?.length > 0 && (
            <div className="card p-5 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily breakdown (Week makeup)</h3>
              <div className="grid grid-cols-7 gap-2">
                {data.daily_breakdown.map(d => {
                  const dayName = new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <div key={d.day} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500">{dayName}</p>
                      <p className="text-lg font-bold text-teal-600 mt-1">{d.qty}</p>
                      <p className="text-[10px] text-gray-400">{d.events} events</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly breakdown in monthly view */}
          {period === 'monthly' && data?.weekly_breakdown?.length > 0 && (
            <div className="card p-5 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Weekly breakdown (Month makeup)</h3>
              <div className="grid grid-cols-5 gap-2">
                {data.weekly_breakdown.map(w => {
                  const weekEnd = new Date(w.week_start); weekEnd.setDate(weekEnd.getDate() + 6);
                  return (
                    <div key={w.week_start} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500">
                        Week of {new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-lg font-bold text-teal-600 mt-1">{w.qty}</p>
                      <p className="text-[10px] text-gray-400">{w.events} events</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly breakdown in quarterly / yearly view */}
          {(period === 'quarterly' || period === 'yearly') && data?.monthly_breakdown?.length > 0 && (
            <div className="card p-5 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {period === 'quarterly' ? 'Monthly breakdown (Quarter makeup)' : 'Monthly breakdown (Year makeup)'}
              </h3>
              <div className="overflow-x-auto">
                <div className="flex gap-3">
                  {data.monthly_breakdown.map(m => (
                    <div key={m.month_start} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100 min-w-[100px] flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-500">
                        {new Date(m.month_start).toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-lg font-bold text-teal-600 mt-1">{m.qty}</p>
                      <p className="text-[10px] text-gray-400">{m.events} events</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 dispatched items</h3>
              {byItemChart.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byItemChart} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#1D9E75" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-10">No data for this period</p>}
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribution by facility</h3>
              {byFacilityChart.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byFacilityChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {byFacilityChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} consumables`, name]} />
                    <Legend 
                      wrapperStyle={{ fontSize: '10px' }}
                      formatter={(val) => val?.length > 20 ? val.substring(0, 20) + '...' : val}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-10">No data</p>}
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="card overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Detailed breakdown by item</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  {['Consumable','Category','Qty Dispatched','Events','Remaining Stock','Status'].map(h => <th key={h} className="table-th">{h}</th>)}
                </tr></thead>
                <tbody>
                  {data?.by_item?.length ? data.by_item.map((item, i) => {
                    const s = parseInt(item.remaining);
                    const status = s === 0 ? <span className="badge badge-out">Out</span> : s <= 5 ? <span className="badge badge-low">Low</span> : <span className="badge badge-ok">OK</span>;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="table-td font-medium">{item.name}</td>
                        <td className="table-td"><span className="badge badge-cat">{item.category}</span></td>
                        <td className="table-td font-semibold text-red-500">{item.qty}</td>
                        <td className="table-td">{item.events}</td>
                        <td className="table-td font-semibold">{item.remaining}</td>
                        <td className="table-td">{status}</td>
                      </tr>
                    );
                  }) : <tr><td colSpan={6} className="table-td text-center py-10 text-gray-400">No dispatch data for this period</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Received items ── */}
          {data?.received_items?.length > 0 && (
            <div className="card overflow-hidden mb-5">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Received items ({data.summary?.total_received || 0} total)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>
                    <th className="table-th">Consumable</th>
                    <th className="table-th">Category</th>
                    <th className="table-th">Qty Received</th>
                    <th className="table-th">Events</th>
                  </tr></thead>
                  <tbody>
                    {data.received_items.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="table-td font-medium">{r.name}</td>
                        <td className="table-td"><span className="badge badge-cat">{r.category}</span></td>
                        <td className="table-td font-semibold text-blue-600">{r.qty}</td>
                        <td className="table-td">{r.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Destination breakdown ── */}
          {data?.by_destination?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Breakdown by destination</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>
                    <th className="table-th">Destination</th>
                    <th className="table-th">Total Qty</th>
                    <th className="table-th">Events</th>
                  </tr></thead>
                  <tbody>
                    {data.by_destination.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="table-td font-medium">{d.destination}</td>
                        <td className="table-td font-semibold text-teal-600">{d.qty}</td>
                        <td className="table-td">{d.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}