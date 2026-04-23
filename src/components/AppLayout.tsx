import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  {
    to: '/',
    label: '首页',
    icon: 'home',
    image: '/images/ui-ipad/nav-home-icon.png',
    paths: ['/', '/modes', '/dictation', '/practice', '/result', '/stars'],
  },
  {
    to: '/wrong',
    label: '词表',
    icon: 'book',
    image: '/images/ui-ipad/nav-book-icon.png',
    paths: ['/wrong', '/review'],
  },
  { to: '/parent', label: '统计', icon: 'stats', image: '/images/ui-ipad/nav-stats-icon.png', paths: ['/parent'] },
  { to: '/settings', label: '我的', icon: 'me', image: '/images/ui-ipad/nav-profile-icon.png', paths: ['/settings'] },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Outlet />
      <footer className="bottom-nav">
        {navItems.map((item) => {
          const active = item.paths.includes(location.pathname);
          return (
            <Link key={item.to} to={item.to} className={`bottom-nav-item ${active ? 'active' : ''}`}>
              <img className="bottom-nav-image-icon" src={item.image} alt="" aria-hidden="true" />
              <span className={`bottom-nav-icon bottom-nav-icon-${item.icon}`} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </footer>
    </div>
  );
}
