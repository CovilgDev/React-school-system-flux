// Função auxiliar para determinar o status do pagamento
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