import { useRef, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import ChatAssistant from './ChatAssistant';
import EcewsLogo from './EcewsLogo';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  {
    label: 'Inventory Management',
    to: '/dashboard/inventory',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
    ),
    children: [
      { to: '/dashboard/daily-usage', label: 'Daily Usage Log', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
        </svg>
      )},
      { to: '/dashboard/inventory', label: 'Stock Overview', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      )},
      { to: '/dashboard/receive', label: 'Stock In (Receiving)', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      )},
      { to: '/dashboard/dispatch', label: 'Stock Out (Distribution)', adminOnly: true, icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
        </svg>
      )},
      { to: '/dashboard/stock-transfer', label: 'Stock Transfer', adminOnly: true, icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>
      )},
      { to: '/dashboard/procurement', label: 'Procurement', adminOnly: true, icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/>
        </svg>
      )},
      { to: '/dashboard/approve-requests', label: 'Approve Requests', adminOnly: true, icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M5 13l4 4L19 7m-4-3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5"/>
        </svg>
      )},
      { to: '/dashboard/suppliers', label: 'Suppliers', adminOnly: true, icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
      )},
      { to: '/dashboard/warehouse', label: 'Warehouse', adminOnly: true, icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      )},
      { to: '/dashboard/stock-adjustments', label: 'Stock Adjustments', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      )},
      { to: '/dashboard/batch-expiry', label: 'Batch & Expiry', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )},

    ],
  },
  { to: '/dashboard/requests', label: 'Requests', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  )},
  { to: '/dashboard/reports', label: 'Reports & Analytics', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>
  )},
  { to: '/dashboard/user-management', label: 'User Management', adminOnly: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  )},
  { to: '/dashboard/activity-log', label: 'Activity Log', adminOnly: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  )},
  { to: '/dashboard/settings', label: 'Settings', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  )},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Auto-expand the Inventory Management group when any child route is active
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(child => location.pathname.startsWith(child.to));
        if (isChildActive) {
          setExpandedGroups(prev => ({ ...prev, [item.to]: true }));
        }
      }
    });
  }, [location.pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Resolve nav items: flatten groups, filter children by role
  const resolvedNavItems = navItems.reduce((acc, item) => {
    if (item.children) {
      // Filter children by role
      const visibleChildren = item.children.filter(child => !child.adminOnly || user?.role === 'admin' || user?.role === 'super_admin');
      if (visibleChildren.length > 0) {
        acc.push({ ...item, children: visibleChildren });
      }
    } else if (!item.adminOnly || user?.role === 'admin' || user?.role === 'super_admin') {
      acc.push(item);
    }
    return acc;
  }, []);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Keyboard navigation - arrow keys to cycle through sidebar items
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!navRef.current) return;
      const items = navRef.current.querySelectorAll('a');
      if (items.length === 0) return;
      const current = document.activeElement;
      const currentIdx = Array.from(items).indexOf(current);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = currentIdx >= items.length - 1 ? 0 : currentIdx + 1;
        items[nextIdx].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
        items[prevIdx].focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-emerald-500 dark:border-emerald-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            {/* White plate so the green logo artwork reads against the emerald sidebar */}
            <div className="bg-white rounded-lg px-3 py-2.5 w-full max-w-[196px] shadow-sm">
              <EcewsLogo className="w-full h-auto" />
            </div>
          </div>
          {/* Close button - mobile only */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-emerald-200 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 text-xs font-bold text-emerald-200 dark:text-emerald-300 uppercase tracking-wider mb-2">Main</p>
        {resolvedNavItems.map(item => {
          if (item.children) {
            const isExpanded = expandedGroups[item.to] ?? false;
            return (
              <div key={item.to}>
                <button
                  onClick={() => toggleGroup(item.to)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-1 focus-visible:ring-offset-emerald-800 font-semibold text-white hover:bg-emerald-700 dark:hover:bg-emerald-700"
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                  >
                    <path d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
                {isExpanded && (
                  <div className="mt-0.5 ml-4 space-y-0.5 border-l border-emerald-500/40 dark:border-emerald-700/40 pl-2">
                    {item.children.map(child => (
                      <NavLink key={child.to} to={child.to} end className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-1 focus-visible:ring-offset-emerald-800 ${
                          isActive
                            ? 'bg-emerald-800 dark:bg-emerald-950 text-white font-bold shadow-md'
                            : 'text-emerald-100 dark:text-emerald-200 hover:bg-emerald-700 dark:hover:bg-emerald-700 hover:text-white'
                        }`
                      }>
                        {child.icon}
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-1 focus-visible:ring-offset-emerald-800 font-semibold ${
                isActive
                  ? 'bg-emerald-800 dark:bg-emerald-950 text-white font-bold shadow-md'
                  : 'text-white hover:bg-emerald-700 dark:hover:bg-emerald-700'
              }`
            }>
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-emerald-500 dark:border-emerald-700">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-emerald-100 dark:text-emerald-200 capitalize">{user?.role}</p>
          </div>
          <button onClick={toggleTheme} className="text-emerald-200 dark:text-emerald-300 hover:text-white dark:hover:text-white transition-colors mr-0.5" title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
          <button onClick={handleLogout} className="text-emerald-200 dark:text-emerald-300 hover:text-white dark:hover:text-white transition-colors" title="Logout">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:flex lg:flex-col w-56 bg-emerald-900 dark:bg-emerald-950 border-r border-emerald-800 dark:border-emerald-800 flex-shrink-0 shadow-lg">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-64 bg-emerald-700 dark:bg-emerald-900 flex flex-col z-50 shadow-2xl animate-slide-in">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Top Navbar */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-emerald-900 dark:bg-emerald-950 border-b border-emerald-800 dark:border-emerald-800 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1 hover:bg-emerald-800 rounded text-emerald-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="leading-tight">
              <p className="text-lg font-black text-white">ECEWS</p>
              <p className="text-xs text-emerald-100 dark:text-emerald-200 font-bold">Consumables & Logistics Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-emerald-100 hover:bg-emerald-800 transition-colors border border-emerald-700"
                title="Menu"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3"/>
                  <circle cx="12" cy="10" r="3"/>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                <svg className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1">
                  {/* Theme Toggle */}
                  <button
                    onClick={() => { toggleTheme(); setMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {dark ? (
                      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                      </svg>
                    )}
                    {dark ? 'Light Mode' : 'Dark Mode'}
                  </button>

                  {/* Logout */}
                  <button
                    onClick={() => { handleLogout(); setMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
      <ChatAssistant />
    </div>
  );
}