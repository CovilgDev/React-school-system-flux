import React, { useState } from 'react';
import { addDoc, collection, db } from '../firebase-config';
import '../assets/styles/RegisterStudent.css';

// Função auxiliar para atualizar objetos aninhados
const updateNestedObject = (obj, path, val) => {
    const keys = path.split('.'); // Divide o nome do campo em chaves (ex: 'basicInfo.fullName')
    const lastKey = keys.pop(); // Pega a última chave
    const lastObj = keys.reduce((acc, key) => acc[key], obj); // Navega até o objeto pai
    lastObj[lastKey] = val; // Atualiza o valor
    return { ...obj }; // Retorna uma nova cópia do objeto
};

// Função auxiliar para aplicar a máscara no tipo de documento
const formatDocumentNumber = (value, type) => {
  // Remove tudo que não for dígito
  let cleanedValue = value.replace(/\D/g, '');

  if (type === 'CPF') {
    // Aplica a máscara de CPF: 000.000.000-00
    if (cleanedValue.length > 3) cleanedValue = cleanedValue.replace(/^(\d{3})/, '$1.');
    if (cleanedValue.length > 7) cleanedValue = cleanedValue.replace(/(\d{3})(\d{3})/, '$1.$2.');
    if (cleanedValue.length > 11) cleanedValue = cleanedValue.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3-');
    if (cleanedValue.length > 14) cleanedValue = cleanedValue.substring(0, 14); // Limita o tamanho
    return cleanedValue;
  }
  
  if (type === 'RG') {
    // Aplica a máscara de RG: 00.000.000-0
    if (cleanedValue.length > 2) cleanedValue = cleanedValue.replace(/^(\d{2})/, '$1.');
    if (cleanedValue.length > 6) cleanedValue = cleanedValue.replace(/(\d{3})(\d{3})/, '$1.$2.');
    if (cleanedValue.length > 10) cleanedValue = cleanedValue.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3-');
    if (cleanedValue.length > 12) cleanedValue = cleanedValue.substring(0, 12);
    return cleanedValue;
  }
  
  // Para "Outro" ou tipo não reconhecido, retorna o valor sem formatação
  return cleanedValue;
};

// FUNÇÃO AUXILIAR PARA CALCULAR A IDADE
const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

const RegisterStudent = () =>{
    // Estado para armazenar os dados do formulario
    const [studentData, setStudentData] = useState({
        //BasicInfo
        basicInfo:{
            fullName:'',
            identificationDocument:{
                type: 'CPF',
                number:''
            },
            dateOfBirth: '',
            gender: '',
            educationLevel: '',
            status: 'ATIVO'
        },

        // ContactInfo
        contactInfo: {
            phone:'',
            emergencyContact:'',
            email:'',
            address: {
                street: '',
                neighborhood:'',
                zipcode:'',
                city:''
            }
        },

        responsibleInfo: [],

        // HealthInfo
        healthInfo: {
            chronicDiseases: '',
            regularMedications: '',
            dietaryRestrictions: '',
            allergies: '',
            bloodType: '',
            healthPlanDetails: ''
        }
    });

    // Estado apra mensagens de feedback
    const [message, setMessage] = useState('');
    
    // Estado para controlar se a seção de responsável é exibida
    const [showResponsibleInfo, setShowResponsibleInfo] = useState(false);

    // FUNÇÃO PARA LIDAR COM A MUDANÇA NO RADIO BUTTON 'MENOR DE IDADE'
    const handleMinorChange = (e) => {
        const isMinor = e.target.value === 'Sim';
        setShowResponsibleInfo(isMinor);
    };

    const handleAddResponsible = () => {
        setStudentData(prevData => ({
            ...prevData,
            responsibleInfo: [
                ...prevData.responsibleInfo,
                {
                    name: '',
                    phone: '',
                    cpf: '',
                    relationship: ''
                }
            ]
        }));
    };

    const handleResponsibleChange = (e, index) => {
        const { name, value } = e.target;
        let newValue = value;
        
        // Se o campo for o CPF, aplica a máscara
        if (name === 'cpf') {
            newValue = formatDocumentNumber(value, 'CPF');
        }
    
        setStudentData(prevData => {
            const updatedResponsibleInfo = [...prevData.responsibleInfo];
            updatedResponsibleInfo[index] = {
                ...updatedResponsibleInfo[index],
                [name]: newValue
            };
            return {
                ...prevData,
                responsibleInfo: updatedResponsibleInfo
            };
        });
    };

    const handleRemoveResponsible = (indexToRemove) => {
        setStudentData(prevData => ({
            ...prevData,
            responsibleInfo: prevData.responsibleInfo.filter((_, index) => index !== indexToRemove)
        }));
    };

    // Função para lidar com as mudanças nos campos
    const handleChange = (e) => {
        const { name, value, type } = e.target;

        setStudentData(prevData => {
            
            if (name === 'basicInfo.dateOfBirth') {
                const age = calculateAge(value);
                setShowResponsibleInfo(age < 18);
            }

            // Lógica para radio buttons (para `identificationDocument.type`)
            if (type === 'radio' && name === 'documentType') {
                const newIdentificationDocument = {
                    type: value,
                    number: '' // Limpa o campo de número ao mudar o tipo de documento
                };
                return {
                    ...prevData,
                    basicInfo: {
                        ...prevData.basicInfo,
                        identificationDocument: newIdentificationDocument
                    }
                };
            }

            // Se contém um ponto, é um campo aninhado
            if (name.includes('.')) {
                
                const newData = updateNestedObject(prevData, name, value);
                return newData;

            }

            return {
                ...prevData,
                [name]: value
            };

        });
    };

    // handleChange específico para o campo de número do documento para aplicar a máscara
    const handleDocumentNumberChange = (e) => {
        const { value } = e.target;
        const documentType = studentData.basicInfo.identificationDocument.type;

        // Aplica a máscara
        const formattedValue = formatDocumentNumber(value, documentType);

        setStudentData(prevData => ({
            ...prevData,
            basicInfo: {
                ...prevData.basicInfo,
                identificationDocument: {
                    ...prevData.basicInfo.identificationDocument,
                    number: formattedValue
                }
            }
        }));
    };

    // Função para lidar com o envio do formulário
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('Cadastrando...');

        try {
            const studentsCollectionRef = collection(db, 'students');

            const studentToSave = { ...studentData };

            studentToSave.basicInfo.dateOfRegistration = new Date();

            if(studentToSave.basicInfo.dateOfBirth){
                studentToSave.basicInfo.dateOfBirth = new Date(studentToSave.basicInfo.dateOfBirth);
            }

            // Garante que as seções não preenchidas existam
            if (!studentToSave.documents) {
                studentToSave.documents = {};
            }
            if (!studentToSave.enrolledCourses) {
                studentToSave.enrolledCourses = [];
            }

            // Adiciona o novo documento com os dados do aluno
            await addDoc(studentsCollectionRef, studentToSave);

            setMessage('Aluno cadastrado com sucesso!');

            // Limpa o formulário
            setStudentData({
                basicInfo: {
                    fullName: '',
                    identificationDocument: {
                        type: 'CPF',
                        number: ''
                    },
                    dateOfBirth: '',
                    gender: '',
                    educationLevel: '',
                    status: 'ATIVO',
                },
                contactInfo: {
                    phone: '',
                    emergencyContact: '',
                    email: '',
                    address: {
                        street: '',
                        neighborhood: '',
                        zipcode: '',
                        city: ''
                    }
                },
                responsibleInfo: [],
                healthInfo: {},
            });
        } catch (error) {
            console.error("Erro ao adicionar aluno:", error);
            setMessage('Erro ao cadastrar o aluno.');
        }
    };
    
    return (
        <div className="container">
            <h1>Cadastro de Aluno</h1>
            <form onSubmit={handleSubmit}>
                
                {/* ========================================= */}
                {/* 1. INFORMAÇÕES PESSOAIS      */}
                {/* ========================================= */}
                <section>
                    <h2>Informações Pessoais</h2>
                    <div className="form-group">
                        <label htmlFor="fullName">Nome Completo</label>
                        <input
                            type="text"
                            id="fullName"
                            name="basicInfo.fullName"
                            value={studentData.basicInfo.fullName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Tipo de Documento:</label>
                        <div className="radio-group">
                            <div className="radio-item">
                                <input
                                    type="radio"
                                    id="radioCPF"
                                    name="documentType"
                                    value="CPF"
                                    checked={studentData.basicInfo.identificationDocument.type === 'CPF'}
                                    onChange={handleChange}
                                />
                                <label htmlFor="radioCPF">CPF</label>
                            </div>
                            <div className="radio-item">
                                <input
                                    type="radio"
                                    id="radioRG"
                                    name="documentType"
                                    value="RG"
                                    checked={studentData.basicInfo.identificationDocument.type === 'RG'}
                                    onChange={handleChange}
                                />
                                <label htmlFor="radioRG">RG</label>
                            </div>
                            <div className="radio-item">
                                <input
                                    type="radio"
                                    id="radioOther"
                                    name="documentType"
                                    value="Outro"
                                    checked={studentData.basicInfo.identificationDocument.type === 'Outro'}
                                    onChange={handleChange}
                                />
                                <label htmlFor="radioOther">Outro</label>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="documentNumber">Número do Documento</label>
                        <input
                            type="text"
                            id="documentNumber"
                            name="basicInfo.identificationDocument.number"
                            value={studentData.basicInfo.identificationDocument.number}
                            onChange={handleDocumentNumberChange}
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="dateOfBirth">Data de Nascimento</label>
                        <input
                            type="date"
                            id="dateOfBirth"
                            name="basicInfo.dateOfBirth"
                            value={studentData.basicInfo.dateOfBirth}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="gender">Gênero</label>
                        <select
                            id="gender"
                            name="basicInfo.gender"
                            value={studentData.basicInfo.gender}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Selecione</option>
                            <option value="Feminino">Feminino</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="educationLevel">Escolaridade</label>
                        <select
                            type="text"
                            id="educationLevel"
                            name="basicInfo.educationLevel"
                            value={studentData.basicInfo.educationLevel}
                            onChange={handleChange}
                        >
                            <option value="">Selecione</option>
                            <option value="Ensino Fundamental Incompleto">Ensino Fundamental Incompleto</option>
                            <option value="Ensino Fundamental Cursando">Ensino Fundamental Cursando</option>
                            <option value="Ensino Fundamental Completo">Ensino Fundamental Completo</option>
                            <option value="Ensino Médio Incompleto">Ensino Médio Incompleto</option>
                            <option value="Ensino Médio Cursando">Ensino Médio Cursando</option>
                            <option value="Ensino Médio Completo">Ensino Médio Completo</option>
                            <option value="Ensino Superior Incompleto">Ensino Superior Incompleto</option>
                            <option value="Ensino Superior Cursando">Ensino Superior Cursando</option>
                            <option value="Ensino Superior Completo">Ensino Superior Completo</option>
                        </select>
                    </div>
                </section>

                {/* ========================================= */}
                {/* 2. INFORMAÇÕES DE CONTATO     */}
                {/* ========================================= */}
                <section>
                    <h2>Informações de Contato</h2>
                    <div className="form-group">
                        <label htmlFor="phone">Telefone</label>
                        <input
                            type="tel"
                            id="phone"
                            placeholder='(00) 00000-0000'
                            name="contactInfo.phone"
                            value={studentData.contactInfo.phone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">E-mail</label>
                        <input
                            type="email"
                            id="email"
                            placeholder='seuemail@email.com'
                            name="contactInfo.email"
                            value={studentData.contactInfo.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="emergencyContact">Contato de Emergência</label>
                        <input
                            type="text"
                            id="emergencyContact"
                            placeholder='nome do contato [numero de contato]'
                            name="contactInfo.emergencyContact"
                            value={studentData.contactInfo.emergencyContact}
                            onChange={handleChange}
                        />
                    </div>

                    <h3>Endereço</h3>
                    <div className="form-group">
                        <label htmlFor="street">Rua</label>
                        <input
                            type="text"
                            id="street"
                            name="contactInfo.address.street"
                            value={studentData.contactInfo.address.street}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="neighborhood">Bairro</label>
                        <input
                            type="text"
                            id="neighborhood"
                            name="contactInfo.address.neighborhood"
                            value={studentData.contactInfo.address.neighborhood}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="zipcode">CEP</label>
                        <input
                            type="text"
                            id="zipcode"
                            name="contactInfo.address.zipcode"
                            value={studentData.contactInfo.address.zipcode}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="city">Cidade</label>
                        <input
                            type="text"
                            id="city"
                            name="contactInfo.address.city"
                            value={studentData.contactInfo.address.city}
                            onChange={handleChange}
                        />
                    </div>
                </section>

                {/* ========================================= */}
                {/* 3. INFORMAÇÕES DE SAÚDE         */}
                {/* ========================================= */}
                <section>
                    <h2>Informações de Saúde</h2>
                    <div className="form-group">
                        <label htmlFor="chronicDiseases">Doenças Crônicas</label>
                        <input
                            type="text"
                            id="chronicDiseases"
                            name="healthInfo.chronicDiseases"
                            value={studentData.healthInfo.chronicDiseases}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="regularMedications">Medicamentos Regulares</label>
                        <input
                            type="text"
                            id="regularMedications"
                            name="healthInfo.regularMedications"
                            value={studentData.healthInfo.regularMedications}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="dietaryRestrictions">Restrições Alimentares</label>
                        <input
                            type="text"
                            id="dietaryRestrictions"
                            name="healthInfo.dietaryRestrictions"
                            value={studentData.healthInfo.dietaryRestrictions}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="allergies">Alergias</label>
                        <input
                            type="text"
                            id="allergies"
                            name="healthInfo.allergies"
                            value={studentData.healthInfo.allergies}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="bloodType">Tipo Sanguíneo</label>
                        <select
                            type="text"
                            id="bloodType"
                            name="healthInfo.bloodType"
                            value={studentData.healthInfo.bloodType}
                            onChange={handleChange}
                        >
                            <option value="">Selecione</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="healthPlanDetails">Detalhes do Plano de Saúde</label>
                        <input
                            type="text"
                            id="healthPlanDetails"
                            placeholder='Nome do plano [Numero de contato] [Observações]'
                            name="healthInfo.healthPlanDetails"
                            value={studentData.healthInfo.healthPlanDetails}
                            onChange={handleChange}
                        />
                    </div>
                </section>

                {/* ========================================= */}
                {/* 4. INFORMAÇÕES DE RESPONSÁVEIS */}
                {/* ========================================= */}
                <section>
                    <h2>Informações de Responsáveis</h2>
                    <div className="form-group">
                        <label>O aluno é menor de idade?</label>
                        <div className="radio-group">
                            <div className="radio-item">
                                <input
                                    type="radio"
                                    id="isMinorYes"
                                    name="isMinor"
                                    value="Sim"
                                    checked={showResponsibleInfo}
                                    onChange={handleMinorChange}
                                />
                                <label htmlFor="isMinorYes">Sim</label>
                            </div>
                            <div className="radio-item">
                                <input
                                    type="radio"
                                    id="isMinorNo"
                                    name="isMinor"
                                    value="Não"
                                    checked={!showResponsibleInfo}
                                    onChange={handleMinorChange}
                                />
                                <label htmlFor="isMinorNo">Não</label>
                            </div>
                        </div>
                    </div>

                    {/* Renderização condicional da seção do responsável */}
                    {showResponsibleInfo && (
                        <>
                            {studentData.responsibleInfo.map((responsible, index) => (
                                <div key={index} className="responsible-info">
                                    {/* Título e botão de remoção na mesma linha */}
                                    <div className="responsible-header">
                                        <h3>Responsável {index + 1}</h3>
                                        {/* Botão de remoção */}
                                        <button
                                            type="button"
                                            className="remove-button" // Adicione uma classe para estilizar
                                            onClick={() => handleRemoveResponsible(index)}
                                        >
                                            Remover
                                        </button>
                                    </div>

                                    {/* Campos do formulário para o responsável */}
                                    <div className="form-group">
                                        <label>Nome do Responsável {index + 1}:</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={responsible.name}
                                            onChange={(e) => handleResponsibleChange(e, index)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Relação:</label>
                                        <select
                                            name="relationship"
                                            value={responsible.relationship}
                                            onChange={(e) => handleResponsibleChange(e, index)}
                                        >
                                            <option value="">Selecione</option>
                                            <option value="Pai">Pai</option>
                                            <option value="Mãe">Mãe</option>
                                            <option value="Tio(a)">Tio(a)</option>
                                            <option value="Padrasto/Madrasta">Padrasto/Madrasta</option>
                                            <option value="Avô/Avó">Avô/Avó</option>
                                            <option value="Outro">Outro</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Telefone do Responsável {index + 1}:</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={responsible.phone}
                                            onChange={(e) => handleResponsibleChange(e, index)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>CPF do Responsável {index + 1}:</label>
                                        <input
                                            type="text"
                                            name="cpf"
                                            value={responsible.cpf}
                                            onChange={(e) => handleResponsibleChange(e, index)}
                                            maxLength="14" // Limita a entrada a 14 caracteres
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Botão para adicionar mais responsáveis */}
                            <div className="form-group">
                                <button className="btn-submit internal-button" type="button" onClick={handleAddResponsible}>
                                    + Adicionar Responsável
                                </button>
                            </div>
                        </>
                    )}
                </section>

                {/* ========================================= */}
                {/* 5. BOTÃO DE ENVIO             */}
                {/* ========================================= */}
                <button className="btn-submit" type="submit">Cadastrar Aluno</button>
            </form>
            {message && <p className="message">{message}</p>}
        </div>
    );
    
};

export default RegisterStudent;