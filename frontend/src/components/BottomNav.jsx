import React from 'react';
import { NavLink } from 'react-router-dom';

const BottomNav = ({ navItems = [] }) => {
  // Show only first 5 items on mobile
  const items = navItems.slice(0, 5);
  
  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-slate-200 safe-area-bottom z-50 md:hidden">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/' || item.path === '/coach'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-slate-400 hover:text-primary-400'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
