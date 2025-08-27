import React from 'react';
import { Link } from 'react-router-dom';
import '../assets/styles/layout.css';

const Layout = ({ children, onLogout, onToggleDarkMode }) => {
    return(
        <div className="app-container">
            {/*Barra lateral*/}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <div className="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 14l9-5-9-5-9 5 9 5z" fill="currentColor" />
                                <path
                                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                                  fill="currentColor"
                                />
                            </svg>
                        </div>
                        <span>Sistema Escola</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <ul>
                        <li>
                            <Link to="/" className="nav-link">
                            <div className='nav-icon'>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" />
                                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" />
                                </svg>
                            </div>
                            Início
                            </Link>
                        </li>
                        <li>
                        <Link to="/cadastro-de-alunos" className="nav-link">
                            <div className='nav-icon'>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" />
                                    <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                                    <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2" />
                                    <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2" />
                                </svg>
                            </div>
                            Cadastro de Alunos
                        </Link>
                        </li>
                        <li>
                            <Link to="/gerenciar-alunos" className="nav-link">
                                <div className='nav-icon'>
                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" />
                                        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                </div>
                                Gerenciar Alunos
                            </Link>
                        </li>
                        <li>
                            <Link to="/grade-de-horario" className="nav-link">
                                <div className='nav-icon'>
                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" />
                                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" />
                                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                </div>                            
                                Grade de Horário
                            </Link>
                        </li>
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    <button onClick={onLogout} className="logout-btn">
                        <div className='logout-btn-icon'>
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" />
                                <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" />
                                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </div>
                        Sair
                    </button>
                    <button onClick={onToggleDarkMode}>Alternar Modo Escuro</button>
                </div>
            </aside>

            {/* Conteudo Principal */}
            <main className="content">{children}</main>
        </div>
    );
};

export default Layout;