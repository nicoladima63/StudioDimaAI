// src/App.tsx
import AppRouter from "./router/AppRouter"
import { CToaster, CToast, CToastBody } from '@coreui/react';
import { useState, useEffect } from 'react';
import { registerModeWarningSetter } from './utils/modeWarning';

export default function App() {
  const [modeWarning, setModeWarning] = useState<string | null>(null);
  useEffect(() => {
    registerModeWarningSetter(setModeWarning);
  }, []);

  return <>
    <AppRouter />
    <CToaster placement="top-end">
      {modeWarning && (
        <CToast autohide visible color="warning" key="mode-warning">
          <CToastBody>{modeWarning}</CToastBody>
        </CToast>
      )}
    </CToaster>
  </>;
}
