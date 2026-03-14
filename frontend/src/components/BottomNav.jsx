import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';

const BottomNav = ({ navItems = [], unreadCount = 0 }) => {
  const [showMore, setShowMore] = useState(false);
  
  // Show first 4 items + "More" if there are more than 5
  const hasOverflow = navItems.length > 5;
  const mainItems = hasOverflow ? navItems.slice(0, 4) : navItems.slice(0, 5);
  const overflowItems = hasOverflow ? navItems.slice(4) : [];
  
  return (
    <>
      {/* Overflow Sheet */}
      {showMore && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60] md:hidden" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[70] md:hidden animate-in slide-in-from-bottom duration-200 safe-area-bottom">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-bold text-slate-800">More</span>
              <button onClick={() => setShowMore(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="py-2 px-3 grid grid-cols-3 gap-2 pb-6">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/' || item.path === '/coach'}
                    onClick={() => setShowMore(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center py-4 px-2 rounded-xl transition-colors ${
                        isActive ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:bg-slate-50'
                      }`
                    }
                  >
                    <div className="relative">
                      <Icon size={22} />
                      {item.showBadge && unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium mt-1.5">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 w-full bg-white border-t border-slate-200 safe-area-bottom z-50 md:hidden">
        <div className="flex justify-around items-center h-16">
          {mainItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || item.path === '/coach'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative ${
                    isActive ? 'text-primary-600' : 'text-slate-400 hover:text-primary-400'
                  }`
                }
              >
                <div className="relative">
                  <Icon size={22} />
                  {item.showBadge && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}

          {/* More button */}
          {hasOverflow && (
            <button
              onClick={() => setShowMore(true)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                showMore ? 'text-primary-600' : 'text-slate-400 hover:text-primary-400'
              }`}
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default BottomNav;
