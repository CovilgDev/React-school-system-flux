import React, { useEffect, useState } from 'react';
import { collection, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import './Schedule.css';


const Schedule = () => {
    const [schedule, setSchedule] = useState([]); // Estado para armazenar os dados da grade
    const [loading, setLoading] = useState(true); // Estado para controlar o carregamento

    useEffect(() => {
        const fetchSchedule = async () => {
            try{
                const coursesCollectionRef = collection(db, 'courses');
                const courseDocs = await getDocs(coursesCollectionRef);

                const allClasses = [];

                for(const docSnapshot of courseDocs.docs){
                    const courseData = docSnapshot.data();
                    const courseName = courseData.name;
                    const professorRef = courseData.professorRef;
                    let professorName = "Professor não encontrado";

                    // Se existir uma referência de professor, busca o nome
                    if(professorRef){
                        try{
                            const professorDoc = await getDoc(professorRef);
                            if(professorDoc.exists()){
                                professorName = professorDoc.data().name;
                            }
                        }catch(error){
                            console.error("Erro ao buscar professor: ",error);
                        }
                    }

                    if(Array.isArray(courseData.schedule)){
                        for(const classItem of courseData.schedule){
                            allClasses.push({
                                day: classItem.day,
                                time: classItem.startTime,
                                course: courseName,
                                teacher: professorName
                            });
                        }
                    }
                }

                //console.log("Dados processados para a grade:", allClasses);

                setSchedule(allClasses);
                setLoading(false);
            }catch(error){
                console.log("Erro ao carregar a grade de horários: ", error);
                setLoading(false);
            }
        };

        fetchSchedule();
    }, []);

    // Horários de 8:00 às 21:00 em intervalos de 30 minutos
    const timeSlots = [];
    for (let h = 8; h <= 21; h++) {
        timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        if (h < 21) {
            timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
        }
    }

    const daysOfWeek = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];

    const renderCellContent = (day, time) => {
        // Encontra o curso que acontece neste dia e horário
        const course = schedule.find(c => {
            const classStartTime = c.time.split(':').slice(0, 2).join(':');
            return c.day === day && classStartTime === time;
        });

        if (course) {

            // Se encontrarmos um curso, calculamos a sua duração em linhas
            let rowSpan = 1; // um valor padrão para evitar erro

            // Verifique se os campos de horário existem e são válidos antes de calcular
            if (course.time && course.endTime) {
                const startTime = new Date(`2000/01/01 ${course.time}`);
                const endTime = new Date(`2000/01/01 ${course.endTime}`);
            
                const durationInMinutes = (endTime - startTime) / (1000 * 60);
                rowSpan = durationInMinutes / 30;
            }

            return (
                <td 
                    key={`${day}-${time}`} 
                    className="class-cell-wrapper" 
                    rowSpan={rowSpan}
                >
                    <div className="class-cell">
                        <div className="class-info">
                            <strong>{course.course}</strong>
                            <br />
                            <small>{course.teacher}</small>
                        </div>
                        <button className="call-list-button">
                            Lista de Chamada
                        </button>
                    </div>
                </td>
            );
        }

        const isInsideCourse = schedule.some(c => {
            if(!c.time || !c.endTime) return false;

            const classStartTime = new Date(`2000/01/01 ${c.time}`);
            const classEndTime = new Date(`2000/01/01 ${c.endTime}`);
            const currentTime = new Date(`2000/01/01 ${time}`);
            return c.day === day && currentTime > classStartTime && currentTime < classEndTime;
        });

        // Retorna null para células que estão dentro da duração de uma aula
        // ou para células vazias.
        return isInsideCourse ? null : (
            <td key={`${day}-${time}`} className="class-cell-wrapper" />
        );
    };

    if(loading){
        return(<div className='schedule-loading'>Carregando grade de horários...</div>);
    }

    return (
        <div className="schedule-container">
            <h1>Grade de Horários</h1>
            <table className="schedule-table">
                <thead>
                    <tr>
                        <th className="time-header"></th>
                        {daysOfWeek.map(day => (
                            <th key={day}>{day}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {timeSlots.map(time => (
                        <tr key={time}>
                            <td className="time-cell">{time}</td>
                            {daysOfWeek.map(day => (
                                renderCellContent(day, time)
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Schedule;