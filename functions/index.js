import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Inicializa o SDK do Firebase Admin.
// Isso é necessário para que as funções possam interagir com outros
// serviços do Firebase, como o Firestore. Deve ser chamado apenas uma vez.
initializeApp();

export const db = getFirestore();


export {    generateMatriculaOnCreate,
            processStudentDocument,
            createMonthlyPaymentsScheduled
} from "./aluno.js";

export { startAttendanceSession } from "./chamada.js";
