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
  return (
    <CWidgetStatsA
      color={color}
      value={value}
      title={title}
      icon={<CIcon icon={icon} height={36} />}
    />
  )
}

export default StatWidget
