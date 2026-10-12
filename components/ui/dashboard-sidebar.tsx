'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  UsersRound,
  UserRoundPlus,
  HandHeart,
  HandCoins,
  PlusCircle,
  Receipt,
  ReceiptText,
  BarChart3,
  ShieldCheck, 
  Hash,
  Wallet,
  ClipboardList,
  BookOpenText,
  Landmark,
  ChevronRight,
  Inbox,
  Calendar,
  Activity,
  CreditCard,
  Globe,
  Terminal,
  Blocks,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  X
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  href?: string;
  badge?: number | string;
  shortcut?: string;
  permission?: string | string[];
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

// Foundation Management System standard navigation hierarchy
export const foundationNavGroups: NavGroupData[] = [
  {
    items: [
      { id: 'home', title: 'Home', icon: LayoutDashboard, href: '/' },
    ]
  },
  {
    heading: 'Foundation Management',
    items: [
      {
        id: 'group-parent',
        title: 'Group',
        icon: Users,
        children: [
          { id: 'group-add', title: 'Add Group', icon: UserRoundPlus, href: '/groups/add', permission: 'groups.create' },
          { id: 'group-manage', title: 'Manage Group', icon: Users, href: '/groups/manage', permission: 'groups.view' },
          { id: 'group-fund', title: 'Group Fund', icon: Wallet, href: '/groups/fund', permission: 'group_funds.view' },
        ]
      },
      {
        id: 'member-parent',
        title: 'Member',
        icon: UsersRound,
        children: [
          { id: 'member-add', title: 'Add Member', icon: UserRoundPlus, href: '/members/add', permission: 'members.create' },
          { id: 'member-manage', title: 'Manage Member', icon: UsersRound, href: '/members/manage', permission: 'members.view' },
          { id: 'member-due-list', title: 'Member Due List', icon: ClipboardList, href: '/members/due-list', permission: 'members.due_list.view' },
        ]
      },
      {
        id: 'beneficiary-parent',
        title: 'Beneficiary',
        icon: HandHeart,
        children: [
          { id: 'beneficiary-add', title: 'Add Beneficiary', icon: UserRoundPlus, href: '/beneficiaries/add', permission: 'beneficiaries.create' },
          { id: 'beneficiary-manage', title: 'Manage Beneficiary', icon: UsersRound, href: '/beneficiaries/manage', permission: 'beneficiaries.view' },
          { id: 'beneficiary-ledger', title: 'Beneficiary Ledger', icon: BookOpenText, href: '/beneficiaries/ledger', permission: 'beneficiary_ledger.view' },
        ]
      },
      {
        id: 'donation-parent',
        title: 'Donation',
        icon: HandCoins,
        children: [
          { id: 'donation-add', title: 'Add Donation', icon: PlusCircle, href: '/donations/add', permission: 'donations.create' },
          { id: 'donation-manage', title: 'Manage Donation', icon: ReceiptText, href: '/donations/manage', permission: 'donations.view' },
          { id: 'donation-report', title: 'Donation Report', icon: BarChart3, href: '/donations/report', permission: 'donation_reports.view' },
        ]
      },
      {
        id: 'sadaqah-parent',
        title: 'Sadaqah',
        icon: HandHeart,
        children: [
          { id: 'sadaqah-add', title: 'Add Sadaqah', icon: PlusCircle, href: '/sadaqah/add', permission: 'sadaqah.create' },
          { id: 'sadaqah-manage', title: 'Manage Sadaqah', icon: ReceiptText, href: '/sadaqah/manage', permission: 'sadaqah.view' },
          { id: 'sadaqah-report', title: 'Sadaqah Report', icon: BarChart3, href: '/sadaqah/report', permission: 'sadaqah_reports.view' },
        ]
      },
      {
        id: 'qard-hasan-parent',
        title: 'Qard Hasan',
        icon: Landmark,
        children: [
          { id: 'qard-hasan-add', title: 'Add Qard Hasan', icon: PlusCircle, href: '/qard-hasan/add', permission: 'qard_hasan.create' },
          { id: 'qard-hasan-manage', title: 'Manage Qard Hasan', icon: ReceiptText, href: '/qard-hasan/manage', permission: 'qard_hasan.view' },
          { id: 'qard-hasan-repayment', title: 'Repayment', icon: Wallet, href: '/qard-hasan/repayment', permission: ['qard_hasan.repayment.create', 'qard_hasan.repayment.view'] },
          { id: 'qard-hasan-report', title: 'Report', icon: BarChart3, href: '/qard-hasan/report', permission: 'qard_hasan_reports.view' },
        ]
      },
      {
        id: 'contribution-parent',
        title: 'Contribution',
        icon: Receipt,
        children: [
          { id: 'contribution-add', title: 'Add Contribution', icon: PlusCircle, href: '/contributions/add', permission: 'contributions.create' },
          { id: 'contribution-manage', title: 'Manage Contribution', icon: ReceiptText, href: '/contributions/manage', permission: 'contributions.view' },
          { id: 'contribution-report', title: 'Contribution Report', icon: BarChart3, href: '/contributions/report', permission: 'contribution_reports.view' },
          { id: 'contribution-due-list', title: 'Due Contribution', icon: Calendar, href: '/contributions/due-list', permission: 'contributions.due_list.view' },
        ]
      },
      {
        id: 'roles-parent',
        title: 'Role Permissions',
        icon: ShieldCheck,
        href: '/roles',
        permission: 'roles.manage',
      }
    ]
  }
];

function NavItem({ 
  item, 
  activeId, 
  onSelect,
  level = 0
}: { 
  item: NavItemData; 
  activeId: string; 
  onSelect: (id: string, href?: string) => void;
  level?: number;
}) {
  const pathname = usePathname();
  const isActive = activeId === item.id || (item.href && (pathname === item.href || activeId === item.href));
  const hasChildren = !!(item.children && item.children.length > 0);
  const [isOpen, setIsOpen] = useState(true);

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else {
      onSelect(item.id, item.href);
    }
  };

  const navContent = (
    <div 
      className={`group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none
        ${isActive 
          ? 'bg-black/5 dark:bg-white/10 text-foreground font-medium' 
          : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground/90'
        }
      `}
      style={{ paddingLeft: `${level * 12 + 10}px` }}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <item.icon 
          className={`w-[16px] h-[16px] shrink-0 transition-colors
            ${isActive ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground/70'}
          `} 
          strokeWidth={1.5} 
        />
        <span className="text-[13px] tracking-wide truncate">
          {item.title}
        </span>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {item.shortcut && (
           <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-muted-foreground/60 bg-background/50 border border-border/50 rounded-[4px] shadow-xs">
             {item.shortcut}
           </kbd>
        )}
        {item.badge && (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <ChevronRight 
            className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
            strokeWidth={2}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      {item.href && !hasChildren ? (
        <Link 
          href={item.href} 
          className="w-full block" 
          onClick={() => onSelect(item.id, item.href)}
        >
          {navContent}
        </Link>
      ) : (
        navContent
      )}

      {hasChildren && (
        <div 
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div 
              className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map(child => (
              <NavItem 
                key={child.id} 
                item={child} 
                activeId={activeId} 
                onSelect={onSelect} 
                level={level + 1} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ 
  className = '',
  activeId,
  onSelect,
  activeWorkspace,
  onWorkspaceSelect,
  customNavGroups,
  onItemClick
}: { 
  className?: string,
  activeId?: string,
  onSelect?: (id: string, href?: string) => void,
  activeWorkspace?: string,
  onWorkspaceSelect?: (ws: string) => void,
  customNavGroups?: NavGroupData[],
  onItemClick?: () => void
}) {
  const router = useRouter();
  const pathname = usePathname();
  let authContext: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuth();
  } catch (e) {
    // Auth context optional if rendered standalone
  }

  const [internalId, setInternalId] = useState('home');
  const currentId = activeId !== undefined ? activeId : (pathname || internalId);

  const handleSelect = (id: string, href?: string) => {
    if (id === 'logout') {
      if (authContext?.logout) {
        authContext.logout();
      }
      return;
    }
    if (onSelect) {
      onSelect(id, href);
    } else {
      setInternalId(id);
    }
    if (onItemClick) {
      onItemClick();
    }
  };

  // Filter nav items by permissions
  const filterItem = (item: NavItemData): NavItemData | null => {
    // Fail safe: if user or permission data is unavailable, do not display privileged navigation
    if (item.permission) {
      if (!authContext || !authContext.user || authContext.loading) {
        return null;
      }
      if (Array.isArray(item.permission)) {
        if (!item.permission.some((p: string) => authContext.hasPermission(p))) {
          return null;
        }
      } else if (!authContext.hasPermission(item.permission)) {
        return null;
      }
    }
    if (item.children) {
      const filteredChildren = item.children
        .map(filterItem)
        .filter((c): c is NavItemData => c !== null);
      if (filteredChildren.length === 0) {
        return null; // hide parent if user cannot access any child
      }
      return { ...item, children: filteredChildren };
    }
    return item;
  };

  const navSource = customNavGroups || foundationNavGroups;
  const filteredGroups = navSource.map(group => ({
    ...group,
    items: group.items.map(filterItem).filter((i): i is NavItemData => i !== null)
  })).filter(group => group.items.length > 0);

  return (
    <div className={`flex flex-col w-full h-full bg-card/50 border-r border-border/50 p-3 font-sans max-w-full min-w-0 ${className}`}>
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-4">
        {filteredGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading && (
              <span className="px-2.5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                {group.heading}
              </span>
            )}
            {group.items.map(item => (
              <NavItem 
                key={item.id} 
                item={item} 
                activeId={currentId} 
                onSelect={handleSelect} 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const allItems = foundationNavGroups.flatMap(g => g.items);
const flattenItems = (items: NavItemData[]): NavItemData[] => {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flattenItems(item.children));
    return acc;
  }, [] as NavItemData[]);
};
const flatMockData = flattenItems(allItems);

export default function SidebarNavPreview() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeId, setActiveId] = useState('home');
  const [activeWorkspace, setActiveWorkspace] = useState('Foundation Corp');

  const activeItem = flatMockData.find(i => i.id === activeId || i.href === activeId);
  const activeTitle = activeItem ? activeItem.title : 'Dashboard';

  const handleSelect = (id: string) => {
    setActiveId(id);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[700px] bg-background p-4 md:p-8">
      <div className="relative w-full max-w-5xl h-[720px] bg-card rounded-xl border border-border/50 flex overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <div 
          className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-card/50 border-r border-border/50 ${
            isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-none'
          }`}
        >
          <SidebarNav 
            className="w-[260px] border-none bg-transparent" 
            activeId={activeId}
            onSelect={handleSelect}
          />
        </div>
        
        <div className="flex-1 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col min-w-0 transition-all duration-300">
           <div className="h-14 border-b border-border/50 flex items-center px-4 justify-between bg-card shrink-0">
             <div className="flex items-center gap-3">
               <button 
                 onClick={() => setIsOpen(!isOpen)}
                 className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"
                 aria-label="Toggle Sidebar"
               >
                 {isOpen ? <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />}
               </button>
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <span className="truncate">{activeWorkspace}</span>
                 <span>/</span>
                 <span className="font-medium text-foreground truncate">{activeTitle}</span>
               </div>
             </div>
             
             <div className="flex items-center gap-3">
               <div className="w-56 h-8 bg-black/5 dark:bg-white/5 rounded-md hidden md:block" />
               <div className="w-8 h-8 bg-primary/10 rounded-full border border-primary/20" />
             </div>
           </div>

           <div className="p-6 md:p-8 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
             <div className="flex items-center justify-between mb-8">
               <div>
                 <h2 className="text-xl font-semibold text-foreground tracking-tight">Foundation Dashboard</h2>
                 <p className="text-sm text-muted-foreground">Manage groups, registered members, beneficiaries, donations, and funds.</p>
               </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
               <div className="p-5 bg-card rounded-xl border border-border/50 shadow-sm flex flex-col justify-between">
                 <span className="text-xs font-medium text-muted-foreground uppercase">Groups</span>
                 <span className="text-2xl font-bold text-foreground mt-2">Active</span>
                 <span className="text-xs text-muted-foreground mt-1">Hierarchical Group Tracking</span>
               </div>
               <div className="p-5 bg-card rounded-xl border border-border/50 shadow-sm flex flex-col justify-between">
                 <span className="text-xs font-medium text-muted-foreground uppercase">Members</span>
                 <span className="text-2xl font-bold text-foreground mt-2">Sequential</span>
                 <span className="text-xs text-muted-foreground mt-1">Auto M-XXXX generation</span>
               </div>
               <div className="p-5 bg-card rounded-xl border border-border/50 shadow-sm flex flex-col justify-between">
                 <span className="text-xs font-medium text-muted-foreground uppercase">Donations</span>
                 <span className="text-2xl font-bold text-foreground mt-2">Tracked</span>
                 <span className="text-xs text-muted-foreground mt-1">Sequential D-XXXX records</span>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
