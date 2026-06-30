import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Play, Grid2x2, Mail, MessageCircle, Building2, ListOrdered,
  Users, Phone, Package, Wallet, Receipt, UserCheck, UserCog, FileText,
  TestTube, Calendar, Settings, Activity, BarChart2, Layers, CheckSquare,
  Briefcase, ListChecks, TrendingUp, PieChart, BarChart, Target, Clock,
  MessageSquare, Zap, Search, Wrench, Upload, ChevronDown, ChevronRight,
  LogOut, Sun, Moon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import navigation, { type NavItem } from './_nav'
import { useAuthStore } from '@/store/auth.store'
import { useTheme } from '@/hooks/useTheme'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Play, Grid2x2, Mail, MessageCircle, Building2, ListOrdered,
  Users, Phone, Package, Wallet, Receipt, UserCheck, UserCog, FileText,
  TestTube, Calendar, Settings, Activity, BarChart2, Layers, CheckSquare,
  Briefcase, ListChecks, TrendingUp, PieChart, BarChart, Target, Clock,
  MessageSquare, Zap, Search, Wrench, Upload,
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

interface NavGroupProps {
  item: NavItem
  onClose: () => void
}

const NavGroupItem: React.FC<NavGroupProps> = ({ item, onClose }) => {
  const [expanded, setExpanded] = useState(false)
  const Icon = iconMap[item.iconName]

  if (!item.items) {
    return (
      <NavLink
        to={item.to!}
        onClick={onClose}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-foreground hover:bg-muted'
          )
        }
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {item.name}
      </NavLink>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="flex-1 text-left">{item.name}</span>
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        }
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 border-l border-border pl-3 space-y-0.5">
          {item.items.map((child) => {
            const ChildIcon = iconMap[child.iconName]
            return (
              <NavLink
                key={child.to}
                to={child.to!}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
                    isActive
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                {ChildIcon && <ChildIcon className="h-3.5 w-3.5 shrink-0" />}
                {child.name}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ open, onClose }) => {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    onClose()
    logout()
    navigate('/login')
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 bg-primary text-primary-foreground">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-semibold truncate">
                {user?.username ?? 'Utente'}
              </SheetTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant={user?.role === 'admin' ? 'success' : 'teal'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {user?.role ?? 'user'}
                </Badge>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />
              }
            </button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="space-y-0.5">
            {navigation.map((item) => (
              <NavGroupItem key={item.name} item={item} onClose={onClose} />
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default MobileDrawer
