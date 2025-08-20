import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// CoreUI components
import {
  CSidebarBrand,
  CSidebarNav,
  CNavTitle,
  CNavItem,
} from '@coreui/react'

// Icons
import {
  cilSpeedometer,
  cilPeople,
  cilLayers,
  cilChart,
  cilSettings,
  cilMoney,
} from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const Sidebar: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const navigation = [
    {
      component: CNavItem,
      name: 'Dashboard',
      to: '/dashboard',
      icon: <CIcon icon={cilSpeedometer} customClassName='nav-icon' />,
    },
    {
      component: CNavTitle,
      name: 'Gestione',
    },
    {
      component: CNavItem,
      name: 'Fornitori',
      to: '/fornitori',
      icon: <CIcon icon={cilPeople} customClassName='nav-icon' />,
      badge: {
        color: 'info',
        text: 'Coming Soon',
      },
    },
    {
      component: CNavItem,
      name: 'Materiali',
      to: '/materiali',
      icon: <CIcon icon={cilLayers} customClassName='nav-icon' />,
      badge: {
        color: 'info',
        text: 'Coming Soon',
      },
    },
    {
      component: CNavItem,
      name: 'Spese',
      to: '/spese',
      icon: <CIcon icon={cilMoney} customClassName='nav-icon' />,
      badge: {
        color: 'info',
        text: 'Coming Soon',
      },
    },
    {
      component: CNavTitle,
      name: 'Analytics',
    },
    {
      component: CNavItem,
      name: 'Statistiche',
      to: '/statistiche',
      icon: <CIcon icon={cilChart} customClassName='nav-icon' />,
      badge: {
        color: 'info',
        text: 'Coming Soon',
      },
    },
    {
      component: CNavTitle,
      name: 'Sistema',
    },
    {
      component: CNavItem,
      name: 'Impostazioni',
      to: '/settings',
      icon: <CIcon icon={cilSettings} customClassName='nav-icon' />,
      badge: {
        color: 'info',
        text: 'Coming Soon',
      },
    },
  ]

  return (
    <>
      <CSidebarBrand
        className='d-flex align-items-center justify-content-center sidebar-brand'
        onClick={e => {
          e.preventDefault()
          navigate('/dashboard')
        }}
      >
        <div className='sidebar-brand-full'>
          <strong>Studio Dima</strong>
          <span className='ms-2 small text-muted'>V2</span>
        </div>
        <div className='sidebar-brand-minimized'>
          <strong>SD</strong>
        </div>
      </CSidebarBrand>

      <CSidebarNav>
        {navigation.map((item, index) => {
          const ItemComponent = item.component
          return (
            <ItemComponent
              key={index}
              {...item}
              active={item.to === location.pathname}
              onClick={() => item.to && navigate(item.to)}
            />
          )
        })}
      </CSidebarNav>
    </>
  )
}

export default Sidebar