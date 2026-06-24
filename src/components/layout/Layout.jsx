import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static z-40 transition-transform duration-300`}> 
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} onClose={() => setMobileMenuOpen(false)} />
      </div>

      <div className={`transition-all duration-300 min-h-screen ${mobileMenuOpen ? 'lg:ml-0' : sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} ${mobileMenuOpen ? 'filter blur-sm lg:filter-none' : ''}`}>
        <Header onMenuClick={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="min-h-[calc(100vh-4rem)] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
