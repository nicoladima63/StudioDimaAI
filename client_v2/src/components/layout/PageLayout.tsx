import React from 'react'
import { cn } from '@/lib/utils'

type PageLayoutProps = {
  children: React.ReactNode
  className?: string
}

const PageLayout: React.FC<PageLayoutProps> & {
  Header: React.FC<{
    title?: string
    headerAction?: React.ReactNode
    children?: React.ReactNode
    className?: string
  }>
  Content: React.FC<{ children?: React.ReactNode; className?: string }>
  ContentHeader: React.FC<{ children?: React.ReactNode; className?: string }>
  ContentBody: React.FC<{ children?: React.ReactNode; className?: string }>
  Footer: React.FC<{ text?: string; children?: React.ReactNode; className?: string }>
} = ({ children, className }) => {
  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm overflow-hidden', className)}>
      {children}
    </div>
  )
}

PageLayout.Header = ({ title, headerAction, children, className }) => (
  <div className={cn('flex items-center justify-between gap-3 px-4 py-3 border-b border-border', className)}>
    <div className="min-w-0">
      {title && (
        <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
      )}
      {children}
    </div>
    {headerAction && (
      <div className="shrink-0">{headerAction}</div>
    )}
  </div>
)

PageLayout.ContentHeader = ({ children, className }) => (
  <div className={cn('px-4 py-3 border-b border-border bg-muted/30', className)}>
    {children}
  </div>
)

PageLayout.ContentBody = ({ children, className }) => (
  <div className={cn('px-4 py-3', className)}>
    {children}
  </div>
)

PageLayout.Content = ({ children, className }) => (
  <div className={cn('p-0', className)}>{children}</div>
)

PageLayout.Footer = ({ text, children, className }) => (
  <div className={cn('flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-muted/20', className)}>
    {text && <span className="text-sm text-muted-foreground">{text}</span>}
    {children}
  </div>
)

export default PageLayout
