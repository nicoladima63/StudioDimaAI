import type { UserRole } from '@/types'

export interface NavItem {
  name: string
  to?: string
  iconName: string
  items?: NavItem[]
  allowedRoles?: UserRole[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', to: '/dashboard', iconName: 'LayoutDashboard' },
  { name: 'Simulazione Flussi', to: '/simulation', iconName: 'Play', allowedRoles: ['admin', 'dottore'] },
  { name: 'Eisenhower', to: '/eisenhower', iconName: 'Grid2x2', allowedRoles: ['admin', 'dottore', 'segreteria'] },
  { name: 'Email', to: '/email', iconName: 'Mail' },
  { name: 'Bot WhatsApp', to: '/bot', iconName: 'MessageCircle' },
  { name: 'Download TAC', to: '/cbct', iconName: 'ScanLine' },
  {
    name: 'Gestione',
    iconName: 'Layers',
    items: [
      { name: 'Fornitori', to: '/fornitori', iconName: 'Building2', allowedRoles: ['admin'] },
      { name: 'Classifica Fornitori', to: '/fornitori/classificazione', iconName: 'ListOrdered', allowedRoles: ['admin'] },
      { name: 'Pazienti', to: '/pazienti', iconName: 'Users' },
      { name: 'Richiami', to: '/pazienti/richiami', iconName: 'Phone' },
      { name: 'Materiali', to: '/materiali', iconName: 'Package' },
      { name: 'Conti', to: '/conti', iconName: 'Wallet' },
      { name: 'Spese', to: '/spese', iconName: 'Receipt' },
      { name: 'Collaboratori', to: '/collaboratori', iconName: 'UserCheck', allowedRoles: ['admin'] },
      { name: 'Utenti', to: '/users', iconName: 'UserCog', allowedRoles: ['admin'] },
    ],
  },
  {
    name: 'Ricetta Elettronica',
    iconName: 'FileText',
    items: [
      { name: 'NRE', to: '/ricetta', iconName: 'FileText' },
      { name: 'Test Ricette', to: '/ricetta/test', iconName: 'TestTube', allowedRoles: ['admin', 'dottore'] },
    ],
  },
  {
    name: 'Agenda',
    iconName: 'Calendar',
    items: [
      { name: 'Calendario', to: '/calendar', iconName: 'Calendar' },
      { name: 'Impostazioni', to: '/settings/calendar', iconName: 'Settings', allowedRoles: ['admin'] },
    ],
  },
  {
    name: 'Monitoraggi',
    iconName: 'Activity',
    items: [
      { name: 'Monitor Quaderno', to: '/settings/monitor-prestazioni', iconName: 'BarChart2', allowedRoles: ['admin', 'dottore'] },
    ],
  },
  {
    name: 'Lavorazioni',
    iconName: 'Layers',
    items: [
      { name: 'Tasks', to: '/tasks', iconName: 'CheckSquare' },
      { name: 'Works', to: '/works', iconName: 'Briefcase' },
      { name: 'Providers', to: '/providers', iconName: 'Users' },
      { name: 'Steps Template', to: '/steps', iconName: 'ListChecks' },
    ],
  },
  {
    name: 'Analytics',
    iconName: 'TrendingUp',
    items: [
      { name: 'Economics', to: '/economics', iconName: 'PieChart', allowedRoles: ['admin', 'dottore'] },
      { name: 'Analisi Comparativa', to: '/economics/comparativa', iconName: 'BarChart', allowedRoles: ['admin', 'dottore'] },
      { name: 'Centro di Costo', to: '/economics/centro-costo', iconName: 'Target', allowedRoles: ['admin'] },
    ],
  },
  {
    name: 'Sistema',
    iconName: 'Settings',
    items: [
      { name: 'Scheduler', to: '/settings/scheduler', iconName: 'Clock', allowedRoles: ['admin', 'dottore'] },
      { name: 'Template SMS', to: '/settings/template', iconName: 'MessageSquare', allowedRoles: ['admin'] },
      { name: 'Automazioni', to: '/settings/automazioni', iconName: 'Zap', allowedRoles: ['admin'] },
      { name: 'WhatsApp Reminder', to: '/settings/evolution', iconName: 'Phone'},
      { name: 'SEO', to: '/settings/seo', iconName: 'Search', allowedRoles: ['admin','dottore'] },
    ],
  },
  {
    name: 'Materiali Utils',
    iconName: 'Wrench',
    items: [
      { name: 'Migrazione', to: '/materiali/migrazione', iconName: 'Upload', allowedRoles: ['admin'] },
      { name: 'Classifica', to: '/materiali/ricerca', iconName: 'Search'},
    ],
  },
]

export const bottomNavItems = [
  { name: 'Home', to: '/dashboard', iconName: 'LayoutDashboard' },
  { name: 'Pazienti', to: '/pazienti', iconName: 'Users' },
  { name: 'Bot', to: '/bot', iconName: 'MessageCircle' },
  { name: 'Automazioni', to: '/settings/automazioni', iconName: 'Zap' },
  { name: 'Menu', to: null, iconName: 'Grid3x3' },
]

export default navigation
