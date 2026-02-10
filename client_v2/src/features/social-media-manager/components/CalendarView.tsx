/**
 * CalendarView Component
 * Calendario interattivo per visualizzare e gestire posts schedulati
 * Usa react-big-calendar con moment localizer
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer, Event as BigCalendarEvent } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/it'; // Locale italiano
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
  CAlert,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CBadge,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilCalendar,
  cilX,
  cilPencil,
  cilTrash,
} from '@coreui/icons';
import socialMediaManagerService from '../services/socialMediaManager.service';
import toast from 'react-hot-toast';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import { getPlatformColor, getPlatformAbbr } from '../constants/socialPlatforms';

// Configura moment con locale italiano
import 'moment/dist/locale/it';
moment.locale('it');
const localizer = momentLocalizer(moment);

interface CalendarViewProps {
  onEditPost?: (postId: number) => void;
  onDeletePost?: (postId: number) => void;
}

interface CalendarEventExtended extends BigCalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  platforms: string[];
  category_id?: number;
  status: string;
  content_type: string;
  content?: string;
  hashtags?: string[];
  media_urls?: string[];
  allDay?: boolean;
  resource?: any;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  onEditPost,
  onDeletePost,
}) => {
  const [events, setEvents] = useState<CalendarEventExtended[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventExtended | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Carica categorie dallo store
  const { categories, loadCategories } = useSocialMediaStore();

  // Carica eventi per il range di date visualizzato
  const loadEvents = useCallback(async (startDate: Date, endDate: Date) => {
    setLoading(true);
    setError(null);

    try {
      const response = await socialMediaManagerService.apiGetCalendarEvents(
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (response.success && response.data) {
        // Converti eventi da backend a formato react-big-calendar
        const calendarEvents: CalendarEventExtended[] = response.data.events.map((event) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
          title: event.title,
        }));

        setEvents(calendarEvents);
      } else {
        throw new Error(response.error || 'Failed to load calendar events');
      }
    } catch (err: any) {
      console.error('Error loading calendar events:', err);
      setError(err.message || 'Errore nel caricamento degli eventi');
      toast.error('Errore nel caricamento del calendario');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carica categorie e eventi iniziali
  useEffect(() => {
    loadCategories();
    const now = new Date();
    const startOfMonth = moment(now).startOf('month').toDate();
    const endOfMonth = moment(now).endOf('month').toDate();
    loadEvents(startOfMonth, endOfMonth);
  }, [loadEvents, loadCategories]);

  // Crea mappa colori categorie dal DB
  const categoryColors = React.useMemo(() => {
    const colors: Record<number, string> = {};
    categories.forEach((cat) => {
      colors[cat.id] = cat.color || '#6c757d'; // Fallback grigio se colore mancante
    });
    return colors;
  }, [categories]);

  // Gestisci navigazione calendario (cambio mese/settimana)
  const handleNavigate = useCallback(
    (newDate: Date) => {
      const startOfMonth = moment(newDate).startOf('month').toDate();
      const endOfMonth = moment(newDate).endOf('month').toDate();
      loadEvents(startOfMonth, endOfMonth);
    },
    [loadEvents]
  );

  // Gestisci click su evento
  const handleSelectEvent = useCallback((event: CalendarEventExtended) => {
    setSelectedEvent(event);
    setShowDetailModal(true);
  }, []);

  // Gestisci drag & drop per rescheduling
  const handleEventDrop = useCallback(
    async ({ event, start, end }: { event: CalendarEventExtended; start: Date; end: Date }) => {
      try {
        // Aggiorna data schedulata tramite API
        await socialMediaManagerService.apiSchedulePost(
          event.id,
          start.toISOString()
        );

        // Aggiorna evento localmente
        setEvents((prevEvents) =>
          prevEvents.map((e) =>
            e.id === event.id ? { ...e, start, end } : e
          )
        );

        toast.success('Data pubblicazione aggiornata');
      } catch (err: any) {
        console.error('Error rescheduling event:', err);
        toast.error('Errore durante il rescheduling');
      }
    },
    []
  );

  // Stile eventi personalizzato (colore per categoria dal DB)
  const eventStyleGetter = useCallback(
    (event: CalendarEventExtended) => {
      const backgroundColor =
        categoryColors[event.category_id || 0] || '#6c757d';

      return {
        style: {
          backgroundColor,
          borderRadius: '4px',
          opacity: 0.9,
          color: 'white',
          border: '0px',
          display: 'block',
          fontSize: '0.85rem',
        },
      };
    },
    [categoryColors]
  );

  // Componente custom per eventi (titolo nero + badge colorati per social)
  const EventComponent = ({ event }: { event: CalendarEventExtended }) => (
    <div style={{
      padding: '4px 6px',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{
        fontWeight: 'bold',
        fontSize: '0.9rem',
        lineHeight: '1.2',
        marginBottom: '4px',
        color: '#000',
        textShadow: '0 0 2px rgba(255,255,255,0.8)',
      }}>
        {event.title}
      </div>
      <div style={{
        display: 'flex',
        gap: '3px',
        flexWrap: 'wrap',
      }}>
        {event.platforms.map((platform) => (
          <span
            key={platform}
            style={{
              fontSize: '0.65rem',
              padding: '1px 4px',
              borderRadius: '3px',
              backgroundColor: getPlatformColor(platform),
              color: '#fff',
              fontWeight: '600',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {getPlatformAbbr(platform)}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <CIcon icon={cilCalendar} size="lg" className="me-2" />
            <h5 className="mb-0">Calendario Pubblicazioni</h5>
          </div>

          {/* Legenda Categorie (dinamica dal DB) */}
          <div className="d-flex align-items-center gap-3">
            <h5 className="mb-0">Categorie:</h5>
            <div className="d-flex gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="d-flex align-items-center"
                  style={{ fontSize: '0.85rem' }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      backgroundColor: category.color || '#6c757d',
                      borderRadius: '3px',
                      marginRight: '4px',
                    }}
                  />
                  <span>{category.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" className="mb-3">
              {error}
            </CAlert>
          )}

          {loading && (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2">Caricamento eventi...</p>
            </div>
          )}

          {!loading && (
            <Calendar
              localizer={localizer}
              culture="it"
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              onEventDrop={handleEventDrop}
              eventPropGetter={eventStyleGetter}
              components={{
                event: EventComponent,
              }}
              draggableAccessor={() => true}
              resizable={false}
              messages={{
                next: 'Prossimo',
                previous: 'Precedente',
                today: 'Oggi',
                month: 'Mese',
                week: 'Settimana',
                day: 'Giorno',
                agenda: 'Agenda',
                date: 'Data',
                time: 'Ora',
                event: 'Evento',
                noEventsInRange: 'Nessun evento programmato in questo periodo',
                showMore: (total: number) => `+${total} altri`,
              }}
            />
          )}
        </CCardBody>
      </CCard>

      {/* Modal Dettaglio Evento */}
      <CModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>{selectedEvent?.title}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedEvent && (
            <div>
              <div className="mb-3">
                <strong>Data Pubblicazione:</strong>{' '}
                {moment(selectedEvent.start).format('DD/MM/YYYY HH:mm')}
              </div>

              <div className="mb-3">
                <strong>Piattaforme:</strong>
                <div className="mt-2">
                  {selectedEvent.platforms.map((platform) => (
                    <CBadge
                      key={platform}
                      color="info"
                      className="me-2"
                      style={{
                        backgroundColor: getPlatformColor(platform),
                      }}
                    >
                      {platform}
                    </CBadge>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <strong>Stato:</strong>{' '}
                <CBadge color={selectedEvent.status === 'scheduled' ? 'warning' : 'success'}>
                  {selectedEvent.status}
                </CBadge>
              </div>

              <div className="mb-3">
                <strong>Tipo Contenuto:</strong> {selectedEvent.content_type}
              </div>

              {selectedEvent.content && (
                <div className="mb-3">
                  <strong>Contenuto:</strong>
                  <div
                    className="mt-2 p-3"
                    style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedEvent.content}
                  </div>
                </div>
              )}

              {selectedEvent.hashtags && selectedEvent.hashtags.length > 0 && (
                <div className="mb-3">
                  <strong>Hashtags:</strong>
                  <div className="mt-2">
                    {selectedEvent.hashtags.map((tag, idx) => (
                      <CBadge key={idx} color="secondary" className="me-2">
                        {tag}
                      </CBadge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.media_urls && selectedEvent.media_urls.length > 0 && (
                <div className="mb-3">
                  <strong>Media:</strong>
                  <div className="mt-2">
                    {selectedEvent.media_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="d-block mb-1"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          {onEditPost && selectedEvent && (
            <CButton
              color="primary"
              onClick={() => {
                onEditPost(selectedEvent.id);
                setShowDetailModal(false);
              }}
            >
              <CIcon icon={cilPencil} className="me-1" />
              Modifica
            </CButton>
          )}
          {onDeletePost && selectedEvent && (
            <CButton
              color="danger"
              onClick={() => {
                onDeletePost(selectedEvent.id);
                setShowDetailModal(false);
              }}
            >
              <CIcon icon={cilTrash} className="me-1" />
              Elimina
            </CButton>
          )}
          <CButton color="secondary" onClick={() => setShowDetailModal(false)}>
            <CIcon icon={cilX} className="me-1" />
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default CalendarView;
