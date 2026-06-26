// Proposta C — minimal (meno gruppi, struttura piatta)
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
  cilChartPie,
  cilChartLine,
  cilEnvelopeClosed,
  cilChatBubble,
  cilPhone,
  cilMediaPlay,
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
    name: 'Calendario',
    to: '/calendar',
    icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
  },
  {
    component: CNavGroup,
    name: 'Pazienti',
    to: '/pazienti-group',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Pazienti',
        to: '/pazienti',
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Richiami',
        to: '/pazienti/richiami',
        icon: <CIcon icon={cilPhone} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Ricetta Elettronica',
        to: '/ricetta',
        icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Comunicazioni',
    to: '/comunicazioni',
    icon: <CIcon icon={cilEnvelopeClosed} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Bot WhatsApp',
        to: '/bot',
        icon: <CIcon icon={cilChatBubble} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Email',
        to: '/email',
        icon: <CIcon icon={cilEnvelopeClosed} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Template SMS',
        to: '/settings/template',
        icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Economica',
    to: '/economica',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Spese',
        to: '/spese',
        icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Conti',
        to: '/conti',
        icon: <CIcon icon={cilList} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Fornitori',
        to: '/fornitori',
        icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Classifica Fornitori',
        to: '/fornitori/classificazione',
        icon: <CIcon icon={cilList} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Materiali',
        to: '/materiali',
        icon: <CIcon icon={cilLayers} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Economics',
        to: '/economics',
        icon: <CIcon icon={cilChartPie} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Analisi Comparativa',
        to: '/economics/comparativa',
        icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Operativo',
    to: '/operativo',
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
        name: 'Collaboratori',
        to: '/collaboratori',
        icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
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
    ],
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
        name: 'Utenti',
        to: '/users',
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
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
        component: CNavItem,
        name: 'Monitor Quaderno',
        to: '/settings/monitor-prestazioni',
        icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Simulazione Flussi',
        to: '/simulation',
        icon: <CIcon icon={cilMediaPlay} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Matrice di Eisenhower',
        to: '/eisenhower',
        icon: <CIcon icon={cilTask} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Centro di Costo',
        to: '/economics/centro-costo',
        icon: <CIcon icon={cilChartPie} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Classifica Materiali',
        to: '/materiali/ricerca',
        icon: <CIcon icon={cilSearch} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Migrazione Materiali',
        to: '/materiali/migrazione',
        icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'SEO',
        to: '/settings/seo',
        icon: <CIcon icon={cilSearch} customClassName="nav-icon" />,
      },
    ],
  },
];

export default _nav;
