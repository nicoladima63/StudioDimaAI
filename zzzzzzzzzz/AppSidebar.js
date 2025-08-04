import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setSidebarShow, setUnfoldable } from "../store/slices/uiSlice";
import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react';

import { AppSidebarNav } from './AppSidebarNav';

// Sidebar nav config
import navigation from '../_nav';

const AppSidebar = () => {
  const dispatch = useDispatch();
  const { sidebarShow, theme, unfoldable } = useSelector((state) => state.ui);

  return (

    <CSidebar
      className="border-end"
      colorScheme={theme === 'light' ? 'dark' : 'light'}
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => dispatch(setSidebarShow(visible))}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand to="/">
          <h5>WorkFlowDima's</h5>
        </CSidebarBrand>
        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() => dispatch(setSidebarShow(false))}
        />
      </CSidebarHeader>
      <AppSidebarNav items={navigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          onClick={() => dispatch(setUnfoldable(!unfoldable))}
        />
      </CSidebarFooter>
    </CSidebar>
  );
};

export default React.memo(AppSidebar);
