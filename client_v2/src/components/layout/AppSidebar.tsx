import React from 'react';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarToggler,
} from '@coreui/react';

import { AppSidebarNav } from './AppSidebarNav';

// Sidebar nav config
import navigation from './_nav';

interface AppSidebarProps {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ visible, onVisibleChange }) => {
  return (
    <CSidebar
      className="border-end sidebar sidebar-dark sidebar-fixed"
      position="fixed"
      visible={visible}
      onVisibleChange={onVisibleChange}
    >
      <CSidebarBrand href="/" className="border-bottom" style={{ minHeight: '76px' }}>
        <div className="sidebar-brand-full">
          <h5 className="mb-0">Studio Dima V2</h5>
        </div>
        <div className="sidebar-brand-minimized">
          <strong>SD</strong>
        </div>
      </CSidebarBrand>
      
      <AppSidebarNav items={navigation} />
      
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler />
      </CSidebarFooter>
    </CSidebar>
  );
};

export default React.memo(AppSidebar);