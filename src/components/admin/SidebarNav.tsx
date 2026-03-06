import React from 'react';
import type { ActiveTab } from './AdminHome';

export interface SidebarItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
  roles: string[];
  badge?: number;
}

export interface SidebarGroup {
  label: string;
  roles: string[];
  items: SidebarItem[];
}

interface SidebarNavProps {
  visibleGroups: SidebarGroup[];
  activeTab: ActiveTab;
  collapsed: boolean;
  onSelect: (tab: ActiveTab) => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ visibleGroups, activeTab, collapsed, onSelect }) => (
  <nav className="py-3 flex-1">
    {visibleGroups.map((group, gi) => (
      <div key={group.label} className={gi > 0 ? 'mt-1' : ''}>
        {!collapsed && (
          <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-widest select-none">
            {group.label}
          </p>
        )}
        {collapsed && gi > 0 && (
          <div className="mx-3 my-2 border-t border-gray-200" />
        )}
        {group.items.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={`${group.label}-${item.id}`}
              onClick={() => onSelect(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-purple-100 text-purple-700 border-r-2 border-purple-500'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-r-2 border-transparent'
                }`}
            >
              <div className="relative flex-shrink-0">
                <Icon className="h-[18px] w-[18px]" />
                {collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="text-sm font-medium truncate flex-1">{item.label}</span>
              )}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto flex-shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    ))}
  </nav>
);

export default SidebarNav;
