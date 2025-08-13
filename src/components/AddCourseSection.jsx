import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase-config';

const AddCourseSection = ({ student, onStudentUpdate }) => {
  const [availableCourses, setAvailableCourses] = useState([]);
  const [showCourseList, setShowCourseList] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const coursesCollectionRef = collection(db, 'courses');
        const querySnapshot = await getDocs(coursesCollectionRef);
        const coursesData = querySnapshot.docs.map(courseDoc => ({
          id: courseDoc.id,
          name: courseDoc.data().name,
          ref: doc(db, 'courses', courseDoc.id) // Cria a referência do documento aqui
        }));

        const enrolledCourseRefs = student.enrolledCourses || [];
        const enrolledCourseIds = enrolledCourseRefs.map(ref => ref.id);

        const filteredCourses = coursesData.filter(course => !enrolledCourseIds.includes(course.id));

        setAvailableCourses(filteredCourses);
      } catch (error) {
        console.error("Erro ao buscar cursos: ", error);
      } finally {
        setLoading(false);
      }
    };

    if (showCourseList) {
      fetchCourses();
    }
  }, [showCourseList, student.enrolledCourses]);

  // Altera a função para aceitar a referência do curso
  const handleAddCourse = async (courseRef) => {
    if (!student || !student.id) {
      console.error("ID do aluno não está disponível.");
      return;
    }

    try {
      const studentDocRef = doc(db, 'students', student.id);
      await updateDoc(studentDocRef, {
        enrolledCourses: arrayUnion(courseRef) // Adiciona a referência do curso ao array
      });

      if (onStudentUpdate) {
        onStudentUpdate();
      }

      setShowCourseList(false);
    } catch (error) {
      console.error("Erro ao adicionar curso: ", error);
    }
  };

  const toggleCourseList = () => {
    setShowCourseList(!showCourseList);
  };

  return (
    <div className="add-course-section">
      {showCourseList && (
        <div className="available-courses-list">
          {loading ? (
            <p>Carregando cursos...</p>
          ) : availableCourses.length > 0 ? (
            <ul>
              {availableCourses.map((course) => (
                <li key={course.id}>
                  <span>{course.name}</span>
                  <button onClick={() => handleAddCourse(course.ref)}>Adicionar</button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum curso disponível para matrícula.</p>
          )}
        </div>
      )}
      <div className="button-container">
        <button onClick={toggleCourseList}>
          {showCourseList ? 'Fechar Lista' : '+ Novo Curso'}
        </button>
      </div>
    </div>
  );
};

export default AddCourseSection;