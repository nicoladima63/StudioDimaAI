let setModeWarning: (msg: string | null) => void = () => {};

export function triggerModeWarning(msg: string) {
  setModeWarning(msg);
  setTimeout(() => setModeWarning(null), 5000);
}

export function registerModeWarningSetter(setter: (msg: string | null) => void) {
  setModeWarning = setter;
} 