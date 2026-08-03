import { Outlet } from 'react-router-dom';
import { Footbar } from './Footbar';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <main className="main-content">
          <Outlet />
        </main>
        <Footbar />
      </div>
    </div>
  );
}
