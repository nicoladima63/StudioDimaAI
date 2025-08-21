import CIcon from '@coreui/icons-react';
import { 
  cilSpeedometer, 
  cilPeople, 
  cilLayers, 
  cilChart,
  cilMoney,
  cilSettings,
  cilBarChart
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
];

export default _nav;