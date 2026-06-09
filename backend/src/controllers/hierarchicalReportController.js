const pool = require('../config/db');

// ── Date helpers ──
const weekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
};

const weekEnd = (date) => {
  const mon = new Date(weekStart(date));
  mon.setDate(mon.getDate() + 6);
  return mon.toISOString().slice(0, 10);
};

const monthStart = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const monthEnd = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
};

const quarterStart = (date) => {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3);
  return `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`;
};

const quarterEnd = (date) => {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3);
  const endMonth = q * 3 + 2;
  return `${d.getFullYear()}-${String(endMonth + 1).padStart(2, '0')}-${new Date(d.getFullYear(), endMonth + 1, 0).getDate()}`;
};

const yearStart = (date) => `${new Date(date).getFullYear()}-01-01`;
const yearEnd = (date) => `${new Date(date).getFullYear()}-12-31`;

// ── Get date range per period ──
const getRange = (period, refDate) => {
  const d = refDate || new Date().toISOString().slice(0, 10);
  switch (period) {
    case 'daily':   return { from: d, to: d, label: `Daily — ${new Date(d).toDateString()}` };
    case 'weekly':  return { from: weekStart(d), to: weekEnd(d), label: `Week of ${weekStart(d)} to ${weekEnd(d)}` };
    case 'monthly': return { from: monthStart(d), to: monthEnd(d), label: `${new Date(d).toLocaleString('default', { month: 'long' })} ${new Date(d).getFullYear()}` };
    case 'quarterly': {
      const q = Math.floor(new Date(d).getMonth() / 3) + 1;
      return { from: quarterStart(d), to: quarterEnd(d), label: `Q${q} ${new Date(d).getFullYear()}` };
    }
    case 'yearly':  return { from: yearStart(d), to: yearEnd(d), label: `${new Date(d).getFullYear()}` };
    default:        return { from: d, to: d, label: `Daily — ${new Date(d).toDateString()}` };
  }
};

// ── Main hierarchical report ──
exports.getHierarchicalReport = async (req, res) => {
  const { period = 'monthly', date } = req.query;
  const refDate = date || new Date().toISOString().slice(0, 10);
  const { from, to, label } = getRange(period, refDate);

  try {
    // ── Dispatch summary ──
    const dispSummary = await pool.query(`
      SELECT
        COALESCE(SUM(quantity), 0) as total_dispatched,
        COUNT(id) as total_events,
        COUNT(DISTINCT consumable_id) as unique_items,
        COUNT(DISTINCT destination) as destinations
      FROM dispatch_logs
      WHERE dispatched_at::date >= $1 AND dispatched_at::date <= $2
    `, [from, to]);

    const dispByItem = await pool.query(`
      SELECT c.id, c.name, cat.name as category, SUM(dl.quantity) as qty,
             COUNT(dl.id) as events, c.stock as remaining
      FROM dispatch_logs dl
      JOIN consumables c ON dl.consumable_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE dl.dispatched_at::date >= $1 AND dl.dispatched_at::date <= $2
      GROUP BY c.id, c.name, cat.name, c.stock
      ORDER BY qty DESC
    `, [from, to]);

    const dispByCategory = await pool.query(`
      SELECT cat.name as category, SUM(dl.quantity) as qty, COUNT(dl.id) as events
      FROM dispatch_logs dl
      JOIN consumables c ON dl.consumable_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE dl.dispatched_at::date >= $1 AND dl.dispatched_at::date <= $2
      GROUP BY cat.name
      ORDER BY qty DESC
    `, [from, to]);

    const dispByDestination = await pool.query(`
      SELECT destination, SUM(quantity) as qty, COUNT(id) as events
      FROM dispatch_logs
      WHERE dispatched_at::date >= $1 AND dispatched_at::date <= $2
      GROUP BY destination
      ORDER BY qty DESC
    `, [from, to]);

    // ── Receive summary ──
    const recSummary = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as total_received, COUNT(id) as events
      FROM receive_logs
      WHERE received_at::date >= $1 AND received_at::date <= $2
    `, [from, to]);

    const recByItem = await pool.query(`
      SELECT c.id, c.name, cat.name as category, SUM(rl.quantity) as qty,
             COUNT(rl.id) as events
      FROM receive_logs rl
      JOIN consumables c ON rl.consumable_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE rl.received_at::date >= $1 AND rl.received_at::date <= $2
      GROUP BY c.id, c.name, cat.name
      ORDER BY qty DESC
    `, [from, to]);

    // ── Daily breakdown (for weekly/monthly to show drill-down) ──
    let dailyBreakdown = [];
    if (period === 'weekly') {
      const breakdown = await pool.query(`
        SELECT dl.dispatched_at::date as day, SUM(dl.quantity) as qty, COUNT(dl.id) as events
        FROM dispatch_logs dl
        WHERE dl.dispatched_at::date >= $1 AND dl.dispatched_at::date <= $2
        GROUP BY dl.dispatched_at::date
        ORDER BY day
      `, [from, to]);
      dailyBreakdown = breakdown.rows;
    }

    // ── Weekly breakdown for monthly view ──
    let weeklyBreakdown = [];
    if (period === 'monthly') {
      const breakdown = await pool.query(`
        SELECT
          date_trunc('week', dl.dispatched_at)::date as week_start,
          SUM(dl.quantity) as qty,
          COUNT(dl.id) as events
        FROM dispatch_logs dl
        WHERE dl.dispatched_at::date >= $1 AND dl.dispatched_at::date <= $2
        GROUP BY date_trunc('week', dl.dispatched_at)::date
        ORDER BY week_start
      `, [from, to]);
      weeklyBreakdown = breakdown.rows;
    }

    // ── Monthly breakdown for quarterly/yearly view ──
    let monthlyBreakdown = [];
    if (period === 'quarterly' || period === 'yearly') {
      const breakdown = await pool.query(`
        SELECT
          date_trunc('month', dl.dispatched_at)::date as month_start,
          SUM(dl.quantity) as qty,
          COUNT(dl.id) as events
        FROM dispatch_logs dl
        WHERE dl.dispatched_at::date >= $1 AND dl.dispatched_at::date <= $2
        GROUP BY date_trunc('month', dl.dispatched_at)::date
        ORDER BY month_start
      `, [from, to]);
      monthlyBreakdown = breakdown.rows;
    }

    // ── Previous period comparison ──
    const prevRange = getRange(period, prevPeriodRef(period, refDate));
    const prevSummary = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as total_dispatched
      FROM dispatch_logs
      WHERE dispatched_at::date >= $1 AND dispatched_at::date <= $2
    `, [prevRange.from, prevRange.to]);

    res.json({
      period,
      date: refDate,
      range: { from, to, label },
      summary: {
        ...dispSummary.rows[0],
        total_received: recSummary.rows[0]?.total_received || 0,
        receive_events: recSummary.rows[0]?.events || 0,
      },
      by_item: dispByItem.rows,
      by_category: dispByCategory.rows,
      by_destination: dispByDestination.rows,
      received_items: recByItem.rows,
      daily_breakdown: dailyBreakdown,
      weekly_breakdown: weeklyBreakdown,
      monthly_breakdown: monthlyBreakdown,
      trend: {
        current: parseInt(dispSummary.rows[0]?.total_dispatched || 0),
        previous: parseInt(prevSummary.rows[0]?.total_dispatched || 0),
      },
    });
  } catch (err) {
    console.error('Hierarchical report error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Previous period reference for trend comparison ──
const prevPeriodRef = (period, refDate) => {
  const d = new Date(refDate);
  switch (period) {
    case 'daily':
      d.setDate(d.getDate() - 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() - 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() - 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() - 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() - 1);
      break;
    default: break;
  }
  return d.toISOString().slice(0, 10);
};

// ── Calendar data (dispatch counts per day for a given month) ──
exports.getCalendarData = async (req, res) => {
  const { month } = req.query; // e.g. "2026-06"
  const year = month ? parseInt(month.split('-')[0]) : new Date().getFullYear();
  const mon = month ? parseInt(month.split('-')[1]) : new Date().getMonth() + 1;
  const from = `${year}-${String(mon).padStart(2, '0')}-01`;
  const endDay = new Date(year, mon, 0).getDate();
  const to = `${year}-${String(mon).padStart(2, '0')}-${endDay}`;

  try {
    const rows = await pool.query(`
      SELECT dl.dispatched_at::date as day,
             SUM(dl.quantity) as dispatched,
             COUNT(dl.id) as events
      FROM dispatch_logs dl
      WHERE dl.dispatched_at::date >= $1 AND dl.dispatched_at::date <= $2
      GROUP BY dl.dispatched_at::date
      ORDER BY day
    `, [from, to]);

    const recRows = await pool.query(`
      SELECT received_at::date as day,
             SUM(quantity) as received
      FROM receive_logs
      WHERE received_at::date >= $1 AND received_at::date <= $2
      GROUP BY received_at::date
    `, [from, to]);

    // Build calendar map
    const map = {};
    rows.rows.forEach(r => { map[r.day.toISOString().slice(0,10)] = { dispatched: parseInt(r.dispatched), events: parseInt(r.events) }; });
    recRows.rows.forEach(r => {
      const key = r.day.toISOString().slice(0,10);
      if (!map[key]) map[key] = { dispatched: 0, events: 0 };
      map[key].received = parseInt(r.received);
    });

    // Fill all days
    const days = [];
    for (let d = 1; d <= endDay; d++) {
      const dateStr = `${year}-${String(mon).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = new Date(year, mon - 1, d).getDay();
      days.push({
        date: dateStr,
        day: d,
        dow,
        dispatched: map[dateStr]?.dispatched || 0,
        received: map[dateStr]?.received || 0,
        events: map[dateStr]?.events || 0,
        hasData: !!(map[dateStr]?.dispatched || map[dateStr]?.received),
      });
    }

    res.json({ month: `${year}-${String(mon).padStart(2,'0')}`, days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};