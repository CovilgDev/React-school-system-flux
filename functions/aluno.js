import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";

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
  // Inicializa o Firestore DENTRO da função para garantir que o app já foi inicializado.
  const db = getFirestore();

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
