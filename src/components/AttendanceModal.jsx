import React, { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase-config';
import '../assets/styles/AttendanceModal.css';

const AttendanceModal = ({ isOpen, onClose, callRecordId }) => {
    const [callRecord, setCallRecord] = useState(null);
    const [studentsWithAttendance, setStudentsWithAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchCallRecordAndStudents = async () => {
            if (!callRecordId) {
                setLoading(false);
                return;
            }

            try {
                // 1. Busca o registro de chamada
                const docRef = doc(db, 'callRecords', callRecordId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const recordData = docSnap.data();
                    setCallRecord(recordData);

                    // 2. Mapeia a lista de presenças e busca os dados de cada aluno
                    const attendanceList = recordData.attendanceList;
                    const studentPromises = attendanceList.map(async (attendanceItem) => {
                        const studentRef = attendanceItem.studentRef;
                        
                        if (studentRef) {
                            // Busca o documento do aluno usando a referência
                            const studentSnap = await getDoc(studentRef);
                            if (studentSnap.exists()) {
                                return {
                                    ...attendanceItem,
                                    studentName: studentSnap.data().basicInfo.fullName
                                };
                            }
                        }
                        // Retorna o item original se não encontrar o aluno
                        return { ...attendanceItem, studentName: 'Nome não encontrado' };
                    });

                    // 3. Espera todas as buscas de alunos serem concluídas
                    const populatedAttendanceList = await Promise.all(studentPromises);
                    setStudentsWithAttendance(populatedAttendanceList);

                } else {
                    setError("Nenhum registro de chamada encontrado.");
                }
            } catch (error) {
                console.error("Erro ao buscar registro de chamada:", error);
                setError("Erro ao carregar dados.");
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchCallRecordAndStudents();
        } else {
            // Reseta o estado quando o modal fecha
            setCallRecord(null);
            setStudentsWithAttendance([]);
            setLoading(true);
            setError('');
        }
    }, [isOpen, callRecordId]);

    if (!isOpen) {
        return null;
    }

    if (loading) {
        return (
            <div className="modal-backdrop">
                <div className="modal-content">
                    <div className="modal-header">
                        <h2>Carregando...</h2>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="attendance-modal-backdrop">
            <div className="attendance-modal-content">
                <div className="attendance-modal-header">
                    <h2>Lista de Chamada</h2>
                    <button className="attendance-close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="attendance-modal-body">
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    {callRecord && (
                        <>
                            <h3>{callRecord.name}</h3>
                            <ul className="attendance-list-container">
                                {studentsWithAttendance.length > 0 ? (
                                    studentsWithAttendance.map((student, index) => (
                                        <li key={index} className="attendance-student-item">
                                            <label>
                                                <input type="checkbox" checked={student.present} />
                                                <span>{student.studentName}</span>
                                            </label>
                                        </li>
                                    ))
                                ) : (
                                    <p>Nenhum aluno encontrado.</p>
                                )}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceModal;