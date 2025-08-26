import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, arrayRemove, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase-config';
import './ManageStudents.css';
import CourseName from '../components/CourseName';
import AddCourseSection from '../components/AddCourseSection';

// Função auxiliar para determinar o status do pagamento
const getPaymentStatusLabel = (paymentData) => {
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
    if (!student) return null;

    const [expandedTags, setExpandedTags] = useState({});
    const [monthlyPayments, setMonthlyPayments] = useState({});
    const [loadingPayments, setLoadingPayments] = useState(true);

    useEffect(() => {
        if (!student || !student.enrolledCourses) return;

        setLoadingPayments(true);
        const unsubscribeFunctions = [];

        // Ao invés de iterar sobre `enrolledCourses`, vamos buscar a subcoleção inteira
        // e depois filtrar os pagamentos por `courseId` no React
        const paymentsCollectionRef = collection(db, `students/${student.id}/monthlyPayments`);

        // A consulta agora apenas ordena por mês, não filtra por courseId
        const paymentsQuery = query(
            paymentsCollectionRef,
            orderBy('month', 'desc')
        );

        const unsubscribe = onSnapshot(paymentsQuery, (paymentsSnapshot) => {
            const allPayments = paymentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Agora, vamos agrupar os pagamentos por curso
            const paymentsByCourse = {};
            student.enrolledCourses.forEach(courseRef => {
                const courseId = courseRef.id;
                paymentsByCourse[courseId] = allPayments.filter(payment => 
                    payment.id.includes(courseId)
                );
            });

            setMonthlyPayments(paymentsByCourse);
            setLoadingPayments(false);
        }, (error) => {
            console.error("Erro ao escutar pagamentos em tempo real: ", error);
            setLoadingPayments(false);
        });

        // Retorna a função de limpeza
        return () => {
            unsubscribe();
        };
    }, [student.id, student.enrolledCourses]);

    const handleRemoveCourse = async (courseRefToRemove) => {
        const isConfirmed = window.confirm("Tem certeza que deseja remover este curso do aluno?");
        if (!isConfirmed) return;
        
        if (!student || !student.id) {
            console.error("ID do aluno não está disponível.");
            return;
        }

        try {
            const studentDocRef = doc(db, 'students', student.id);
            await updateDoc(studentDocRef, {
                enrolledCourses: arrayRemove(courseRefToRemove)
            });
            if (onStudentUpdate) {
                onStudentUpdate();
            }
        } catch (error) {
            console.error("Erro ao remover o curso: ", error);
        }
    };
    
    const toggleTag = (courseId) => {
        setExpandedTags(prev => ({
            ...prev,
            [courseId]: !prev[courseId]
        }));
    };

    const handlePayMonthlyPayment = async (courseId, paymentMonth) => {
        const isConfirmed = window.confirm(`Tem certeza que deseja quitar a mensalidade de ${paymentMonth}?`);
        if (!isConfirmed) return;

        if (!student || !student.id) {
            console.error("ID do aluno não está disponível.");
            return;
        }

        // Cria o ID do documento de pagamento
        const paymentDocId = `${paymentMonth}-${courseId}`;

        // Referência ao documento de pagamento no Firestore
        const paymentDocRef = doc(db, `students/${student.id}/monthlyPayments`, paymentDocId);

        try {
            await updateDoc(paymentDocRef, {
                status: 'paid',
                paymentDate: new Date() // Adiciona a data de pagamento
            });
            alert(`Mensalidade de ${paymentMonth} quitada com sucesso!`);
        } catch (error) {
            console.error("Erro ao quitar a mensalidade: ", error);
            alert("Ocorreu um erro ao tentar quitar a mensalidade.");
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <header className="modal-header">
                    <h2 className="modal-title">Detalhes do Aluno</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </header>
                <div className="modal-body">
                    <div className='modal-body-seclef'>
                        <h3 className='modal-title-sec-h3'>Informações Básicas:</h3>
                        <p><strong>Nome:</strong> {student.basicInfo.fullName}</p>
                        <p><strong>Matricula:</strong> {student.matricula}</p>
                        <p><strong>E-mail:</strong> {student.contactInfo.email}</p>
                    </div>

                    <div className='modal-body-secrigth'>
                        <div className="modal-courses">
                            <strong>Cursos: </strong>
                            <div className="courses-list-container">
                                {loadingPayments ? (
                                    <span>Carregando histórico de pagamentos...</span>
                                ) : student.enrolledCourses && student.enrolledCourses.length > 0 ? (
                                    student.enrolledCourses.map((courseRef) => {
                                        const now = new Date();
                                        const currentMonthId = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
                                        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                                        const nextMonthId = `${nextMonthDate.getFullYear()}-${(nextMonthDate.getMonth() + 1).toString().padStart(2, '0')}`;

                                        const paymentsList = monthlyPayments[courseRef.id] || [];
                                        const currentMonthPayment = paymentsList.find(p => p.month === currentMonthId);
                                        const nextMonthPayment = paymentsList.find(p => p.month === nextMonthId);

                                        return (
                                            <div 
                                                key={courseRef.id} 
                                                className="course-tag"
                                                onClick={() => toggleTag(courseRef.id)}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <CourseName courseRef={courseRef} />
                                                    <button 
                                                        className={`expand-toggle-button ${expandedTags[courseRef.id] ? 'expanded' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTag(courseRef.id);
                                                        }}
                                                    >
                                                        {expandedTags[courseRef.id] ? '-' : '+'}
                                                    </button>
                                                </div>

                                                {expandedTags[courseRef.id] && (
                                                    <div style={{ marginTop: '10px', width: '100%', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                                        {currentMonthPayment || nextMonthPayment ? (
                                                            <>
                                                                {currentMonthPayment && (
                                                                    <p>
                                                                        <strong>Mensalidade ({currentMonthId.replace('-', '/')}) : </strong>
                                                                        {getPaymentStatusLabel(currentMonthPayment)}
                                                                        {currentMonthPayment.status !== 'paid' && (
                                                                            <button 
                                                                                className="pay-button" 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePayMonthlyPayment(courseRef.id, currentMonthPayment.month);
                                                                                }}>
                                                                                Quitar
                                                                            </button>
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {nextMonthPayment && (
                                                                    <p>
                                                                        <strong>Mensalidade ({nextMonthId.replace('-', '/')}) : </strong>
                                                                        {getPaymentStatusLabel(nextMonthPayment)}
                                                                        {nextMonthPayment.status !== 'paid' && (
                                                                            <button 
                                                                                className="pay-button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePayMonthlyPayment(courseRef.id, nextMonthPayment.month);
                                                                                }}>
                                                                                Quitar
                                                                            </button>
                                                                        )}
                                                                    </p>
                                                                )}
                                                                <hr style={{ margin: '10px 0' }} />
                                                                <h4>Histórico Completo:</h4>
                                                                {paymentsList.map((payment, index) => (
                                                                    <div key={index} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <p style={{ margin: '0' }}>
                                                                            <strong>
                                                                                {payment.month ? payment.month.replace('-', '/') : 'Mês não informado'}:
                                                                            </strong> {getPaymentStatusLabel(payment)}
                                                                        </p>
                                                                        {payment.status !== 'paid' && (
                                                                            <button 
                                                                                className="pay-button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePayMonthlyPayment(courseRef.id, payment.month);
                                                                                }}>
                                                                                Quitar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </>
                                                        ) : (
                                                            <p>Nenhum pagamento cadastrado para este curso.</p>
                                                        )}
                                                        
                                                        <button 
                                                            className="remove-course-button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveCourse(courseRef);
                                                            }}
                                                        >
                                                            Remover
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
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