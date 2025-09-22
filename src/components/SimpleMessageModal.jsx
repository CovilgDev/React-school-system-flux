// src/components/SimpleMessageModal.jsx
import React from 'react';
import '../assets/styles/SimpleMessageModal.css';

const SimpleMessageModal = ({ message, onClose }) => {
  if (!message) {
    return null; // Não renderiza se não houver mensagem
  }

  const isSuccess = message === "Aluno cadastrado com sucesso!";

  return (
    <div className="simple-modal-overlay">
      <div className="simple-modal-content">
        <p className="simple-modal-message">{message}</p>
        {isSuccess && (
          <button onClick={onClose} className="simple-modal-button">
            OK
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleMessageModal;