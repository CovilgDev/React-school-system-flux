import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import RegisterStudent from './pages/RegisterStudent';
import './App.css';

function App(){
    return (
        <Router>
            <Layout>
                <Routes>
                    {/* Rotas */}
                    <Route path='/cadastro-de-alunos' element={<RegisterStudent />} />
                    <Route path='/' element={<Home />} />
                </Routes>
            </Layout>
        </Router>
    );
};

export default App;

const Home = () => <div>Bem - vindo Ao Sistema Escola</div>