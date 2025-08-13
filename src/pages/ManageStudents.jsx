import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase-config';
import './ManageStudents.css';
import CourseName from '../components/CourseName';
import AddCourseSection from '../components/AddCourseSection';

const StudentDetailsModal = ({ student, onClose, onStudentUpdate }) => {
    if(!student) return null;

    // Função para remover um curso do aluno
    const handleRemoveCourse = async (courseRefToRemove) => {

        const isConfirmed = window.confirm("Tem certeza que deseja remover este curso do aluno?");

        if (!isConfirmed) {
            return; 
        }

        if (!student || !student.id) {
            console.error("ID do aluno não está disponível.");
            return;
        }

        try {
            const studentDocRef = doc(db, 'students', student.id);
            
            // Remove a referência do curso do array 'enrolledCourses'
            await updateDoc(studentDocRef, {
                enrolledCourses: arrayRemove(courseRefToRemove)
            });

            // Chama a função para atualizar a UI no componente pai
            if (onStudentUpdate) {
                onStudentUpdate();
            }

        } catch (error) {
            console.error("Erro ao remover o curso: ", error);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Detalhes do Aluno</h2>
                    <button onClick={onClose} className='close-button'>X</button>
                </div>
                <div className="modal-body">
                    <div className="modal-body-seclef">
                        <div className="modal-info">
                            <p><strong>Nome: </strong> {student.basicInfo.fullName}</p>
                            <p><strong>Matricula: </strong> {student.matricula}</p>
                            <p><strong>E-mail: </strong> {student.contactInfo.email}</p>
                        </div>
                        <div className="modal-docs">

                        </div>
                    </div>
                    <div className="modal-body-secrigth">
                        <div className="modal-courses">
                            <div className="courses-list-container">
                                {student.enrolledCourses && student.enrolledCourses.length > 0 ? (
                                    student.enrolledCourses.map((courseRef, index) => (
                                        <div key={index} className="course-tag">
                                            <CourseName courseRef={courseRef} />
                                            <button 
                                                className="remove-course-button"
                                                onClick={() => handleRemoveCourse(courseRef)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <span>Nenhum curso cadastrado</span>
                                )}
                            </div>
                            <AddCourseSection student={student} onStudentUpdate={onStudentUpdate} />
                        </div>
                    </div>            
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
            //const matriculaMatch = student.matricula.includes(matriculaFilter.toLocaleLowerCase());
            return nameMatch;
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

    const handleStudentUpdate = async () => {
        // Recarregue os dados do aluno selecionado do Firestore
        // Isso pode ser uma função que refetch o aluno específico ou todos os alunos
        const studentDocRef = doc(db, 'students', selectedStudent.id);
        const studentDoc = await getDoc(studentDocRef);
        if (studentDoc.exists()) {
            setSelectedStudant({ ...studentDoc.data(), id: studentDoc.id });
        }
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
                            <td>
                                {student.enrolledCourses && student.enrolledCourses.length > 0 ? (
                                    <>
                                        {student.enrolledCourses.slice(0, 2).map((courseRef, index) => (
                                            <span key={index}>
                                                <CourseName courseRef={courseRef} />
                                                {index < student.enrolledCourses.length - 1 && ', '}
                                            </span>
                                        ))}
                                        {student.enrolledCourses.length > 2 && (
                                            <span>, ...</span>
                                        )}
                                    </>
                                ) : (
                                    <span>Nenhum curso cadastrado</span>
                                )}
                            </td>
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
            <StudentDetailsModal
                student={selectedStudent}
                onClose={handleCloseModal}
                onStudentUpdate={handleStudentUpdate}/> 
        </div>
    );
};

export default ManageStudents;