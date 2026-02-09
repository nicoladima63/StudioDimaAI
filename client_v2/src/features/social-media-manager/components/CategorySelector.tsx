/**
 * CategorySelector Component - MVP Phase 1
 * Select dropdown per scegliere la categoria del post
 */

import React, { useEffect } from 'react';
import { CFormSelect } from '@coreui/react';
import { useSocialMediaStore } from '@/store/socialMedia.store';

interface CategorySelectorProps {
  value?: number | null;
  onChange: (categoryId: number | null) => void;
  disabled?: boolean;
  required?: boolean;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  required = false
}) => {
  const { categories, isLoadingCategories, loadCategories } = useSocialMediaStore();

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue ? Number(selectedValue) : null);
  };

  return (
    <CFormSelect
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoadingCategories}
      required={required}
    >
      <option value="">
        {isLoadingCategories ? 'Caricamento...' : '-- Seleziona Categoria --'}
      </option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </CFormSelect>
  );
};

export default CategorySelector;
