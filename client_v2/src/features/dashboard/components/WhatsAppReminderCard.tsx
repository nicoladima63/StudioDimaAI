import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
  CButton,
  CFormSelect,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cibWhatsapp, cilReload, cilSettings } from '@coreui/icons';
import { NavLink } from 'react-router-dom';
import { remindersService } from '@/features/scheduler/services/remindersService';
import type { ReminderReply } from '@/features/scheduler/services/remindersService';

const fmtDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

const rispostaBadge = (reply: ReminderReply) => {
  const r = reply.response || reply.stato;
  if (r === 'confirmed') return <CBadge color='success'>Confermato</CBadge>;
  if (r === 'cancelled') return <CBadge color='danger'>Cancellato</CBadge>;
  if (reply.stato === 'failed') return <CBadge color='secondary'>Fallito</CBadge>;
  return <CBadge color='warning'>In attesa</CBadge>;
};

// Reminder WhatsApp inviati e relative risposte, visibili subito in dashboard
const WhatsAppReminderCard: React.FC = () => {
  const [items, setItems] = useState<ReminderReply[]>([]);
  const [days, setDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await remindersService.apiGetReplies(days);
      setItems(res.items);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const confirmed = items.filter(i => i.response === 'confirmed' || i.stato === 'confirmed').length;
  const cancelled = items.filter(i => i.response === 'cancelled' || i.stato === 'cancelled').length;
  const pending = items.filter(i => !i.response && i.stato === 'sent').length;

  return (
    <CCard className='h-100'>
      <CCardHeader className='d-flex justify-content-between align-items-center'>
        <h5 className='mb-0'>
          <CIcon icon={cibWhatsapp} className='me-2' />
          WhatsApp Reminder
        </h5>
        <div className='d-flex gap-2 align-items-center'>
          <CFormSelect size='sm' value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 110 }}>
            <option value={1}>1 giorno</option>
            <option value={3}>3 giorni</option>
            <option value={7}>7 giorni</option>
          </CFormSelect>
          <CButton color='secondary' size='sm' onClick={load} disabled={loading} title='Aggiorna'>
            <CIcon icon={cilReload} className='me-0' />
          </CButton>
          <NavLink to='/settings/evolution' className='btn btn-sm btn-secondary' title='Impostazioni WhatsApp'>
            <CIcon icon={cilSettings} className='me-0' />
          </NavLink>
        </div>
      </CCardHeader>
      <CCardBody>
        <div className='d-flex gap-2 mb-2 flex-wrap'>
          <CBadge color='success'>{confirmed} confermati</CBadge>
          <CBadge color='danger'>{cancelled} cancellati</CBadge>
          <CBadge color='warning'>{pending} in attesa</CBadge>
        </div>

        {error && <p className='text-danger small'>{error}</p>}

        {loading ? (
          <div className='text-center py-3'>
            <CSpinner size='sm' color='primary' />
          </div>
        ) : items.length === 0 ? (
          <p className='text-muted small mb-0'>Nessun reminder nel periodo.</p>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.map(item => (
              <div
                key={item.id}
                className='d-flex justify-content-between align-items-center border-bottom py-1 gap-2'
              >
                <div className='text-truncate'>
                  <div className='text-truncate'>{item.patient_name || '-'}</div>
                  <small className='text-muted'>
                    {item.appointment_date ? fmtDate(item.appointment_date) : '-'} {item.appointment_time || ''} - {item.reminder_type}
                  </small>
                </div>
                {rispostaBadge(item)}
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  );
};

export default WhatsAppReminderCard;
