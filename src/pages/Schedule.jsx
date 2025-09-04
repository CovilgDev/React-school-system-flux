// src/pages/Schedule.jsx
import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, getDoc, addDoc, doc, Timestamp } from 'firebase/firestore';
import { db, functions, httpsCallable } from '../firebase-config.js';

import { format } from 'date-fns';

// Importações do FullCalendar e plugins
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

// Importando componentes
import AddEventModal from '../components/AddEventModal';
import AttendanceModal from '../components/AttendanceModal';

import '../assets/styles/Schedule.css';

const startAttendanceSession = httpsCallable(functions, 'startAttendanceSession');

const Schedule = () => {
    const [allEvents, setAllEvents] = useState([]); // Novo estado para todos os eventos
    const [events, setEvents] = useState([]); // Estado para os eventos filtrados
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const calendarRef = useRef(null);
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [currentCallRecordId, setCurrentCallRecordId] = useState(null);

    const dayOfWeekMap = {
        'DOMINGO': 0, 'SEGUNDA': 1, 'TERÇA': 2, 'QUARTA': 3, 'QUINTA': 4, 'SEXTA': 5, 'SÁBADO': 6,
    };

    const fetchAllEvents = async () => {
        try {
            // Busque as salas para popular o select
            const roomsCollectionRef = collection(db, 'rooms');
            const roomsDocs = await getDocs(roomsCollectionRef);
            setRooms(roomsDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            const coursesCollectionRef = collection(db, 'courses');
            const courseDocs = await getDocs(coursesCollectionRef);
            const uniqueEventsCollectionRef = collection(db, 'uniqueEvents');
            const uniqueEventsDocs = await getDocs(uniqueEventsCollectionRef);

            const fetchedEvents = [];
            
            // Processa eventos da coleção 'courses'
            for (const docSnapshot of courseDocs.docs) {
                const courseData = docSnapshot.data();
                const courseName = courseData.name;
                const professorRef = courseData.professorRef;
                const roomRef = courseData.roomRef.id; // Assume que cada curso tem apenas uma sala
                let professorName = 'Professor não encontrado';
                
                if (professorRef) {
                    try {
                        const professorDoc = await getDoc(professorRef);
                        if (professorDoc.exists()) {
                            professorName = professorDoc.data().name;
                        }
                    } catch (error) {
                        console.error('Erro ao buscar professor:', error);
                    }
                }

                if (Array.isArray(courseData.schedule)) {
                    courseData.schedule.forEach(classItem => {
                        const dayIndex = dayOfWeekMap[classItem.day.toUpperCase()];
                        fetchedEvents.push({
                            id: docSnapshot.id,
                            title: `${courseName} - ${professorName}`,
                            startTime: classItem.startTime,
                            endTime: classItem.endTime,
                            daysOfWeek: [dayIndex],
                            extendedProps: { 
                                roomId: roomRef,
                                courseId: docSnapshot.id,
                                isUniqueEvent: false
                            },
                            classNames: ['course-event']
                        });
                    });
                }
            }
            
            // Processa eventos da coleção 'uniqueEvents'
            for (const docSnapshot of uniqueEventsDocs.docs) {
                const eventData = docSnapshot.data();
                const eventTitle = eventData.name;
                const responsibleRef = eventData.respRef;
                const roomRef = eventData.roomRef.id; // Armazena o ID da sala
                let responsibleName = 'Responsável não encontrado';
                if (responsibleRef) {
                     try {
                        const responsibleDoc = await getDoc(responsibleRef);
                        if (responsibleDoc.exists()) {
                            responsibleName = responsibleDoc.data().name;
                        }
                    } catch (error) {
                        console.error('Erro ao buscar responsável:', error);
                    }
                }

                if (Array.isArray(eventData.schedule)) {
                     eventData.schedule.forEach(eventItem => {
                        const eventDate = eventData.date.toDate();
                        const startDateTime = new Date(eventDate);
                        const [startHour, startMinute] = eventItem.startTime.split(':').map(Number);
                        startDateTime.setHours(startHour, startMinute, 0);

                        const endDateTime = new Date(eventDate);
                        const [endHour, endMinute] = eventItem.endTime.split(':').map(Number);
                        endDateTime.setHours(endHour, endMinute, 0);

                        fetchedEvents.push({
                            id: docSnapshot.id,
                            title: `${eventTitle} - ${responsibleName}`,
                            start: startDateTime,
                            end: endDateTime,
                            allDay: false,
                            extendedProps: { 
                                roomId: roomRef,
                                courseId: docSnapshot.id,
                                isUniqueEvent: true
                            },
                            classNames: ['unique-event']
                        });
                     });
                }
            }
            // Armazena todos os eventos buscados
            setAllEvents(fetchedEvents);
            setLoading(false);
        } catch (error) {
            console.error('Erro ao carregar a grade de horários:', error);
            setLoading(false);
        }
    };

    // useEffect para buscar os dados iniciais
    useEffect(() => {
        fetchAllEvents();
    }, []);

    // useEffect para filtrar os eventos sempre que o 'selectedRoom' ou 'allEvents' mudar
    useEffect(() => {
        if (selectedRoom) {
            // Filtra os eventos para mostrar apenas os da sala selecionada
            const filteredEvents = allEvents.filter(event => 
                event.extendedProps.roomId === selectedRoom
            );
            setEvents(filteredEvents);
        } else {
            // Se "Todas as Salas" estiver selecionado, exibe todos os eventos
            setEvents(allEvents);
        }
    }, [selectedRoom, allEvents]);

    const handleAddEventClick = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSaveEvent = async (newEvent) => {
        setLoading(true);
        try {
            await addDoc(collection(db, 'uniqueEvents'), newEvent);
            alert('Evento salvo com sucesso!');
            await fetchAllEvents(); // Recarrega TODOS os eventos para manter o estado consistente
        } catch (error) {
            console.error('Erro ao salvar o evento:', error);
            alert('Erro ao salvar o evento. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleAttendanceClick = async (event) => {
        try {
            // Obtenha os dados necessários do objeto de evento do FullCalendar
            const { extendedProps, id } = event;

            if (!extendedProps || !extendedProps.courseId) {
                console.error("Dados do evento incompletos. 'courseId' não encontrado.");
                alert("Não foi possível iniciar a lista de chamada. Dados do evento ausentes.");
                return;
            }

            const eventId = id;
            const courseId = extendedProps.courseId;
            const isUniqueEvent = extendedProps.isUniqueEvent;

            // Chama a Cloud Function
            const result = await startAttendanceSession({ eventId, courseId, isUniqueEvent });

            if (result.data.success) {
                console.log("Sessão de chamada iniciada com sucesso. ID:", result.data.callRecordId);
                setCurrentCallRecordId(result.data.callRecordId);
                setIsAttendanceModalOpen(true);
            } else {
                console.warn("A sessão de chamada já existe para este evento.");
                setCurrentCallRecordId(result.data.callRecordId);
                setIsAttendanceModalOpen(true);
            }
        } catch (error) {
            console.error("Erro ao iniciar a sessão de chamada:", error.message);
            alert(`Erro: ${error.message}`);
        }
    };

    const handleEventContent = (eventInfo) => {
        const isDayView = eventInfo.view.type === 'timeGridDay';
        const eventDate = format(eventInfo.event.start, 'yyyy-MM-dd');
        const today = format(new Date(), 'yyyy-MM-dd');

        const showAttendanceButton = isDayView && eventDate === today;

        return (
            <div className="event-content-wrapper">
                <div className="fc-event-title">{eventInfo.event.title}</div>
                {showAttendanceButton && (
                    <button
                        className="attendance-button"
                        onClick={() => handleAttendanceClick(eventInfo.event)}
                    >
                        Lista de Chamada
                    </button>
                )}
            </div>
        );
    };

    if (loading) {
        return <div className="schedule-loading">Carregando grade de horários...</div>;
    }

    return (
        <div className="schedule-container">
            <h1>Grade de Horários</h1>
            <div className="custom-toolbar">
                <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="custom-location-select">
                    <option value="">Todas as Salas</option>
                    {rooms.map(room => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                </select>
                <button className="add-event-button" onClick={handleAddEventClick}>
                    + Novo evento
                </button>
            </div>
            
            <FullCalendar
                ref={calendarRef}
                plugins={[ dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin ]}
                initialView="timeGridWeek"
                locale={ptBrLocale}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                }}
                customButtons={{}}
                viewDidMount={null}
                events={events} // Agora passa a lista de eventos FILTRADA
                eventDisplay="block"
                eventContent={handleEventContent}
                eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: false
                }}
                businessHours={{
                    daysOfWeek: [ 1, 2, 3, 4, 5 ],
                    startTime: '07:00',
                    endTime: '22:00'
                }}
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
            />
            
            <AttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                callRecordId={currentCallRecordId}
            />
        </div>
    );
};

export default Schedule;