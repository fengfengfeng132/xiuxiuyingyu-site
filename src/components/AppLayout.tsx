import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  {
    to: '/',
    label: '首页',
    image: '/images/ui-ipad/nav-home-icon.png',
    paths: ['/', '/modes', '/dictation', '/practice', '/result', '/stars'],
  },
  {
    to: '/wrong',
    label: '词表',
    image: '/images/ui-ipad/nav-book-icon.png',
    paths: ['/wrong', '/review'],
  },
  { to: '/parent', label: '统计', image: '/images/ui-ipad/nav-stats-icon.png', paths: ['/parent'] },
  { to: '/settings', label: '我的', image: '/images/ui-ipad/nav-profile-icon.png', paths: ['/settings'] },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Outlet />
      <nav className="side-nav" aria-label="主要导航">
        {navItems.map((item) => {
          const active = item.paths.includes(location.pathname);
          return (
            <Link key={item.to} to={item.to} className={`side-nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
              <img
                className="side-nav-image-icon"
                src={item.image}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
