// src/pages/Register.tsx
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
import { register } from '@/api/apiClient'

const Register: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await register({ username, password })
      navigate('/login')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nella registrazione')
    }
  }

  return (
    <CContainer className="d-flex justify-content-center align-items-center vh-100">
      <CCard className="w-100" style={{ maxWidth: '400px' }}>
        <CCardHeader>
          <h4>Registrazione</h4>
        </CCardHeader>
        <CCardBody>
          <CForm onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <CFormInput
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              label="Username"
            />
            <CFormInput
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              label="Password"
            />
            {error && <CAlert color="danger">{error}</CAlert>}
            <CButton type="submit" color="primary">
              Registrati
            </CButton>
            <div className="text-center">
              Hai già un account? <Link to="/login">Accedi qui</Link>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}

export default Register