// src/components/CourseName.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

const CourseName = ({ courseRef }) => {
    const [courseName, setCourseName] = useState('Carregando...');

    useEffect(() => {
        if (!courseRef) {
            setCourseName('Nenhum curso selecionado');
            return;
        }

        const fetchCourseName = async () => {
            try {
                const docSnap = await getDoc(courseRef);
                if (docSnap.exists()) {
                    const courseData = docSnap.data();
                    setCourseName(courseData.name);
                } else {
                    setCourseName('Curso não encontrado');
                }
            } catch (err) {
                console.error("Erro ao buscar o nome do curso:", err);
                setCourseName('Erro ao carregar');
            }
        };

        fetchCourseName();
    }, [courseRef]);

    return <span className='course-name'>{courseName}</span>;
};

export default CourseName;