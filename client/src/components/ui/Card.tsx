import React from 'react'

interface CardProps {
  title?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, headerAction, className }) => (
  <div className={`card ${className || ''}`}>
    {title && (
      <div className="card-header d-flex justify-content-between align-items-center">
        <h3 className="mb-0">{title}</h3>
        {headerAction}
      </div>
    )}
    <div className="card-body">{children}</div>
  </div>
);

export default Card;
