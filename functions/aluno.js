import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./index.js";

/**
// Inicialize o SDK do Admin para interagir com o Firestore
initializeApp();

 * @summary Gera uma matrícula quando um novo aluno é criado.
 * @description Esta função é acionada (trigger) sempre que um novo documento
 * é adicionado na coleção 'students'. Ela gera um número de matrícula e
 * o salva de volta no documento do aluno.
 */
export const generateMatriculaOnCreate = onDocumentCreated({
  document: "students/{studentId}",
  region: "southamerica-east1",
}, async (event) => {
  // O ID do documento do aluno que acabou de ser criado.
  const studentId = event.params.studentId;
  const studentData = event.data.data();

  // Verifica se a matrícula já existe para não sobrescrever acidentalmente.
  if (studentData.matricula) {
    logger.info(`Matrícula já existe para o aluno ${studentId}, pulando a geração.`);
    return null;
  }

  // Lógica para gerar o número de matrícula.
  // Usa uma transação para garantir que a leitura e a escrita do contador sejam atômicas.
  const counterRef = db.collection('counters').doc('matriculaCounter');
  try{
    const matricula = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;

        if(counterDoc.exists){
            currentCount = counterDoc.data().count;
        }

        // Incrementa o contador
        currentCount++;

        // Atualiza o contador na transação
        transaction.set(counterRef, { count: currentCount });
        // Formata a data e o contador para a matrícula
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2); // Últimos 2 dígitos do ano (ex: "25")
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Mês com 2 dígitos (ex: "08")
        const paddedCount = currentCount.toString().padStart(2, '0'); // Contador com 2 dígitos (ex: "01", "10")

        return `${year}${month}${paddedCount}`;
    });

    logger.info(`Gerando matrícula ${matricula} para o aluno ${studentId}`);

    // Atualiza o documento do aluno com a nova matrícula.
    return event.data.ref.update({ matricula: matricula });

  }catch(error){
    logger.error("Erro na transação para gerar a matrícula:", error);
    return null;
  }
});


export const createMonthlyPaymentsOnCourseAdd = onDocumentUpdated({
    document: "students/{studentId}",
    region: "southamerica-east1",
}, async (event) => {
    // O ID do aluno é acessado via event.params
    const studentId = event.params.studentId;

    // Os dados do documento antes e depois da alteração são acessados via event.data.before e event.data.after
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Verifica se os campos existem.
    if (!beforeData.enrolledCourses || !afterData.enrolledCourses) {
        return null;
    }

    // Encontra o(s) novo(s) curso(s) que foram adicionados.
    const newlyAddedCourses = afterData.enrolledCourses.filter(afterCourseRef =>
        !beforeData.enrolledCourses.some(beforeCourseRef => beforeCourseRef.isEqual(afterCourseRef))
    );

    // Se nenhum curso novo foi adicionado, não faz nada.
    if (newlyAddedCourses.length === 0) {
        logger.info(`Nenhum novo curso foi adicionado para o aluno ${studentId}.`);
        return null;
    }

    // Para cada novo curso adicionado, cria a subcoleção de pagamentos.
    for (const newCourseRef of newlyAddedCourses) {
        const courseId = newCourseRef.id;

        try {
            // Passo 1: Buscar os dados do curso para obter o valor da mensalidade
            const courseDoc = await db.doc(`courses/${courseId}`).get();
            if (!courseDoc.exists) {
                logger.error(`Curso com ID ${courseId} não encontrado. Não é possível criar o pagamento.`);
                continue;
            }
            const courseAmount = courseDoc.data().price || 0;

            // Passo 2: Preparar os dados para o documento de pagamento
            const now = new Date();
            const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const year = nextMonthDate.getFullYear();
            const month = (nextMonthDate.getMonth() + 1).toString().padStart(2, '0');
            
            const dueDate = new Date(year, nextMonthDate.getMonth(), 5) // DIA 5 É O VENCIMENTO

            const paymentData = {
                month: `${year}-${month}`,
                amount: courseAmount,
                status: 'pending',
                dueDate: Timestamp.fromDate(dueDate),
                paymentDate: null,
                createdAt: FieldValue.serverTimestamp()
            };

            // Passo 3: Criar o documento de pagamento na subcoleção
            const monthlyPaymentDocRef = db.doc(`students/${studentId}/monthlyPayments/${paymentData.month}-${courseId}`);
            await monthlyPaymentDocRef.set(paymentData);

            logger.info(`Documento de pagamento mensal criado para o aluno ${studentId} no curso ${courseId}.`);
            
        } catch (error) {
            logger.error(`Erro ao criar o documento de pagamento para o aluno ${studentId} no curso ${courseId}:`, error);
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
        
        // Define a data de vencimento para o dia 5 do mês atual
        const dueDate = new Date(year, now.getMonth(), 5);

        const coursesCache = {}; // Cache para evitar múltiplas leituras do mesmo curso

        for (const studentDoc of studentsSnapshot.docs) {
            const studentId = studentDoc.id;
            const studentData = studentDoc.data();
            const enrolledCourses = studentData.enrolledCourses || [];

            if (enrolledCourses.length === 0) {
                continue;
            }

            for (const courseRef of enrolledCourses) {
                const courseId = courseRef.id;

                // Tenta pegar o valor do cache, se não existir, busca no banco
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

                // Verifica se o pagamento para o mês atual já existe
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

export const initializeStudentDocuments = onDocumentCreated({
    document: "students/{studentId}",
    region: "southamerica-east1",
}, async (event) => {
    // O ID do documento do aluno que acabou de ser criado.
    const studentId = event.params.studentId;

    try {
        await event.data.ref.update({
            documents: {
                photo: '',
                imageAuthorization: '',
                medicalRelease: ''
            }
        });
        logger.info(`Documentos inicializados com sucesso para o aluno: ${studentId}`);
    } catch (error) {
        logger.error("Erro ao inicializar documentos para o aluno:", studentId, error);
    }
});