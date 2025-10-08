import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, arrayRemove, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from '../firebase-config';
import CourseName from '../components/CourseName';
import AddCourseSection from '../components/AddCourseSection';
import '../assets/styles/ManageStudents.css';
import { getPaymentStatusLabel, formatFirebaseTimestamp } from '../utills/utills'; 


const StudentDetailsModal = ({ student, onClose, onStudentUpdate }) => {
    if (!student) return null;

    const [expandedTags, setExpandedTags] = useState({});
    const [monthlyPayments, setMonthlyPayments] = useState({});
    const [loadingPayments, setLoadingPayments] = useState(true);
    // NOVOS ESTADOS PARA EDIÇÃO
    const [isEditing, setIsEditing] = useState(false);
    const [editableStudent, setEditableStudent] = useState(student);
    
    // Efeito para manter editableStudent sincronizado caso o 'student' mude (após um update externo)
    useEffect(() => {
        setEditableStudent(student);
    }, [student]);

    useEffect(() => {
        if (!student || !student.enrolledCourses) return;

        setLoadingPayments(true);
        const unsubscribeFunctions = [];

        // Ao invés de iterar sobre `enrolledCourses`, vamos buscar a subcoleção inteira
        // e depois filtrar os pagamentos por `courseId` no React
        const paymentsCollectionRef = collection(db, `students/${student.id}/monthlyPayments`);

        // A consulta agora apenas ordena por mês, não filtra por 
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

    // NOVO: Função para lidar com a mudança de qualquer input
    const handleInputChange = (section, field, value) => {
        setEditableStudent(prev => {
            const newStudent = JSON.parse(JSON.stringify(prev)); // Cópia profunda
            
            // Lógica para campos aninhados (contactInfo.address ou basicInfo.identificationDocument)
            if (section === 'address') {
                newStudent.contactInfo.address[field] = value;
            } else if (section === 'identificationDocument') {
                newStudent.basicInfo.identificationDocument[field] = value;
            } else {
                newStudent[section][field] = value;
            }
            
            return newStudent;
        });
    };
    
    // NOVO: Função para habilitar o modo de edição
    const handleEditClick = () => {
        // Formata a data de nascimento do Timestamp para string (AAAA-MM-DD) para o input type="date"
        let formattedDate = '';
        const birthDate = student.basicInfo.dateOfBirth;

        if (birthDate && typeof birthDate.toDate === 'function') {
            const dateObject = birthDate.toDate();
            const yyyy = dateObject.getFullYear();
            const mm = String(dateObject.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObject.getDate()).padStart(2, '0');
            formattedDate = `${yyyy}-${mm}-${dd}`;
        }
        
        // Atualiza o estado editável com a data formatada
        setEditableStudent(prev => ({
            ...prev,
            basicInfo: {
                ...prev.basicInfo,
                dateOfBirth: formattedDate
            }
        }));
        
        setIsEditing(true);
    };

    // NOVO: Função para cancelar a edição
    const handleCancelClick = () => {
        setIsEditing(false);
        setEditableStudent(student); // Volta para os dados originais
    };

    // NOVO: Função para salvar as alterações no Firestore
    const handleSaveClick = async () => {
        try {
            const studentDocRef = doc(db, 'students', student.id);
            
            // Converte a string de data de nascimento de volta para um objeto Date
            const birthDateString = editableStudent.basicInfo.dateOfBirth;
            
            // Prepara o objeto com as atualizações
            // Usamos a notação de ponto para atualizar campos aninhados diretamente no Firestore
            const fieldsToUpdate = {
                // Informações Básicas
                'basicInfo.fullName': editableStudent.basicInfo.fullName,
                'basicInfo.dateOfBirth': new Date(birthDateString), // Salva como Date, Firestore converte para Timestamp
                'basicInfo.gender': editableStudent.basicInfo.gender,
                'basicInfo.educationLevel': editableStudent.basicInfo.educationLevel,
                'basicInfo.identificationDocument.number': editableStudent.basicInfo.identificationDocument.number,
                // 'basicInfo.identificationDocument.type': editableStudent.basicInfo.identificationDocument.type, // Assumindo que o tipo de documento não muda
                
                // Informações de Contato
                'contactInfo.phone': editableStudent.contactInfo.phone,
                'contactInfo.email': editableStudent.contactInfo.email,
                'contactInfo.emergencyContact': editableStudent.contactInfo.emergencyContact,
                'contactInfo.address.city': editableStudent.contactInfo.address.city,
                'contactInfo.address.neighborhood': editableStudent.contactInfo.address.neighborhood,
                'contactInfo.address.street': editableStudent.contactInfo.address.street,
                'contactInfo.address.zipcode': editableStudent.contactInfo.address.zipcode,
            };
            
            await updateDoc(studentDocRef, fieldsToUpdate);
            
            setIsEditing(false);
            onStudentUpdate(); 
            alert("Informações do aluno atualizadas com sucesso!");

        } catch (error) {
            console.error("Erro ao salvar informações do aluno: ", error);
            alert("Ocorreu um erro ao salvar as alterações. Verifique o console.");
        }
    };


    const handleUpload = async (event, documentType) => {
        event.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';

        // Apenas .pdf para documentos, qualquer imagem para foto
        input.accept = documentType === 'photo' ?
        'image/*' : '.pdf';
        
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
                    docData = {
                    url: downloadURL,
                    fileName: file.name, // Salva o nome do arquivo para referência
                   
                    hasExpiration: false, // Define explicitamente que não tem validade
                    expirationDate: null
                };
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
            await updateDoc(courseRefToRemove, {
                registeredStudents: arrayRemove(studentDocRef)
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
                                                <path d="M12 12a5 5 0 110-10 5 5 0 010 10zM12 14c-2.67 0-8 
                                                    1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                            </svg>
                                        </div>
              
                                    )}
                                    <strong>Matricula: {student.matricula}</strong>
                                    {student.documents?.photo ?
                                    (
                                        <button className="view-button" onClick={() => window.open(student.documents.photo, '_blank')}>Visualizar</button>
                                    ) : (
                 
                                        <button 
                                            className="upload-button"
                                
                                            onClick={(e) => handleUpload(e, 'photo')}
                                        >
                                            Fazer 
                                            Upload
                                        </button>
                                    )}
                        
                                    {/* NOVO: Botões de Editar/Salvar/Cancelar */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        {isEditing ? (
                                            <>
                                                <button 
                                                    className="save-button" 
                                                    onClick={handleSaveClick}
                                                    style={{ backgroundColor: 'green', color: 'white' }}
                                                >
                                                    Salvar
                                                </button>
                                                <button 
                                                    className="cancel-button" 
                                                    onClick={handleCancelClick}
                                                    style={{ backgroundColor: 'gray', color: 'white' }}
                                                >
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <button 
                                                className="edit-button" 
                                                onClick={handleEditClick}
                                            >
                                                Editar
                                            </button>
                                        )}
                                    </div>

                                </div>
                                <div className='basic-info-card modal-card'>
                      
                                    <h3 className='modal-title-sec-h3'>Informações Básicas</h3>
                                    <hr />
                                    <div className='card-row'>
          
                                        <p><strong>Data de Cadastro: </strong>{formatFirebaseTimestamp(student.basicInfo.dateOfRegistration)}</p>
                                        <p>
                                            <strong>Status: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.basicInfo.status} 
                                                    onChange={(e) => handleInputChange('basicInfo', 'status', e.target.value)}
                                                />
                                            ) : (
                                                student.basicInfo.status
                                            )}
                                        </p>
                          
                                    </div>
                                    <div className='card-row'>
                                        <p>
                                            <strong>Nome:</strong> 
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.basicInfo.fullName} 
                                                    onChange={(e) => handleInputChange('basicInfo', 'fullName', e.target.value)}
                                                />
                                            ) : (
                                                student.basicInfo.fullName
                                            )}
                                        </p>
            
                                        <p>
                                            <strong>Data de Nascimento: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="date" 
                                                    value={editableStudent.basicInfo.dateOfBirth} // Formatado para string AAAA-MM-DD no handleEditClick
                                                    onChange={(e) => handleInputChange('basicInfo', 'dateOfBirth', e.target.value)}
                                                />
                                            ) : (
                                                formatFirebaseTimestamp(student.basicInfo.dateOfBirth)
                                            )}
                                        </p>
                                    </div>
                                 
                                    <div className='card-row'>
                                        <p>
                                            <strong>{student.basicInfo.identificationDocument.type}: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.basicInfo.identificationDocument.number} 
                                                    onChange={(e) => handleInputChange('identificationDocument', 'number', e.target.value)}
                                                />
                                            ) : (
                                                student.basicInfo.identificationDocument.number
                                            )}
                                        </p>
                                        <p>
                                            <strong>Gênero: </strong>
                                            {isEditing ? (
                                                <select
                                                    value={editableStudent.basicInfo.gender} 
                                                    onChange={(e) => handleInputChange('basicInfo', 'gender', e.target.value)}
                                                >
                                                    <option value="Masculino">Masculino</option>
                                                    <option value="Feminino">Feminino</option>
                                                    <option value="Outro">Outro</option>
                                                </select>
                                            ) : (
                                                student.basicInfo.gender
                                            )}
                                        </p>
              
                                    </div>
                                    <div className='card-row'>
                                        <p>
                                            <strong>Escolaridade: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.basicInfo.educationLevel} 
                                                    onChange={(e) => handleInputChange('basicInfo', 'educationLevel', e.target.value)}
                                                />
                                            ) : (
                                                student.basicInfo.educationLevel
                                            )}
                                        </p>
                                    </div>
                                </div>
        
                            </div>
                            <div className='modal-info-sec2'>
                                <div className='contact-Info-card modal-card'>
                 
                                    <h3 className='modal-title-sec-h3'>Informações de Contato</h3>
                                    <hr />
                                    <div className='card-row'>
    
                                        <p>
                                            <strong>Cidade: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.contactInfo.address.city} 
                                                    onChange={(e) => handleInputChange('address', 'city', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.address.city
                                            )}
                                        </p>
                                        <p>
                                            <strong>Bairro: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.contactInfo.address.neighborhood} 
                                                    onChange={(e) => handleInputChange('address', 'neighborhood', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.address.neighborhood
                                            )}
                                        </p>
                      
                                    </div>
                                    <div className='card-row'>
                                        <p>
                                            <strong>Rua: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.contactInfo.address.street} 
                                                    onChange={(e) => handleInputChange('address', 'street', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.address.street
                                            )}
                                        </p>
        
                                        <p>
                                            <strong>Cep: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.contactInfo.address.zipcode} 
                                                    onChange={(e) => handleInputChange('address', 'zipcode', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.address.zipcode
                                            )}
                                        </p>
                                    </div>
                               
                                    <div className='card-row'>
                                        <p>
                                            <strong>Telefone: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="tel" 
                                                    value={editableStudent.contactInfo.phone} 
                                                    onChange={(e) => handleInputChange('contactInfo', 'phone', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.phone
                                            )}
                                        </p>
                                        <p>
                                            <strong>E-mail: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="email" 
                                                    value={editableStudent.contactInfo.email} 
                                                    onChange={(e) => handleInputChange('contactInfo', 'email', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.email
                                            )}
                                        </p>
            
                                    </div>
                                    <div className='card-row'>
                                       
                                        <p>
                                            <strong>Contato de Emergência: </strong>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editableStudent.contactInfo.emergencyContact} 
                                                    onChange={(e) => handleInputChange('contactInfo', 'emergencyContact', e.target.value)}
                                                />
                                            ) : (
                                                student.contactInfo.emergencyContact
                                            )}
                                        </p>
                                    </div>
                                </div>
                            
                            </div>
                            {student?.responsibleInfo?.length > 0 && (
                                <div className='modal-info-sec3'>
                                   
                                    <div className='responsible-Info-card modal-card'>
                                        <h3 className='modal-title-sec-h3'>Informações dos Responsáveis</h3>
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
 
                                    <h3 className='modal-title-sec-h3'>Informações de Saúde</h3>
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
              
                            <h3>Documentos</h3>
                          {student.documents &&
                            Object.keys(student.documents)
                              .filter(docKey => docKey 
                              !== 'photo') // Filtra a chave 'photo'
                              .map(docKey => {
                                const docInfo = student.documents[docKey];
                                // Mapeamento de chaves do Firestore para nomes traduzidos
                                const documentNames = {
                                  'Proofofresidence': 'Comprovante de Residência',
                    
                                  'RG': 'RG',
                                  'cpf': 'CPF',
                                  'imageAuthorization': 'Autorização de Uso de Imagem',
           
                                  'medicalRelease': 'Liberação Médica',
                                  'Birthcertificate': 'Certidão de Nascimento',
                                  'Proofofeducation': 'Comprovante de Escolaridade',
 
                                };
                                // Usa o nome traduzido do mapeamento, ou a chave formatada como fallback
                                const formattedName = documentNames[docKey] ||
                                docKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            
                                return (
                                  <div key={docKey} className="document-item">
                                    <strong>{formattedName}:</strong>
                     
                                    {docInfo && docInfo.url ? (
                                      <>
                                        <span>{docInfo.fileName || 'Documento carregado'}</span>
                                        <span className="validity-status">
                                          {docInfo.hasExpiration ? 
               
                                            `Válido até: ${docInfo.expirationDate || 'N/A'}` : 
                                            "Sem validade"
                    
                                          }
                                        </span>
                                      
                                        <button className="view-button" onClick={() => window.open(docInfo.url, '_blank')}>Visualizar</button>
                                      </>
                                    ) : (
                 
                                      <button 
                                        className="upload-button"
                                      
                                        onClick={(e) => handleUpload(e, docKey)}
                                      >
                                        Fazer Upload
                
                                      </button>
                                    )}
                                  </div>
        
                                );
                            })}
                        </div>
                    </div>

                    <div className='modal-body-secrigth'>
                        <div className="modal-courses">
          
                            <strong>Cursos</strong>
                            <hr />
                            <div className="courses-list-container">
                        
                            {loadingPayments ?
                            (
                                    <span>Carregando histórico de pagamentos...</span>
                                ) : student.enrolledCourses && student.enrolledCourses.length > 0 ?
                            (
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
                                                        className={`expand-toggle-button ${expandedTags[courseRef.id] ?
                                                        'expanded' : ''}`}
                                                        onClick={(e) => {
                                        
                                                            e.stopPropagation();
                                                            toggleTag(courseRef.id);
                                                        }}
                                                    >
                                               
                                                        {expandedTags[courseRef.id] ?
                                                        '-' : '+'}
                                                    </button>
                                              
                                                </div>

                                                {expandedTags[courseRef.id] && (
                                                
                                                    <div style={{ marginTop: '10px', width: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
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
     
                                                                                {payment.month ?
                                                                                payment.month.replace('-', '/') : 'Mês não informado'}:
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