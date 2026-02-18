import React from 'react'
import {
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
  CDropdownDivider,
  CAvatar,
  CBadge,
} from '@coreui/react'
import { cilUser, cilSettings, cilAccountLogout } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

import { useAuthStore } from '@/store/auth.store'
import NotificationBell from '@/components/ui/NotificationBell'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import { useState } from 'react'
import { CToast, CToastBody, CToastClose, CToaster, CButton, CTooltip } from '@coreui/react'
import pushService from '@/services/pushService'
import { cilPaperPlane } from '@coreui/icons'

const Header: React.FC = () => {
  const { user, logout } = useAuthStore()
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null)

  const showToast = (message: string, color: 'success' | 'danger') => {
    setToast({ message, color })
    setTimeout(() => setToast(null), 3000)
  }

  const handleLogout = () => {
    logout()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'danger'
      case 'user':
        return 'primary'
      case 'viewer':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  return (
    <>
      <div className="d-flex align-items-center">
        <div className="me-3">
          <PushNotificationToggle
            showLabel={false}
            size="sm"
            onSuccess={(msg) => showToast(msg, 'success')}
            onError={(msg) => showToast(msg, 'danger')}
          />
        </div>

        <div className="me-3">
          <NotificationBell />
        </div>

        <CDropdown variant='nav-item' placement='bottom-end'>
          <CDropdownToggle className='py-0 pe-0' caret={false}>
            <div className='d-flex align-items-center'>
              <div className='me-2 text-end d-none d-md-block'>
                <div className='small text-muted'>Benvenuto</div>
                <div className='fw-semibold'>{user?.username}</div>
              </div>
              <CAvatar
                size='md'
                className='border border-2 border-white'
                style={{ backgroundColor: '#321fdb' }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </CAvatar>
            </div>
          </CDropdownToggle>

          <CDropdownMenu className='pt-0'>
            <div className='p-3 border-bottom'>
              <div className='d-flex align-items-center'>
                <CAvatar
                  size='md'
                  className='me-2'
                  style={{ backgroundColor: '#321fdb' }}
                >
                  {user?.username?.charAt(0).toUpperCase()}
                </CAvatar>
                <div>
                  <div className='fw-semibold'>{user?.username}</div>
                  <CBadge
                    color={getRoleBadgeColor(user?.role || 'viewer')}
                    className='mt-1'
                    size='sm'
                  >
                    {user?.role?.toUpperCase()}
                  </CBadge>
                </div>
              </div>
            </div>

            <CDropdownItem href='#/profile'>
              <CIcon icon={cilUser} className='me-2' />
              Profilo
            </CDropdownItem>

            <CDropdownItem href='#/settings'>
              <CIcon icon={cilSettings} className='me-2' />
              Impostazioni
            </CDropdownItem>

            <CDropdownDivider />

            <CDropdownItem onClick={handleLogout} className='text-danger'>
              <CIcon icon={cilAccountLogout} className='me-2' />
              Logout
            </CDropdownItem>
          </CDropdownMenu>
        </CDropdown>
      </div>

      {toast && (
        <CToaster placement="top-end" className="p-3">
          <CToast autohide={true} visible={true} color={toast.color}>
            <CToastBody>
              {toast.message}
              <CToastClose className="me-2 m-auto" />
            </CToastBody>
          </CToast>
        </CToaster>
      )}
    </>
  )
}

export default Header