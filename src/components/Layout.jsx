import React from 'react';
import { Link } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children }) => {
    return(
        <div className="app-container">
            {/*Barra lateral*/}
            <aside className='sidebar'>
                <nav>
                    <ul>
                        <li><Link to="/">Inicio</Link></li>
                        <li><Link to="/cadastro-de-alunos">Cadastro de Alunos</Link></li>
                        <li><Link to="/gerenciar-alunos">Gerenciamento de Alunos</Link></li>
                        <li><Link to="/">Grade de Horário</Link></li>
                    </ul>
                </nav>
            </aside>

            {/* Conteudo Principal */}
            <main className='content'>
                {children}
            </main>
        </div>
    );
};

export default Layout;