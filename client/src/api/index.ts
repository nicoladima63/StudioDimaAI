// src/api/index.ts
// Barrel file per esportare tutte le funzioni API

// Client base
export { apiClient } from './client';

// Services
export * from './services/auth.service';
export * from './services/pazienti.service';
export * from './services/recalls.service';
export * from './services/fatture.service';
export * from './services/incassi.service';
export * from './services/calendar.service';
export * from './services/ricette.service';
export * from './services/settings.service';
export * from './services/rentri.service';

// Types
export * from '@/lib/types';