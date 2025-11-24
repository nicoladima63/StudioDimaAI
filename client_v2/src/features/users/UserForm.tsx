import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/store/user.store';
import { toast } from 'react-hot-toast';
import type { User } from '@/types';
import { CButton, CCol, CForm, CFormInput, CFormLabel, CRow } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave, cilActionUndo } from '@coreui/icons';
import SlimSelect from 'slim-select';
import 'slim-select/styles';

interface UserFormProps {
  userToEdit: User | null;
  onClose: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ userToEdit, onClose }) => {
  const { loading, error, createUser, updateUser } = useUserStore();

  const isEditing = !!userToEdit;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'segreteria'>('user');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isEditing && userToEdit) {
      setUsername(userToEdit.username);
      setRole(userToEdit.role);
      setPassword('');
      setConfirmPassword('');
    } else {
      setUsername('');
      setPassword('');
      setRole('user');
      setConfirmPassword('');
    }
  }, [isEditing, userToEdit]);

  useEffect(() => {
    const slim = new SlimSelect({
      select: '#role',
    });
  
    return () => {
      slim.destroy();
    };
  }, []);
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Le password non corrispondono.');
      return;
    }

    if (!isEditing && !password) {
      toast.error('La password è obbligatoria per i nuovi utenti.');
      return;
    }

    let success = false;
    if (isEditing && userToEdit) {
      const payload: {
        username?: string;
        password?: string;
        role?: 'admin' | 'user' | 'segreteria';
      } = { role };
      if (username !== userToEdit.username) {
        payload.username = username;
      }
      if (password) {
        payload.password = password;
      }

      const updated = await updateUser(userToEdit.id, payload);
      if (updated) {
        toast.success('Utente aggiornato con successo!');
        success = true;
      } else {
        toast.error(error || "Errore durante l'aggiornamento dell'utente.");
      }
    } else {
      const newUser = await createUser(username, password, role);
      if (newUser) {
        toast.success('Utente creato con successo!');
        success = true;
      } else {
        toast.error(error || "Errore durante la creazione dell'utente.");
      }
    }

    if (success) {
      onClose();
    }
  };

  return (
    <CForm>
      <CRow>
        <CCol xs>
          <CFormLabel htmlFor='username'>Username</CFormLabel>
          <CFormInput
            placeholder='username'
            aria-label='Last name'
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            disabled={loading === 'loading'}
          />
        </CCol>
      </CRow>

      <CRow>
        <CCol xs>
          <CFormLabel htmlFor='Password'>
            Password:{' '}
            {isEditing && (
              <span className='text-gray-500 text-xs'>(Lascia vuoto per non cambiare)</span>
            )}
          </CFormLabel>

          <CFormInput
            placeholder='la tua password'
            aria-label='First name'
            value={password}
            onChange={e => setPassword(e.target.value)}
            required={!isEditing}
            disabled={loading === 'loading'}
          />
        </CCol>
        <CCol xs>
          <CFormLabel htmlFor='username'>Conferma Password</CFormLabel>

          <CFormInput
            placeholder='conferma la password'
            aria-label='Last name'
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required={!isEditing || (isEditing && password.length > 0)}
            disabled={loading === 'loading'}
          />
        </CCol>
      </CRow>
      <CRow>
        <CCol xs>
          <div className='mb-6'>
            <label htmlFor='role' className='block text-gray-700 text-sm font-bold mb-2'>
              Seleziona un ruolo:
            </label>
            <select
              id='role'
              className='shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'user' | 'segreteria')}
              required
              disabled={loading === 'loading'}
            >
              <option value='user'>Utente</option>
              <option value='admin'>Amministratore</option>
              <option value='segreteria'>Segreteria</option>
            </select>
          </div>
        </CCol>
      </CRow>
      <CRow>
        <CCol xs={12} className='text-center pt-4 flex-end'>
          <CButton
            color='secondary'
            variant='outline'
            size='sm'
            onClick={onClose}
            className='bg-gray-500 hover:bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline'
            disabled={loading === 'loading'}
          >
            <CIcon icon={cilActionUndo} size='sm' /> Annulla
          </CButton>
          <CButton
            type='submit'
            color='primary'
            variant='outline'
            size='sm'
            onClick={handleSubmit}
            className='bg-blue-500 hover:bg-blue-700 text-blue font-bold py-2 px-4 rounded'
          >
            <CIcon icon={cilSave} size='sm' />
            {loading === 'loading'
              ? 'Salvataggio...'
              : isEditing
                ? 'Aggiorna Utente'
                : 'Crea Utente'}
          </CButton>
        </CCol>
      </CRow>
    </CForm>
  );
};

export default UserForm;
