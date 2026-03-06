import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  /** When true the group is a single top-level item (no collapsible header). */
  standalone?: boolean;
}

interface SidebarNavProps {
  visibleGroups: SidebarGroup[];
  activeTab: ActiveTab;
  collapsed: boolean;
  onSelect: (tab: ActiveTab) => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ visibleGroups, activeTab, collapsed, onSelect }) => {
  // Track which groups are expanded — default all open
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    visibleGroups.forEach(g => { init[g.label] = true; });
    return init;
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <nav className="py-2 flex-1">
      {visibleGroups.map((group, gi) => {
        const isExpanded = expandedGroups[group.label] !== false;
        const isStandalone = group.standalone || group.items.length === 1;
        const hasActiveChild = group.items.some(item => activeTab === item.id);

        // Standalone items (Dashboard, Help) — render as a single button
        if (isStandalone && !collapsed) {
          const item = group.items[0];
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={group.label} className={gi > 0 ? 'mt-0.5' : ''}>
              <button
                onClick={() => onSelect(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-sm font-medium
                  ${isActive
                    ? 'bg-purple-100 text-purple-700 border-r-2 border-purple-500'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-r-2 border-transparent'
                  }`}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto flex-shrink-0 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            </div>
          );
        }

        return (
          <div key={group.label} className={gi > 0 ? 'mt-0.5' : ''}>
            {/* Collapsed: show divider between groups */}
            {collapsed && gi > 0 && (
              <div className="mx-3 my-2 border-t border-gray-200" />
            )}

            {/* Group header (collapsible) — hidden when sidebar collapsed */}
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-2 px-4 pt-3 pb-1 text-left select-none transition-colors group
                  ${hasActiveChild ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                }
                <span className="text-xs font-semibold uppercase tracking-widest">{group.label}</span>
              </button>
            )}

            {/* Group items */}
            {(collapsed || isExpanded) && group.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={`${group.label}-${item.id}`}
                  onClick={() => onSelect(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 py-2.5 text-left transition-colors text-sm font-medium
                    ${collapsed ? 'justify-center px-3' : 'px-5'}
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
                    <span className="truncate flex-1">{item.label}</span>
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
        );
      })}
    </nav>
  );
};

export default SidebarNav;
