import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, arrayRemove, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from '../firebase-config';
import CourseName from '../components/CourseName';
import AddCourseSection from '../components/AddCourseSection';
import '../assets/styles/ManageStudents.css';

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

    const handleUpload = async (event, documentType) => {
        event.stopPropagation();
        
        const input = document.createElement('input');
        input.type = 'file';

        // Apenas .pdf para documentos, qualquer imagem para foto
        input.accept = documentType === 'photo' ? 'image/*' : '.pdf';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!student || !student.id) {
                alert("ID do aluno não está disponível.");
                return;
            }

            try {
                // Referência ao arquivo no Storage.
                const fileRef = ref(storage, `documentos-alunos/${student.id}/${documentType}/${file.name}`);

                // Faz o upload do arquivo
                await uploadBytes(fileRef, file);

                // Obtém a URL de download
                const downloadURL = await getDownloadURL(fileRef);

                let docData = {};

                // Lógica para documentos com validade
                if (documentType === 'imageAuthorization' || documentType === 'medicalRelease') {
                    const hasExpiration = window.confirm("O documento possui prazo de validade?");
                    let expirationDate = null;

                    if (hasExpiration) {
                        const dateInput = window.prompt("Por favor, insira a data de validade (formato AAAA-MM-DD):");
                        if (dateInput) {
                            expirationDate = dateInput;
                        } else {
                            alert("Data de validade não inserida. O documento será salvo sem validade.");
                        }
                    }

                    docData = {
                        url: downloadURL,
                        fileName: file.name,
                        hasExpiration: hasExpiration,
                        expirationDate: expirationDate
                    };

                } else { // Lógica para a foto do aluno
                    docData = downloadURL; // Salva a URL diretamente
                }

                // Atualiza o documento do aluno no Firestore
                const studentDocRef = doc(db, 'students', student.id);
                await updateDoc(studentDocRef, {
                    [`documents.${documentType}`]: docData
                });

                alert(`Upload de ${documentType} realizado com sucesso!`);
            } catch (error) {
                console.error(`Erro ao fazer o upload de ${documentType}: `, error);
                alert(`Ocorreu um erro ao fazer o upload. Por favor, tente novamente.`);
            }
        };
        input.click();
    };

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
                        <div className='modal-info'>
                            <div className='modal-info-sec1'>
                                <div className="student-photo-section">
                                    {student.documents?.photo ? (
                                        <img src={student.documents.photo} alt="Foto do Aluno" className="student-photo-preview" />
                                    ) : (
                                        <div className="student-photo-placeholder">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 12a5 5 0 110-10 5 5 0 010 10zM12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                            </svg>
                                        </div>
                                    )}
                                    <strong>Matricula: {student.matricula}</strong>
                                    {student.documents?.photo ? (
                                        <button className="view-button" onClick={() => window.open(student.documents.photo, '_blank')}>Visualizar</button>
                                    ) : (
                                        <button 
                                            className="upload-button"
                                            onClick={(e) => handleUpload(e, 'photo')}
                                        >
                                            Fazer Upload
                                        </button>
                                    )}
                                </div>
                                <div className='basic-info-card modal-card'>
                                    <h3 className='modal-title-sec-h3'>Informações Básicas:</h3>
                                    <hr />
                                    <div className='card-row'>
                                        <p><strong>Data de Cadastro:</strong></p>
                                        <p><strong>Status: </strong>{student.basicInfo.status}</p>
                                    </div>
                                    <div className='card-row'>
                                        <p><strong>Nome:</strong> {student.basicInfo.fullName}</p>
                                        <p><strong>Data de Nascimento:</strong></p>
                                    </div>
                                    <div className='card-row'>
                                        <p><strong>{student.basicInfo.identificationDocument.type}: </strong>{student.basicInfo.identificationDocument.number}</p>
                                        <p><strong>Genero: </strong>{student.basicInfo.gender}</p>
                                    </div>
                                    <div className='card-row'><p><strong>Escolaridade: </strong>{student.basicInfo.educationLevel}</p></div>
                                </div>
                            </div>
                            <div className='modal-info-sec2'>
                                <div className='contact-Info-card modal-card'>
                                    <h3 className='modal-title-sec-h3'>Informações de Contato: </h3>
                                    <hr />
                                    <div className='card-row'>
                                        <p><strong>Cidade: </strong>{student.contactInfo.address.city}</p>
                                        <p><strong>Bairro: </strong>{student.contactInfo.address.neighborhood}</p>
                                    </div>
                                    <div className='card-row'>
                                        <p><strong>Rua: </strong>{student.contactInfo.address.street}</p>
                                        <p><strong>Cep: </strong>{student.contactInfo.address.zipcode}</p>
                                    </div>
                                    <div className='card-row'>
                                        <p><strong>Telefone: </strong>{student.contactInfo.phone}</p>
                                        <p><strong>E-mail: </strong>{student.contactInfo.email}</p>
                                    </div>
                                    <div className='card-row'>
                                        <p><strong>Contato de Emergência: </strong>{student.contactInfo.emergencyContact}</p>
                                    </div>
                                </div>
                            </div>
                            {student?.responsibleInfo?.length > 0 && (
                                <div className='modal-info-sec3'>
                                    <div className='responsible-Info-card modal-card'>
                                        <h3 className='modal-title-sec-h3'>Informações dos Responsáveis:</h3>
                                        <hr />
                                        {student.responsibleInfo.map((responsible, index) => (
                                            <div key={index} className="responsible-details">
                                                <div className='card-row'><p><strong>Responsável {index + 1}:</strong></p></div>
                                                <div className='card-row'>
                                                    <p><strong>Nome:</strong> {responsible.name}</p>
                                                    <p><strong>Relação:</strong> {responsible.relationship}</p>
                                                </div>
                                                <div className='card-row'>
                                                    <p><strong>Telefone:</strong> {responsible.phone}</p>
                                                    <p><strong>CPF:</strong> {responsible.cpf}</p>
                                                </div>
                                                {index < student.responsibleInfo.length - 1 && (
                                                    <hr />
                                                )}
                                            </div>
                                        ))}

                                    </div>
                                </div>
                            )}
                            <div className='modal-info-sec4 modal-card'>
                                    <h3 className='modal-title-sec-h3'>Informações de Saúde: </h3>
                                    <hr />
                                    <div className='health-Info-card'>
                                        <div className='card-row'><p><strong>Tipo Sanguíneo: </strong>{student.healthInfo.bloodType}</p></div>
                                        <div className='card-row'><p><strong>Alergias: </strong>{student.healthInfo.allergies}</p></div>
                                        <div className='card-row'><p><strong>Doenças Crônicas: </strong>{student.healthInfo.chronicDiseases}</p></div>
                                        <div className='card-row'><p><strong>Restrições Alimentares: </strong>{student.healthInfo.dietaryRestrictions}</p></div>
                                        <div className='card-row'><p><strong>Medicações Tomadas Regularmente: </strong>{student.healthInfo.regularMedications}</p></div>
                                        <div className='card-row'><p><strong>Informações do Plano de Saúde: </strong>{student.healthInfo.healthPlanDetails}</p></div>

                                    </div>
                            </div>
                        </div>
                        <div className="modal-docs">
                            <h3>Documentos:</h3>
                            <div className="document-item">
                                <strong>Autorização de Imagem:</strong>
                                {student.documents?.imageAuthorization && student.documents.imageAuthorization.url ? (
                                    <>
                                        <span>{student.documents.imageAuthorization.fileName}</span>
                                        <span className="validity-status">
                                            {student.documents.imageAuthorization.hasExpiration ? 
                                                `Válido até: ${student.documents.imageAuthorization.expirationDate}` : 
                                                "Sem validade"
                                            }
                                        </span>
                                        <button className="view-button" onClick={() => window.open(student.documents.imageAuthorization.url, '_blank')}>Visualizar</button>
                                    </>
                                ) : (
                                    <button 
                                        className="upload-button"
                                        onClick={(e) => handleUpload(e, 'imageAuthorization')}
                                    >
                                        Fazer Upload
                                    </button>
                                )}
                            </div>
                            <div className="document-item">
                                <strong>Liberação Médica:</strong>
                                {student.documents?.medicalRelease && student.documents.medicalRelease.url ? (
                                    <>
                                        <span>{student.documents.medicalRelease.fileName}</span>
                                        <span className="validity-status">
                                            {student.documents.medicalRelease.hasExpiration ? 
                                                `Válido até: ${student.documents.medicalRelease.expirationDate}` : 
                                                "Sem validade"
                                            }
                                        </span>
                                        <button className="view-button" onClick={() => window.open(student.documents.medicalRelease.url, '_blank')}>Visualizar</button>
                                    </>
                                ) : (
                                    <button 
                                        className="upload-button"
                                        onClick={(e) => handleUpload(e, 'medicalRelease')}
                                    >
                                        Fazer Upload
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className='modal-body-secrigth'>
                        <div className="modal-courses">
                            <strong>Cursos: </strong>
                            <hr />
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
                                                            Remover Curso
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
                        </div>
                        <AddCourseSection student={student} onStudentUpdate={onStudentUpdate} />
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