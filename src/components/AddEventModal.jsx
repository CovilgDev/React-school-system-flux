// src/components/AddEventModal.jsx
import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, Timestamp } from 'firebase/firestore'; // Importe 'Timestamp'
import { db } from '../firebase-config';
import '../assets/styles/AddEventModal.css';

const AddEventModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');
    const [responsible, setResponsible] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const [rooms, setRooms] = useState([]);
    const [responsibles, setResponsibles] = useState([]);

    // Busca as opções de salas e responsáveis do Firebase
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const roomsCollectionRef = collection(db, 'rooms');
                const roomsDocs = await getDocs(roomsCollectionRef);
                setRooms(roomsDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                
                const responsiblesCollectionRef = collection(db, 'professors');
                const responsiblesDocs = await getDocs(responsiblesCollectionRef);
                setResponsibles(responsiblesDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error('Erro ao buscar opções de salas/responsáveis:', error);
            }
        };

        if (isOpen) {
            fetchOptions();
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!name || !room || !responsible || !date || !startTime || !endTime) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        // Crie o objeto Date a partir da string 'date' do formulário
        const dateObject = new Date(date);

        // Se a data for inválida, retorne
        if (isNaN(dateObject)) {
            alert('A data fornecida é inválida.');
            return;
        }

        const newEvent = {
            name,
            roomRef: doc(db, 'rooms', room),
            respRef: doc(db, 'professors', responsible),
            date: Timestamp.fromDate(dateObject), // Converte para Timestamp
            schedule: [
                {
                    day: dateObject.toLocaleString('pt-BR', { weekday: 'long' }).toUpperCase(),
                    startTime,
                    endTime
                }
            ],
        };
        
        // Chamada da função onSave do componente pai
        await onSave(newEvent);
        
        // Limpa os campos e fecha o modal
        setName('');
        setRoom('');
        setResponsible('');
        setDate('');
        setStartTime('');
        setEndTime('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="event-modal-overlay">
            <div className="event-modal-content">
                <h2>Novo Evento</h2>
                <div className="event-form-group">
                    <label>Nome do Evento</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="event-form-group">
                    <label>Data</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="event-form-group">
                    <label>Hora de Início</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="event-form-group">
                    <label>Hora de Término</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <div className="event-form-group">
                    <label>Local</label>
                    <select value={room} onChange={(e) => setRoom(e.target.value)}>
                        <option value="">Selecione uma sala</option>
                        {rooms.map(roomOption => (
                            <option key={roomOption.id} value={roomOption.id}>{roomOption.name}</option>
                        ))}
                    </select>
                </div>
                <div className="event-form-group">
                    <label>Responsável</label>
                    <select value={responsible} onChange={(e) => setResponsible(e.target.value)}>
                        <option value="">Selecione um responsável</option>
                        {responsibles.map(respOption => (
                            <option key={respOption.id} value={respOption.id}>{respOption.name}</option>
                        ))}
                    </select>
                </div>
                <div className="event-modal-actions">
                    <button className="event-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="event-btn-confirm" onClick={handleSave}>Confirmar</button>
                </div>
            </div>
        </div>
    );

};

export default AddEventModal;