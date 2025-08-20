import React from "react";
import { CContainer } from "@coreui/react";

type PageLayoutProps = {
  children: React.ReactNode;
};

const PageLayout: React.FC<PageLayoutProps> & {
  Header: React.FC<{
    title?: string;
    headerAction?: React.ReactNode;
    children?: React.ReactNode;
  }>;
  Content: React.FC<{ children?: React.ReactNode }>;
  ContentHeader: React.FC<{ children?: React.ReactNode }>;
  ContentBody: React.FC<{ children?: React.ReactNode }>;
  Footer: React.FC<{ text?: string; children?: React.ReactNode }>;
} = ({ children }) => {
  return (
    <CContainer fluid className="py-3">
      <div className="card">{children}</div>
    </CContainer>
  );
};

/* === SLOT COMPONENTS === */
PageLayout.Header = ({ title, headerAction, children }) => (
  <div className="card-header d-flex justify-content-between align-items-center">
    <div>
      {title && <h3 className="mb-0">{title}</h3>}
      {children}
    </div>
    {headerAction}
  </div>
);

// ContentHeader: sezione opzionale sopra il body
PageLayout.ContentHeader = ({ children }) => (
  <div className="card-body">
    <div className="p-3 border rounded bg-light">{children}</div>
  </div>
);

// ContentBody: sezione principale del content
PageLayout.ContentBody = ({ children }) => (
  <div className="card-body ">
    <div className="mb-4 p-3 border rounded bg-light">{children}</div>
  </div>
);

// Content: mantiene compatibilità retroattiva
PageLayout.Content = ({ children }) => <>{children}</>;

PageLayout.Footer = ({ text, children }) => (
  <div className="card-footer">
    {text && <span>{text}</span>}
    {children}
  </div>
);

export default PageLayout;
