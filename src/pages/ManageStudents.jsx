import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase-config';
import './ManageStudents.css';
import CourseName from '../components/CourseName';
import AddCourseSection from '../components/AddCourseSection';

// Função auxiliar para determinar o status do pagamento
const getPaymentStatusLabel = (paymentData) => {
    if (!paymentData) {
        return <span style={{ color: '#ccc' }}>Não cadastrado para este mês</span>;
    }

    if (paymentData.status === 'paid') {
        return <span style={{ color: 'green', fontWeight: 'bold' }}>Pago</span>;
    }

    // Lógica para 'pending'
    const now = new Date();
    const dueDate = paymentData.dueDate.toDate();
    const isOverdue = now > dueDate;

    if (isOverdue) {
        return <span style={{ color: 'red', fontWeight: 'bold' }}>Vencido</span>;
    } else {
        return <span style={{ color: 'orange', fontWeight: 'bold' }}>Em Aberto</span>;
    }
};

const StudentDetailsModal = ({ student, onClose, onStudentUpdate }) => {
    if(!student) return null;

    const [expandedTags, setExpandedTags] = useState({});
    const [monthlyPayments, setMonthlyPayments] = useState({});
    const [loadingPayments, setLoadingPayments] = useState(true);

    // Efeito para buscar os dados de pagamento do mês atual
    useEffect(() => {
        const fetchMonthlyPayments = async () => {
            if (!student || !student.enrolledCourses) return;

            setLoadingPayments(true);
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const currentMonthId = `${year}-${month}`;

            const paymentsData = {};
            for (const courseRef of student.enrolledCourses) {
                const paymentDocId = `${currentMonthId}-${courseRef.id}`;
                const paymentDocRef = doc(db, `students/${student.id}/monthlyPayments`, paymentDocId);
                const paymentDoc = await getDoc(paymentDocRef);
                
                if (paymentDoc.exists()) {
                    paymentsData[courseRef.id] = paymentDoc.data();
                } else {
                    paymentsData[courseRef.id] = null; // Nenhum pagamento encontrado para o mês
                }
            }
            setMonthlyPayments(paymentsData);
            setLoadingPayments(false);
        };

        fetchMonthlyPayments();
    }, [student.id, student.enrolledCourses]); // Dependências do useEffect


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

    // Função para expandir/colapsar a tag do curso
    const toggleTag = (courseId) => {
        setExpandedTags(prev => ({
            ...prev,
            [courseId]: !prev[courseId]
        }));
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
                                {loadingPayments ? (
                                    <span>Carregando pagamentos...</span>
                                ) : student.enrolledCourses && student.enrolledCourses.length > 0 ? (
                                    student.enrolledCourses.map((courseRef, index) => (
                                        <div 
                                            key={courseRef.id} 
                                            className="course-tag"
                                            onClick={() => toggleTag(courseRef.id)} // Adiciona o evento de clique
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                <CourseName courseRef={courseRef} />
                                                <button
                                                    className={`expand-toggle-button ${expandedTags[courseRef.id] ? 'expanded' : ''}`}
                                                    onClick={(e) => {
                                                            e.stopPropagation(); // Previne que o clique no botão ative o clique da div pai
                                                            toggleTag(courseRef.id);
                                                        }}
                                                >
                                                    {expandedTags[courseRef.id] ? '-' : '+'}
                                                </button>
                                            </div>

                                            {expandedTags[courseRef.id] && (
                                                <div style={{ marginTop: '10px', width: '100%', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <p>
                                                            <strong>Situação Mensalidade: </strong>
                                                            {getPaymentStatusLabel(monthlyPayments[courseRef.id])}
                                                        </p>
                                                        <button 
                                                            className="remove-course-button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Previne que o clique feche a tag
                                                                handleRemoveCourse(courseRef);
                                                            }}
                                                        >
                                                            Remover
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
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