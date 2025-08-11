import React from 'react';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react';

import { AppSidebarNav } from './AppSidebarNav';
import { useSidebarStore } from '@/store/useSidebarStore';

// Sidebar nav config
import navigation from './_nav';

const AppSidebar: React.FC = () => {
  const { visible, unfoldable, toggleMinimize, setSidebarVisible } = useSidebarStore();

  return (
    <CSidebar
      className="border-end"
      position="fixed"
      unfoldable={unfoldable}
      visible={visible}
      onVisibleChange={(visible) => setSidebarVisible(visible)}
    >
      <CSidebarHeader className="border-bottom" style={{ minHeight: '76px' }}>
        <CSidebarBrand href="/">
          <h5>Studio Nicola Di Martino</h5>
        </CSidebarBrand>
      </CSidebarHeader>
      <AppSidebarNav items={navigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          onClick={toggleMinimize}
        />
      </CSidebarFooter>
    </CSidebar>
  );
};

export default React.memo(AppSidebar);