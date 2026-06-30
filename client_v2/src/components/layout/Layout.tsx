import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useTheme } from '@/hooks/useTheme'
import AppSidebar from './AppSidebar'
import BottomNav from './BottomNav'
import MobileDrawer from './MobileDrawer'
import NotificationBell from '@/components/ui/NotificationBell'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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

            {isAuthenticated && user && (
              <>
                {/* Push notifications */}
                <div className="hidden sm:block">
                  <PushNotificationToggle showLabel={false} size="sm" onSuccess={() => {}} onError={() => {}} />
                </div>

                {/* Notification bell */}
                <NotificationBell />

                {/* User info — solo desktop */}
                <div className="hidden md:flex items-center gap-2 ml-1 pl-2 border-l border-border">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium leading-none">{user.username}</span>
                    <Badge
                      variant={user.role === 'admin' ? 'success' : 'teal'}
                      className="mt-0.5 text-[9px] px-1 py-0 h-4"
                    >
                      {user.role}
                    </Badge>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground ml-1"
                    title="Esci"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
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
