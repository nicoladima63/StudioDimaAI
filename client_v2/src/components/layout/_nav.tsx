import CIcon from '@coreui/icons-react';
import { 
  cilSpeedometer, 
  cilPeople, 
  cilLayers, 
  cilChart,
  cilMoney,
  cilSettings,
  cilList,
  cilDescription,
  cilUser,
  cilCalendar,
  cilSearch,
  cilMonitor
} from '@coreui/icons';
import { CNavItem, CNavTitle } from '@coreui/react';

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Gestione',
  },
  {
    component: CNavItem,
    name: 'Fornitori',
    to: '/fornitori',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Pazienti',
    to: '/pazienti',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Materiali',
    to: '/materiali',
    icon: <CIcon icon={cilLayers} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Conti',
    to: '/conti',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Spese',
    to: '/spese',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Ricetta elettronica',
  },
  {
    component: CNavItem,
    name: 'NRE',
    to: '/ricetta',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Test Ricette',
    to: '/ricetta/test',
    icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Protocolli',
    to: '/ricetta/setting',
    icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Agenda',
  },
  {
    component: CNavItem,
    name: 'Calendario',
    to: '/calendar',
    icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Calendar Settings',
    to: '/settings/calendar',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Monitoraggi',
  },
  // {
  //   component: CNavItem,
  //   name: 'Monitor Quaderno',
  //   to: '/settings/monitoring',
  //   icon: <CIcon icon={cilMonitor} customClassName="nav-icon" />,
  // },
  {
    component: CNavItem,
    name: 'Monitor Quaderno',
    to: '/settings/monitor-prestazioni',
    icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Analytics',
  },
  {
    component: CNavItem,
    name: 'Statistiche',
    to: '/statistiche',
    icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Sistema',
  },
  {
    component: CNavItem,
    name: 'Impostazioni',
    to: '/settings',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Gestione Template SMS',
    to: '/settings/template', // La route che abbiamo configurato
    icon: <CIcon icon={cilDescription} customClassName="nav-icon" />, // Un'icona appropriata
  },
  {
    component: CNavItem,
    name: 'Automazioni',
    to: '/settings/automazioni',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Scheduler',
    to: '/settings/scheduler',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Materiali',
  },
  {
    component: CNavItem,
    name: 'Migrazione Materiali',
    to: '/materiali/migrazione',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Classifica Materiali',
    to: '/materiali/ricerca',
    icon: <CIcon icon={cilSearch} customClassName="nav-icon" />,
  },
];

export default _nav;