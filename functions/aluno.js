import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./index.js";

/**
 * @summary Gera uma matrícula quando um novo aluno é criado.
 * @description Esta função é acionada (trigger) sempre que um novo documento
 * é adicionado na coleção 'students'. Ela gera um número de matrícula e
 * o salva de volta no documento do aluno.
 */
export const generateMatriculaOnCreate = onDocumentCreated({
    document: "students/{studentId}",
    region: "southamerica-east1",
}, async (event) => {
    const studentId = event.params.studentId;
    const studentData = event.data.data();

    if (studentData.matricula) {
        logger.info(`Matrícula já existe para o aluno ${studentId}, pulando a geração.`);
        return null;
    }

    const counterRef = db.collection('counters').doc('matriculaCounter');
    try {
        const matricula = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentCount = 0;

            if (counterDoc.exists) {
                currentCount = counterDoc.data().count;
            }

            currentCount++;
            transaction.set(counterRef, { count: currentCount });

            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const paddedCount = currentCount.toString().padStart(2, '0');

            return `${year}${month}${paddedCount}`;
        });

        logger.info(`Gerando matrícula ${matricula} para o aluno ${studentId}`);
        return event.data.ref.update({ matricula: matricula });

    } catch (error) {
        logger.error("Erro na transação para gerar a matrícula:", error);
        return null;
    }
});

/**
 * @summary Lida com a criação de documentos, pagamentos de matrícula e pagamentos de mensalidade.
 * @description Esta função é acionada em qualquer criação ou atualização de um documento de aluno.
 * Ela unifica a lógica de inicialização de documentos, criação de débitos de matrícula e pagamentos
 * mensais para novos cursos adicionados.
 */
export const processStudentDocument = onDocumentWritten({
    document: "students/{studentId}",
    region: "southamerica-east1",
}, async (event) => {
    const studentId = event.params.studentId;
    const beforeData = event.data.before?.data();
    const afterData = event.data.after?.data();

    if (!afterData) {
        return null;
    }

    const documentsToUpdate = afterData.documents || {};
    let documentsChanged = false;
    
    // Lógica de inicialização de documentos na criação do aluno
    if (!beforeData) { // Acontece apenas na criação do documento
        documentsToUpdate.photo = '';
        documentsToUpdate.imageAuthorization = '';
        documentsToUpdate.Proofofresidence = '';
        documentsToUpdate.CPF = '';
        documentsToUpdate.RG = '';
        documentsChanged = true;

        if (afterData.dateOfBirth) {
            const birthDate = afterData.dateOfBirth.toDate();
            const now = new Date();
            const age = now.getFullYear() - birthDate.getFullYear();
            const monthDiff = now.getMonth() - birthDate.getMonth();
            const dayDiff = now.getDate() - birthDate.getDate();

            if (age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
                documentsToUpdate.Birthcertificate = '';
                documentsToUpdate.Proofofeducation = '';
            }
        }
    }

    // Lógica para pagamentos de mensalidade e documentos de cursos
    const enrolledCoursesRefsAfter = afterData.enrolledCourses || [];
    const enrolledCoursesRefsBefore = beforeData?.enrolledCourses || [];
    
    const newlyAddedCourses = enrolledCoursesRefsAfter.filter(afterCourseRef =>
        !enrolledCoursesRefsBefore.some(beforeCourseRef => beforeCourseRef.isEqual(afterCourseRef))
    );

    if (newlyAddedCourses.length > 0) {
        for (const newCourseRef of newlyAddedCourses) {
            const courseId = newCourseRef.id;

            try {
                // Lógica de taxa de matrícula: somente se um curso for adicionado
                const enrollmentFeeDocRef = db.doc(`students/${studentId}/monthlyPayments/taxa_de_matricula-${courseId}`);
                const enrollmentFeeDoc = await enrollmentFeeDocRef.get();
                
                if (!enrollmentFeeDoc.exists) {
                    const enrollmentFeeAmount = 0;
                    const enrollmentPaymentData = {
                        description: `Registration-Fee - ${courseId}`,
                        amount: enrollmentFeeAmount,
                        status: 'pending',
                        dueDate: FieldValue.serverTimestamp(),
                        paymentDate: null,
                        createdAt: FieldValue.serverTimestamp()
                    };

                    await enrollmentFeeDocRef.set(enrollmentPaymentData);
                    logger.info(`Débito de matrícula criado para o aluno ${studentId} no curso ${courseId}.`);
                }

                // Lógica para criar documento médico
                const sportsRequiringMedicalRelease = [
                    "PILATES", "DANÇA MIX", "JIU JITSU (4 A 11 ANOS)", "JIU JITSU (+12 ANOS)", "Muay Thai", "TAEKWONDO WTF"
                ];
                
                const courseDoc = await db.doc(`courses/${courseId}`).get();
                if (!courseDoc.exists) {
                    logger.error(`Curso com ID ${courseId} não encontrado.`);
                    continue;
                }
                const courseData = courseDoc.data();
                const courseName = courseData.name;

                if (sportsRequiringMedicalRelease.includes(courseName)) {
                    if (!documentsToUpdate.medicalRelease) {
                        documentsToUpdate.medicalRelease = '';
                        documentsChanged = true;
                    }
                }

                // Lógica de pagamento mensal (existente)
                const courseAmount = courseData.price || 0;
                const now = new Date();
                const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                const year = nextMonthDate.getFullYear();
                const month = (nextMonthDate.getMonth() + 1).toString().padStart(2, '0');
                const dueDate = new Date(year, nextMonthDate.getMonth(), 5);

                const paymentData = {
                    month: `${year}-${month}`,
                    description: courseName,
                    amount: courseAmount,
                    status: 'pending',
                    dueDate: Timestamp.fromDate(dueDate),
                    paymentDate: null,
                    createdAt: FieldValue.serverTimestamp()
                };

                await db.doc(`students/${studentId}/monthlyPayments/${paymentData.month}-${courseId}`).set(paymentData);
                logger.info(`Pagamento mensal criado para o aluno ${studentId} no curso ${courseId}.`);

            } catch (error) {
                logger.error(`Erro ao processar o curso ${courseId}:`, error);
            }
        }
    }
    
    if (documentsChanged) {
        try {
            await db.doc(`students/${studentId}`).update({
                documents: documentsToUpdate
            });
            logger.info(`Documentos atualizados para o aluno ${studentId}.`);
        } catch (error) {
            logger.error(`Erro ao atualizar os documentos do aluno ${studentId}:`, error);
        }
    }

    return null;
});

/**
 * @summary Cria pagamentos mensais para todos os alunos no dia 1 de cada mês.
 * @description Esta função é agendada para rodar no primeiro dia de cada mês, à meia-noite (fuso horário local),
 * verificando os cursos de cada aluno e criando um novo documento de pagamento se ele ainda não existir para o mês atual.
 */
export const createMonthlyPaymentsScheduled = onSchedule({
    schedule: "0 0 1 * *", // Cron job: minuto 0, hora 0, dia 1 do mês, qualquer mês, qualquer dia da semana.
    timeZone: "America/Sao_Paulo", // Defina o fuso horário para a meia-noite correta.
    region: "southamerica-east1",
}, async () => {
    logger.info("Executando a função agendada para criar pagamentos mensais.");

    try {
        const studentsSnapshot = await db.collection('students').get();
        if (studentsSnapshot.empty) {
            logger.info("Nenhum aluno encontrado. Encerrando a função.");
            return null;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentMonthId = `${year}-${month}`;
        
        const dueDate = new Date(year, now.getMonth(), 5);

        const coursesCache = {};

        for (const studentDoc of studentsSnapshot.docs) {
            const studentId = studentDoc.id;
            const studentData = studentDoc.data();
            const enrolledCourses = studentData.enrolledCourses || [];

            if (enrolledCourses.length === 0) {
                continue;
            }

            for (const courseRef of enrolledCourses) {
                const courseId = courseRef.id;

                let courseAmount = coursesCache[courseId];
                if (courseAmount === undefined) {
                    const courseDoc = await db.doc(`courses/${courseId}`).get();
                    if (courseDoc.exists) {
                        courseAmount = courseDoc.data().price || 0;
                        coursesCache[courseId] = courseAmount;
                    } else {
                        logger.error(`Curso com ID ${courseId} não encontrado. Não é possível criar o pagamento para o aluno ${studentId}.`);
                        continue;
                    }
                }

                const paymentDocRef = db.doc(`students/${studentId}/monthlyPayments/${currentMonthId}-${courseId}`);
                const paymentDoc = await paymentDocRef.get();

                if (!paymentDoc.exists) {
                    const paymentData = {
                        month: currentMonthId,
                        amount: courseAmount,
                        status: 'pending',
                        dueDate: Timestamp.fromDate(dueDate),
                        paymentDate: null,
                        createdAt: FieldValue.serverTimestamp()
                    };

                    await paymentDocRef.set(paymentData);
                    logger.info(`Pagamento criado para o aluno ${studentId} no curso ${courseId} para o mês ${currentMonthId}.`);
                } else {
                    logger.info(`Pagamento para o aluno ${studentId} no curso ${courseId} para o mês ${currentMonthId} já existe.`);
                }
            }
        }
        
        logger.info("Função agendada concluída com sucesso.");
        return null;
    } catch (error) {
        logger.error("Erro na função agendada de pagamentos:", error);
        return null;
    }
});