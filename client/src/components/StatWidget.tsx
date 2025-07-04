import React from 'react'
import { CWidgetStatsA } from '@coreui/react'
import CIcon from '@coreui/icons-react'

interface StatWidgetProps {
  color: string
  value: string | number | React.ReactNode
  title: string
  icon?: any // accetta anche CIcon
  children?: React.ReactNode
}

const StatWidget: React.FC<StatWidgetProps> = ({ color, value, title, icon, children }) => {
  // Se value contiene "|", mostro i due valori su due righe
  let displayValue = value
  if (typeof value === 'string' && value.includes('|')) {
    const parts = value.split('|').map(v => v.trim())
    displayValue = (
      <span style={{fontWeight:600}}>
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            {part}
            {idx < parts.length - 1 && <span style={{color:'#888', margin:'0 6px'}}>|</span>}
          </React.Fragment>
        ))}
      </span>
    )
  }
  return (
    <CWidgetStatsA
      color={color}
      value={displayValue}
      title={title}
      icon={icon ? <CIcon icon={icon} height={36} /> : undefined}
    >
      {children}
    </CWidgetStatsA>
  )
}

export default StatWidget
