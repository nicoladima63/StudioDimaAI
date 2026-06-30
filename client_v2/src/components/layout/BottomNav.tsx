import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageCircle, Zap, Grid3x3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { bottomNavItems } from './_nav'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  MessageCircle,
  Zap,
  Grid3x3,
}

interface BottomNavProps {
  onMenuOpen: () => void
}

const BottomNav: React.FC<BottomNavProps> = ({ onMenuOpen }) => {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t border-border pb-safe">
      <div className="flex items-stretch h-16">
        {bottomNavItems.map((item) => {
          const Icon = iconMap[item.iconName]
          const isMenu = item.to === null
          const isActive = item.to
            ? location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            : false

          if (isMenu) {
            return (
              <button
                key={item.name}
                onClick={onMenuOpen}
                className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span className="text-[10px] font-medium">{item.name}</span>
              </button>
            )
          }

          return (
            <NavLink
              key={item.name}
              to={item.to!}
              className={({ isActive: navActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative',
                  navActive || isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive: navActive }) => (
                <>
                  {(navActive || isActive) && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                  )}
                  {Icon && <Icon className="h-5 w-5" />}
                  <span className="text-[10px] font-medium">{item.name}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
