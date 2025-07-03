import React from 'react'
import { CWidgetStatsA } from '@coreui/react'
import CIcon from '@coreui/icons-react'

type IconType = string | string[] | Record<string, any>

interface StatWidgetProps {
  color: string
  value: string | number
  title: string
  icon: IconType
}

const StatWidget: React.FC<StatWidgetProps> = ({ color, value, title, icon }) => {
  // Se value contiene "|", mostro i due valori su due righe
  let displayValue = value
  if (typeof value === 'string' && value.includes('|')) {
    const [val1, val2] = value.split('|').map(v => v.trim())
    displayValue = <><span style={{fontWeight:600}}>{val1}</span> <span style={{color:'#888'}}>|</span> <span style={{fontWeight:600}}>{val2}</span></>
  }
  return (
    <CWidgetStatsA
      color={color}
      value={displayValue}
      title={title}
      icon={<CIcon icon={icon} height={36} />}
    />
  )
}

export default StatWidget
