import CIcon from '@coreui/icons-react';
import { 
  cilSpeedometer, 
  cilCalendar, 
  cilBell, 
  cilUser, 
  cilSettings, 
  cilCreditCard, 
  cilList, 
  cilEuro, 
  cilDescription, 
  cilMoney, 
  cilPeople, 
  cilChart,
  cilUserPlus,
  cilCode,
  cilAccountLogout,
  cilBarChart
} from '@coreui/icons';
import { CNavItem, CNavTitle } from '@coreui/react';

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Pagine',
  },
  {
    component: CNavItem,
    name: 'Richiami',
    to: '/recalls',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Pazienti',
    to: '/pazienti',
    icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Automazioni',
  },
  {
    component: CNavItem,
    name: 'Calendar',
    to: '/calendar',
    icon: <CIcon icon={cilCalendar} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'RENTRI',
    to: '/rentri',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
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
    name: 'Studio',
  },
  {
    component: CNavItem,
    name: 'Incassi',
    to: '/incassi',
    icon: <CIcon icon={cilEuro} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Fatture',
    to: '/fatture',
    icon: <CIcon icon={cilCreditCard} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Collaboratori',
    to: '/collaboratori',
    icon: <CIcon icon={cilUserPlus} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Spese',
    to: '/spese',
    icon: <CIcon icon={cilMoney} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Fornitori',
    to: '/fornitori',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'KPI',
    to: '/kpi',
    icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Statistiche',
    to: '/statistiche',
    icon: <CIcon icon={cilBarChart} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Conti',
    to: '/studio/conti',
    icon: <CIcon icon={cilAccountLogout} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Test & Debug',
  },
  {
    component: CNavItem,
    name: 'Test Conti/Sottoconti',
    to: '/test/conti',
    icon: <CIcon icon={cilCode} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Impostazioni',
  },
  {
    component: CNavItem,
    name: 'Settings',
    to: '/settings',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
];

export default _nav;