import React from 'react';
import { NavLink } from 'react-router-dom';
import { CBadge, CNavLink, CSidebarNav } from '@coreui/react';

interface BadgeInfo {
  color: string;
  text: string;
}

interface NavItem {
  component: React.ComponentType<any>;
  name: string;
  to?: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: BadgeInfo;
  items?: NavItem[];
  [key: string]: any;
}

interface AppSidebarNavProps {
  items: NavItem[];
}

export const AppSidebarNav: React.FC<AppSidebarNavProps> = ({ items }) => {
  const navLink = (name: string, icon?: React.ReactNode, badge?: BadgeInfo, indent = false) => {
    return (
      <>
        {icon
          ? icon
          : indent && (
              <span className="nav-icon">
                <span className="nav-icon-bullet"></span>
              </span>
            )}
        {name && name}
        {badge && (
          <CBadge color={badge.color} className="ms-auto">
            {badge.text}
          </CBadge>
        )}
      </>
    );
  };

  const navItem = (item: NavItem, index: number, indent = false) => {
    const { component, name, badge, icon, ...rest } = item;
    const Component = component;
    return (
      <Component as="div" key={index}>
        {rest.to || rest.href ? (
          <CNavLink 
            {...(rest.to && { as: NavLink })} 
            {...rest}
          >
            {navLink(name, icon, badge, indent)}
          </CNavLink>
        ) : (
          navLink(name, icon, badge, indent)
        )}
      </Component>
    );
  };

  const navGroup = (item: NavItem, index: number) => {
    const { component, name, icon, items, to, ...rest } = item;
    const Component = component;
    return (
      <Component 
        compact 
        as="div" 
        key={index} 
        toggler={navLink(name, icon)} 
        {...rest}
      >
        {item.items?.map((item, index) =>
          item.items ? navGroup(item, index) : navItem(item, index, true),
        )}
      </Component>
    );
  };

  return (
    <CSidebarNav>
      {items &&
        items.map((item, index) => (item.items ? navGroup(item, index) : navItem(item, index)))}
    </CSidebarNav>
  );
};