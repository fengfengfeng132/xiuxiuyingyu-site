import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', label: '首页' },
  { to: '/practice', label: '做题' },
  { to: '/wrong', label: '错题' },
  { to: '/review', label: '复习' },
  { to: '/parent', label: '家长' },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Outlet />
      <footer className="bottom-nav">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link key={item.to} to={item.to} className={`bottom-nav-item ${active ? 'active' : ''}`}>
              {item.label}
            </Link>
          );
        })}
      </footer>
    </div>
  );
}
