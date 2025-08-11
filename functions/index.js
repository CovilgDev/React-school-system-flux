import { initializeApp } from "firebase-admin/app";

// Inicializa o SDK do Firebase Admin.
// Isso é necessário para que as funções possam interagir com outros
// serviços do Firebase, como o Firestore. Deve ser chamado apenas uma vez.
initializeApp();

// Importa e re-exporta as funções do arquivo aluno.js
// A medida que você criar novas funções em outros arquivos, importe-as aqui.
export { generateMatriculaOnCreate } from "./aluno.js";

// Se você tiver funções de cursos, por exemplo, faria algo como:
// export { createCourse, deleteCourse } from "./cursos.js";
