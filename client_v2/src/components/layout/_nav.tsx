export interface NavItem {
  name: string
  to?: string
  iconName: string
  items?: NavItem[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', to: '/dashboard', iconName: 'LayoutDashboard' },
  { name: 'Simulazione Flussi', to: '/simulation', iconName: 'Play' },
  { name: 'Eisenhower', to: '/eisenhower', iconName: 'Grid2x2' },
  { name: 'Email', to: '/email', iconName: 'Mail' },
  { name: 'Bot WhatsApp', to: '/bot', iconName: 'MessageCircle' },
  {
    name: 'Gestione',
    iconName: 'Layers',
    items: [
      { name: 'Fornitori', to: '/fornitori', iconName: 'Building2' },
      { name: 'Classifica Fornitori', to: '/fornitori/classificazione', iconName: 'ListOrdered' },
      { name: 'Pazienti', to: '/pazienti', iconName: 'Users' },
      { name: 'Richiami', to: '/pazienti/richiami', iconName: 'Phone' },
      { name: 'Materiali', to: '/materiali', iconName: 'Package' },
      { name: 'Conti', to: '/conti', iconName: 'Wallet' },
      { name: 'Spese', to: '/spese', iconName: 'Receipt' },
      { name: 'Collaboratori', to: '/collaboratori', iconName: 'UserCheck' },
      { name: 'Utenti', to: '/users', iconName: 'UserCog' },
    ],
  },
  {
    name: 'Ricetta Elettronica',
    iconName: 'FileText',
    items: [
      { name: 'NRE', to: '/ricetta', iconName: 'FileText' },
      { name: 'Test Ricette', to: '/ricetta/test', iconName: 'TestTube' },
    ],
  },
  {
    name: 'Agenda',
    iconName: 'Calendar',
    items: [
      { name: 'Calendario', to: '/calendar', iconName: 'Calendar' },
      { name: 'Impostazioni', to: '/settings/calendar', iconName: 'Settings' },
    ],
  },
  {
    name: 'Monitoraggi',
    iconName: 'Activity',
    items: [
      { name: 'Monitor Quaderno', to: '/settings/monitor-prestazioni', iconName: 'BarChart2' },
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
      { name: 'Economics', to: '/economics', iconName: 'PieChart' },
      { name: 'Analisi Comparativa', to: '/economics/comparativa', iconName: 'BarChart' },
      { name: 'Centro di Costo', to: '/economics/centro-costo', iconName: 'Target' },
    ],
  },
  {
    name: 'Sistema',
    iconName: 'Settings',
    items: [
      { name: 'Scheduler', to: '/settings/scheduler', iconName: 'Clock' },
      { name: 'Template SMS', to: '/settings/template', iconName: 'MessageSquare' },
      { name: 'Automazioni', to: '/settings/automazioni', iconName: 'Zap' },
      { name: 'WhatsApp Reminder', to: '/settings/evolution', iconName: 'Phone' },
      { name: 'SEO', to: '/settings/seo', iconName: 'Search' },
    ],
  },
  {
    name: 'Materiali Utils',
    iconName: 'Wrench',
    items: [
      { name: 'Migrazione', to: '/materiali/migrazione', iconName: 'Upload' },
      { name: 'Classifica', to: '/materiali/ricerca', iconName: 'Search' },
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
