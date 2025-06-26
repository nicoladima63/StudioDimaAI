import React from 'react';
import { CListGroup, CListGroupItem, CBadge } from '@coreui/react';

const RecentActivities: React.FC = () => {
  const activities = [
    { id: 1, action: 'Nuovo utente registrato', time: '10 min fa', color: 'primary' },
    { id: 2, action: 'Appuntamento confermato', time: '1 ora fa', color: 'success' },
    { id: 3, action: 'Pagamento ricevuto', time: '2 ore fa', color: 'info' },
    { id: 4, action: 'Notifica sistema', time: '5 ore fa', color: 'warning' }
  ];

  return (
    <CCard>
      <CCardHeader>Attività recenti</CCardHeader>
      <CCardBody>
        <CListGroup>
          {activities.map((activity) => (
            <CListGroupItem key={activity.id} className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{activity.action}</strong>
                <div className="small text-muted">{activity.time}</div>
              </div>
              <CBadge color={activity.color} shape="rounded-pill">
                Nuovo
              </CBadge>
            </CListGroupItem>
          ))}
        </CListGroup>
      </CCardBody>
    </CCard>
  );
};

export default RecentActivities;
