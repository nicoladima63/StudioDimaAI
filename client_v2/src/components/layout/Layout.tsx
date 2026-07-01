import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, LogOut, Badge } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useTheme } from '@/hooks/useTheme'
import AppSidebar from './AppSidebar'
import BottomNav from './BottomNav'
import MobileDrawer from './MobileDrawer'
import NotificationBell from '@/components/ui/NotificationBell'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Label } from '../ui/label'

const Layout: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { theme, toggleTheme } = useTheme()

  // Su desktop apri sidebar per default
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setSidebarVisible(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarVisible(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Nascondi header al scroll verso il basso su mobile
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      if (currentY < 10) {
        setHeaderVisible(true)
      } else {
        setHeaderVisible(currentY < lastScrollY.current)
      }
      lastScrollY.current = currentY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?'

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <AppSidebar visible={sidebarVisible} onVisibleChange={setSidebarVisible} />

      {/* Mobile drawer (Sheet da sinistra) */}
      <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />

      {/* Wrapper principale */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-[margin] duration-200',
          sidebarVisible ? 'md:ml-60' : 'md:ml-0'
        )}
      >
        {/* Header */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 transition-transform duration-200',
            !headerVisible && 'md:translate-y-0 -translate-y-full'
          )}
        >
          {/* Toggle sidebar (hamburger) */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileDrawerOpen(true)
              } else {
                setSidebarVisible(!sidebarVisible)
              }
            }}
            className="p-2 rounded-md hover:bg-muted transition-colors text-foreground -ml-2"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Title — visibile su mobile */}
          <span className="font-semibold text-sm md:hidden text-foreground truncate">
            Studio Dima
          </span>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">

            {isAuthenticated && user && (
              <>
                {/* Avatar con menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ml-1">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user.username} - 
                        <Label  color="primary" className="ml-2">
                        {user.role}
                      </Label>
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1">
                      <PushNotificationToggle showLabel={true} size="sm" onSuccess={() => {}} onError={() => {}} />
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" />
                      Esci
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                                {/* Notification bell */}
                <NotificationBell />

              </>
            )}

                        {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />
              }
            </button>

          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-3 md:p-5 pb-20 md:pb-5 page-enter">
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation — solo mobile */}
      <BottomNav onMenuOpen={() => setMobileDrawerOpen(true)} />
    </div>
  )
}

export default Layout
