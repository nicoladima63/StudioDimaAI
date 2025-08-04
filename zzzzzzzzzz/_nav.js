import React from 'react'
import CIcon from '@coreui/icons-react'
import * as icon from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={icon.cilSpeedometer} customClassName="nav-icon" />,
  },

  {
    component: CNavTitle,
    name: 'MESSAGGI',
  },
  {
    component: CNavItem,
    name: 'Nuovo Messaggio',
    to: '/todo/new',
    icon: <CIcon icon={icon.cilCursor} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Messaggi',
    to: '/todo',
    icon: <CIcon icon={icon.cilCursor} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'FLUSSI DI LAVORO',
  },
  {
    component: CNavItem,
    name: 'Lavorazioni',
    to: '/works',
    icon: <CIcon icon={icon.cilNotes} customClassName="nav-icon" />,
  },

  {
    component: CNavItem,
    name: 'Utenti',
    to: '/users',
    icon: <CIcon icon={icon.cilUser} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Fornitori',
    to: '/provider',
    icon: <CIcon icon={icon.cilNotes} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Categorie',
    to: '/categories',
    icon: <CIcon icon={icon.cilNotes} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Tasks',
    to: '/tasks',
    icon: <CIcon icon={icon.cilNotes} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'AUTH',
  },
  {
    component: CNavItem,
    name: 'Login',
    to: '/login',
    icon: <CIcon icon={icon.cilUser} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Logout',
    to: '/logout',
    icon: <CIcon icon={icon.cilUser} customClassName="nav-icon" />,
  },
]

export default _nav
