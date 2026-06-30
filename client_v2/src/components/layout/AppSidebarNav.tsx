import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Play, Grid2x2, Mail, MessageCircle, Building2, ListOrdered,
  Users, Phone, Package, Wallet, Receipt, UserCheck, UserCog, FileText,
  TestTube, Calendar, Settings, Activity, BarChart2, Layers, CheckSquare,
  Briefcase, ListChecks, TrendingUp, PieChart, BarChart, Target, Clock,
  MessageSquare, Zap, Search, Wrench, Upload, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type NavItem } from './_nav'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Play, Grid2x2, Mail, MessageCircle, Building2, ListOrdered,
  Users, Phone, Package, Wallet, Receipt, UserCheck, UserCog, FileText,
  TestTube, Calendar, Settings, Activity, BarChart2, Layers, CheckSquare,
  Briefcase, ListChecks, TrendingUp, PieChart, BarChart, Target, Clock,
  MessageSquare, Zap, Search, Wrench, Upload,
}

interface NavGroupProps {
  item: NavItem
}

const NavGroupItem: React.FC<NavGroupProps> = ({ item }) => {
  const [open, setOpen] = useState(false)
  const Icon = iconMap[item.iconName]

  if (!item.items) {
    return (
      <NavLink
        to={item.to!}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-white/15 text-white'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          )
        }
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span>{item.name}</span>
      </NavLink>
    )
  }

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen}>
      <CollapsiblePrimitive.Trigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 text-left">{item.name}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="ml-3 mt-0.5 border-l border-white/10 pl-3 space-y-0.5 py-0.5">
          {item.items.map((child) => {
            const ChildIcon = iconMap[child.iconName]
            return (
              <NavLink
                key={child.to}
                to={child.to!}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                    isActive
                      ? 'text-white font-medium bg-white/10'
                      : 'text-white/55 hover:text-white hover:bg-white/10'
                  )
                }
              >
                {ChildIcon && <ChildIcon className="h-3 w-3 shrink-0" />}
                {child.name}
              </NavLink>
            )
          })}
        </div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}

interface AppSidebarNavProps {
  items: NavItem[]
}

const AppSidebarNav: React.FC<AppSidebarNavProps> = ({ items }) => {
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
      {items.map((item) => (
        <NavGroupItem key={item.name} item={item} />
      ))}
    </nav>
  )
}

export { AppSidebarNav }
