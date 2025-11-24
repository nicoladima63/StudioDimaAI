import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/store/user.store';
import { useAuthStore } from '@/store/auth.store';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import PageLayout from '@/components/layout/PageLayout';
import UserForm from './UserForm'; // Importa il form refattorizzato
import DataTable, { DataTableColumn } from '@/components/tables/DataTable';
import type { User } from '@/types';
import { CButton, CModal, CModalHeader, CModalTitle, CModalBody } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash } from '@coreui/icons';

const UserListPage: React.FC = () => {
  const { users, loading, error, loadUsers, deleteUser } = useUserStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const columns: DataTableColumn<User>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      width: '15%',
      defaultVisible: true,
      order: 1,
    },
    {
      key: 'username',
      label: 'UserName',
      sortable: true,
      width: '15%',
      defaultVisible: true,
      order: 2,
    },
    {
      key: 'role',
      label: 'Ruolo',
      sortable: true,
      width: '15%',
      defaultVisible: true,
      order: 3,
    },
    {
      key: 'created_at',
      label: 'created_at',
      sortable: false,
      width: '15%',
      defaultVisible: true,
      order: 4,
    },
    {
      key: 'id',
      label: 'Azioni',
      sortable: false,
      width: '15%',
      defaultVisible: true,
      order: 5,
      render: (value, user) => (
        <div className='d-flex gap-1 justify-content-end'>
          <CButton
            color='primary'
            variant='outline'
            size='sm'
            onClick={() => handleOpenEditModal(user)}
            title='Visualizza utente'
            className='action-btn'
          >
            <CIcon icon={cilPencil} size='sm' />
          </CButton>
          <CButton
            color='danger'
            variant='outline'
            size='sm'
            onClick={() => handleDelete(user.id)}
            title='Visualizza utente'
            className='action-btn'
          >
            <CIcon icon={cilTrash} size='sm' />
          </CButton>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      toast.error('Accesso negato. Solo gli amministratori possono gestire gli utenti.');
      navigate('/');
      return;
    }
    loadUsers();
  }, [loadUsers, currentUser, navigate]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = async (userId: number) => {
    if (window.confirm('Sei sicuro di voler eliminare questo utente?')) {
      const success = await deleteUser(userId);
      if (success) {
        toast.success('Utente eliminato con successo!');
      } else {
        toast.error(error || "Errore durante l'eliminazione dell'utente.");
      }
    }
  };

  return (
    <>
      <PageLayout>
        <PageLayout.Header
          title='Gestione Utenti'
          headerAction={
            <CButton color='primary' onClick={handleOpenCreateModal}>
              Crea Nuovo Utente
            </CButton>
          }
        />
        <PageLayout.ContentBody>
          <DataTable
            data={users}
            columns={columns}
            //loading={loading}
            error={error}
            searchable={true}
            searchPlaceholder='Cerca per username'
            //pageSize={20}
            //pageSizeOptions={[10, 20, 50, 100]}
            //className='pazienti-table'
            //tableId='pazienti-table'
            //autoDetectColumns={true}
          />
        </PageLayout.ContentBody>
      </PageLayout>

      <CModal visible={isModalOpen} onClose={handleCloseModal} size='lg'>
        <CModalHeader onClose={handleCloseModal}>
          <CModalTitle>{editingUser ? 'Modifica Utente' : 'Crea Nuovo Utente'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <UserForm userToEdit={editingUser} onClose={handleCloseModal} />
        </CModalBody>
      </CModal>
    </>
  );
};

export default UserListPage;
