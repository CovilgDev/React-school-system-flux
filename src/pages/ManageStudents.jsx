import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';
import './ManageStudents.css';

const StudentDetailsModal = ({ student, onClose }) => {
    if(!student) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Detalhes do Aluno</h2>
                    <button onClick={onClose} className='close-button'>X</button>
                </div>
                <div className="modal-body">
                    <p><strong>Nome: </strong> {student.basicInfo.fullName}</p>
                    <p><strong>Matricula: </strong> {student.matricula}</p>
                    <p><strong>E-mail: </strong> {student.contactInfo.email}</p>
                    <p><strong>Cursos: </strong> {student.enrolledCourses.join(',')}</p>
                    {/* --- Adicionar Todas as informações ---*/}
                </div>
            </div>
        </div>
    );
};

const ManageStudents = () => {
    const [students, setStudents] = useState([]);
    const [filteredStudantes, setFilteredStudantes] = useState([]);
    const [nameFilter, setNameFilter] = useState('');
    const [matriculaFilter, setMatriculaFilter] = useState('');
    const [selectedStudent, setSelectedStudant] = useState(null);

    useEffect(() => {
        const fetchStudents = async () => {
            try{
                const studentCollectionRef = collection(db, 'students');
                const studentDocs = await getDocs(studentCollectionRef);
                const studentsData = studentDocs.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }));

                setStudents(studentsData);
                setFilteredStudantes(studentsData);
            }catch(error){
                console.error("Erro ao carregar alunos: ", error);
            }
        };

        fetchStudents();
    }, []);

    // Aplicação dos filtros
    const applyFilters = () => {
        const filtered = students.filter(student => {
            const nameMatch = student.basicInfo.fullName.toLowerCase().includes(nameFilter.toLowerCase());
            const matriculaMatch = student.matricula.includes(matriculaFilter.toLocaleLowerCase());
            return nameMatch && matriculaMatch;
        });
        setFilteredStudantes(filtered);
    };

    //Aplicar filtros sempre que os valores mudarem
    useEffect(() => {
        applyFilters();
    }, [nameFilter, matriculaFilter, students]);

    const handleOpenModal = (student) => {
        setSelectedStudant(student);
    };

    const handleCloseModal = () => {
        setSelectedStudant(null);
    };

    return(
        <div className="manage-students-container">
            <h1>Gerenciamento de Alunos</h1>

            {/* Filtros */}
            <div className="filters">
                <input
                    type="text"
                    placeholder='Filtrar por Nome'
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                />
                <input
                    type="text"
                    placeholder='Filtrar por Matricula'
                    value={matriculaFilter}
                    onChange={(e) => setMatriculaFilter(e.target.value)}
                />
            </div>

            {/* Tabela de Alunos */}
            <table className='students-table'>
                <thead>
                    <tr>
                        <th>Matricula</th>
                        <th>Nome</th>
                        <th>Cursos Cadastrados</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredStudantes.map(student => (
                        <tr key={student.id}>
                            <td>{student.matricula}</td>
                            <td>{student.basicInfo.fullName}</td>
                            <td>{student.enrolledCourses.join(', ')}</td>
                            <td>
                                <button className='details-button' onClick={() => handleOpenModal(student)}>
                                    Ver Detalhes
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Modal de Detalhes */}
            <StudentDetailsModal student={selectedStudent} onClose={handleCloseModal} /> 
        </div>
    );
};

export default ManageStudents;