// Função auxiliar para formatar Timestamps do Firebase (DD/MM/AAAA)
export const formatFirebaseTimestamp = (timestamp) => {
    // Verifica se é um objeto Timestamp e se tem a função .toDate()
    if (timestamp && typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        // Formato DD/MM/AAAA
        return date.toLocaleDateString('pt-BR'); 
    }
    return 'N/A'; // Retorna N/A se a data não for válida
};

// Função auxiliar para determinar o status do pagamento (com JSX)
export const getPaymentStatusLabel = (paymentData) => {
    if (paymentData.status === 'paid') {
        return <span style={{ color: 'green', fontWeight: 'bold' }}>Pago</span>;
    }

    // Lógica para 'pending'
    const now = new Date();
    const dueDate = paymentData.dueDate.toDate();
    const isOverdue = now > dueDate;

    if (isOverdue) {
        return <span style={{ color: 'red', fontWeight: 'bold' }}>Vencido</span>;
    } else {
        return <span style={{ color: 'orange', fontWeight: 'bold' }}>Em Aberto</span>;
    }
};