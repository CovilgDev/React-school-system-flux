import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import Login from "./components/Login"
import RegisterStudent from './pages/RegisterStudent';
import ManageStudents from './pages/ManageStudents';
import Schedule from './pages/Schedule';
import './App.css';


function App(){
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const handleLogin = (success) => {
    setIsAuthenticated(success)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
      <Router>
          <Layout>
              <Routes>
                  {/* Rotas */}
                  <Route path='/' element={<Home />} />
                  <Route path='/cadastro-de-alunos' element={<RegisterStudent />} />
                  <Route path='/gerenciar-alunos' element={<ManageStudents />} />
                  <Route path="/grade-de-horario" element={<Schedule />} />
              </Routes>
          </Layout>
      </Router>
  );
};

export default App;

const Home = () => (
  <div className="home-container fade-in">
    <div className="welcome-header">
      <h1>Bem-vindo ao Sistema Escola</h1>
      <p>Gerencie alunos, horários e informações de forma moderna e eficiente</p>
    </div>

    <div className="stats-grid">
      <div className="stat-card card slide-in">
        <div className="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="var(--primary-hover)" strokeWidth="2" />
            <circle cx="12" cy="7" r="4" stroke="var(--primary-hover)" strokeWidth="2" />
          </svg>
        </div>
        <div className="stat-content">
          <h3>Alunos</h3>
          <p className="stat-number">1,234</p>
          <p className="stat-label">Cadastrados</p>
        </div>
      </div>

      <div className="stat-card card slide-in" style={{ animationDelay: "0.1s" }}>
        <div className="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="var(--primary-hover)" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="var(--primary-hover)" strokeWidth="2" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="var(--primary-hover)" strokeWidth="2" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="var(--primary-hover)" strokeWidth="2" />
          </svg>
        </div>
        <div className="stat-content">
          <h3>Horários</h3>
          <p className="stat-number">45</p>
          <p className="stat-label">Agendados</p>
        </div>
      </div>

      <div className="stat-card card slide-in" style={{ animationDelay: "0.2s" }}>
        <div className="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke="var(--primary-hover)"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="stat-content">
          <h3>Avaliações</h3>
          <p className="stat-number">98%</p>
          <p className="stat-label">Satisfação</p>
        </div>
      </div>
    </div>
  </div>
)