import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "./index.js";

/**
 * @summary Inicia uma nova sessão de lista de chamada para um evento de aula.
 * @description Esta função cria um novo documento na coleção 'callRecords',
 * buscando a lista de alunos da coleção 'courses' ou 'uniqueEvents'
 * e o timestamp da criação, garantindo que a operação seja segura e centralizada.
 */
export const startAttendanceSession = onCall({ region: 'southamerica-east1' }, async (request) => {
    // 1. Verificação de autenticação
    if (!request.auth) {
        logger.error("Tentativa de chamada não autenticada para startAttendanceSession.");
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem iniciar uma sessão de chamada.');
    }

    // 2. Validação de dados e identificação da coleção
    const { eventId, courseId, isUniqueEvent } = request.data;
    
    if (!eventId || !courseId) {
        logger.error("Dados inválidos: eventId ou courseId ausentes.");
        throw new HttpsError('invalid-argument', 'O ID do evento e do curso são obrigatórios.');
    }

    const collectionPath = isUniqueEvent ? 'uniqueEvents' : 'courses';

    // 3. Obter a lista de alunos da coleção correta
    const eventRef = db.collection(collectionPath).doc(courseId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
        logger.error(`Documento de evento com ID ${courseId} não encontrado na coleção ${collectionPath}.`);
        throw new HttpsError('not-found', 'O evento ou curso especificado não existe.');
    }

    const eventData = eventDoc.data();
    const registeredStudents = eventData.registeredStudents || [];

    // Mapeia as referências de alunos para um formato de objeto
    const attendanceList = registeredStudents.map(studentRef => ({
        studentRef: studentRef,
        present: false,
        checkInTime: null,
    }));

    // 4. Determinar o nome do documento
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();
    const docName = `${day}-${month}-${year}-${eventId}`;

    try {
        const newDocRef = db.collection('callRecords').doc(docName);

        // Verifica se o documento já existe para evitar duplicação
        const docExists = await newDocRef.get();
        if (docExists.exists) {
            logger.warn(`Sessão de chamada para o evento ${eventId} já existe. Não será criada novamente.`);
            return { success: false, callRecordId: newDocRef.id, message: "Sessão já existe." };
        }

        // 5. Criação do documento
        await newDocRef.set({
            eventRef: eventRef, // Usamos 'eventRef' para ser mais genérico
            name: eventData.name || eventData.title, // Usa 'name' para cursos e 'title' para eventos únicos
            createdAt: FieldValue.serverTimestamp(),
            attendanceList: attendanceList,
            status: 'active'
        });

        logger.info(`Nova sessão de chamada criada com ID: ${docName} para o evento ${eventId}.`);

        // 6. Retornar um resultado para o cliente
        return { success: true, callRecordId: newDocRef.id };

    } catch (error) {
        logger.error("Erro ao criar a sessão de chamada:", error);
        throw new HttpsError('internal', 'Erro interno ao iniciar a sessão de chamada.', error);
    }
});