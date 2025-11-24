import React, {useState}from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

// CoreUI components
import {
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CButton,
  CFormFeedback,
  CSpinner,
} from '@coreui/react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

// Store
import { useAuthStore } from '@/store/auth.store'

// Validation schema
const loginSchema = z.object({
  username: z.string().min(1, 'Username è richiesto').min(3, 'Username deve essere almeno 3 caratteri'),
  password: z.string().min(1, 'Password è richiesta').min(6, 'Password deve essere almeno 6 caratteri'),
})

type LoginFormData = z.infer<typeof loginSchema>

const LoginPage: React.FC = () => {
  const location = useLocation()
  const { isAuthenticated, login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/dashboard'
    return <Navigate to={from} replace />
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      await login(data.username, data.password)
      toast.success('Login effettuato con successo!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Errore durante il login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='bg-light min-vh-100 d-flex flex-row align-items-center'>
      <CContainer>
        <CRow className='justify-content-center'>
          <CCol md={8}>
            <CCardGroup>
              <CCard className='p-4'>
                <CCardBody>
                  <CForm onSubmit={handleSubmit(onSubmit)}>
                    <h1>Login</h1>
                    <p className='text-muted'>Accedi al tuo account Studio Dima V2</p>

                    {/* Username field */}
                    <CInputGroup className='mb-3'>
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        type='text'
                        placeholder='Username'
                        autoComplete='username'
                        {...register('username')}
                        invalid={!!errors.username}
                        disabled={isLoading}
                      />
                      {errors.username && (
                        <CFormFeedback invalid>{errors.username.message}</CFormFeedback>
                      )}
                    </CInputGroup>

                    {/* Password field */}
                    <CInputGroup className='mb-4'>
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder='Password'
                        autoComplete='current-password'
                        {...register('password')}
                        invalid={!!errors.password}
                        disabled={isLoading}
                      />
                      <CButton
                        type='button'
                        variant='outline'
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                        style={{ borderLeft: 'none' }}
                      >
                        {showPassword ? '✗' : '✓'}
                      </CButton>
                      {errors.password && (
                        <CFormFeedback invalid>{errors.password.message}</CFormFeedback>
                      )}
                    </CInputGroup>

                    {/* Submit button */}
                    <CRow>
                      <CCol xs={6}>
                        <CButton
                          color='primary'
                          className='px-4'
                          type='submit'
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <CSpinner size='sm' className='me-2' />
                              Accesso...
                            </>
                          ) : (
                            'Accedi'
                          )}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>

              {/* Info card */}
              <CCard className='text-white bg-primary py-5' style={{ width: '44%' }}>
                <CCardBody className='text-center d-flex flex-column justify-content-center'>
                  <div>
                    <h2>Registrati</h2>
                    <p>
                      Non hai un account? Registrati per accedere alle funzionalità
                      dell'applicazione.
                    </p>
                    <Link to='/register'>
                      <CButton color='primary' className='mt-3' active tabIndex={-1}>
                        Registrati ora!
                      </CButton>
                    </Link>
                  </div>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default LoginPage