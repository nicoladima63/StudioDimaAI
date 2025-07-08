// src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CContainer,
  CForm,
  CFormInput,
  CButton,
  CAlert,
  CCard,
  CCardBody,
  CCardHeader
} from '@coreui/react'
import { login } from '@/api/apiClient'
import { AxiosError } from 'axios'

const Login: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login({ username, password })
      navigate('/')
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || 'Errore nel login')
      } else {
        setError('Si è verificato un errore inatteso')
      }
    }
  }

  return (
    <CContainer className="d-flex justify-content-center align-items-center vh-100">
      <CCard className="w-100" style={{ maxWidth: '400px' }}>
        <CCardHeader>
          <h4>Login</h4>
        </CCardHeader>
        <CCardBody>
          <CForm onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <CFormInput
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); }}
              required
              label="Username"
            />
            <CFormInput
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {setPassword(e.target.value);}}
              required
              label="Password"
            />
            {error && <CAlert color="danger">{error}</CAlert>}
            <CButton type="submit" color="primary">
              Accedi
            </CButton>
            <div className="text-center">
              Non hai un account? <Link to="/register">Registrati qui</Link>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}

export default Login
