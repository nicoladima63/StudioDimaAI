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
  cilTask,
  cilShare,
  cilHome,
  cilTag
} from '@coreui/icons';
import { CNavItem, CNavGroup } from '@coreui/react';

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Matrice di Eisenhower',
    to: '/eisenhower',
    icon: <CIcon icon={cilTask} customClassName="nav-icon" />,
  },
  {
    component: CNavGroup,
    name: 'Gestione',
    to: '/gestione',
    icon: <CIcon icon={cilLayers} customClassName="nav-icon" />,
    items: [
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
        component: CNavItem,
        name: 'Collaboratori',
        to: '/collaboratori',
        icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Utenti',
        to: '/users',
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
      },
    ]
  },
  {
    component: CNavGroup,
    name: 'Ricetta elettronica',
    to: '/ricetta-elettronica',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
    items: [
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
    ]
  },
  {
    component: CNavGroup,
    name: 'Agenda',
    to: '/agenda',
    icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
    items: [
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
    ]
  },
  {
    component: CNavGroup,
    name: 'Monitoraggi',
    to: '/monitoraggi',
    icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Monitor Quaderno',
        to: '/settings/monitor-prestazioni',
        icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
      },
    ]
  },
  {
    component: CNavGroup,
    name: 'Social Media',
    to: '/social-media',
    icon: <CIcon icon={cilShare} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Dashboard',
        to: '/social-media',
        icon: <CIcon icon={cilHome} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Posts',
        to: '/social-media/posts',
        icon: <CIcon icon={cilList} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Categorie',
        to: '/social-media/categories',
        icon: <CIcon icon={cilTag} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Calendario',
        to: '/social-media/calendar',
        icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Settings',
        to: '/social-media/settings',
        icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
      },
    ]
  },
  {
    component: CNavGroup,
    name: 'Lavorazioni',
    to: '/lavorazioni',
    icon: <CIcon icon={cilLayers} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Tasks',
        to: '/tasks',
        icon: <CIcon icon={cilTask} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Works',
        to: '/works',
        icon: <CIcon icon={cilList} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Providers',
        to: '/providers',
        icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Steps Template',
        to: '/steps',
        icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
      },
    ]
  },
  {
    component: CNavGroup,
    name: 'Analytics',
    to: '/analytics',
    icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Statistiche',
        to: '/statistiche',
        icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
      },
    ]
  },
  {
    component: CNavGroup,
    name: 'Sistema',
    to: '/sistema',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Impostazioni',
        to: '/settings',
        icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Gestione Template SMS',
        to: '/settings/template',
        icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
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
    ]
  },
  {
    component: CNavGroup,
    name: 'Materiali Utils',
    to: '/materiali-utils',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    items: [
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
    ]
  },
];

export default _nav;