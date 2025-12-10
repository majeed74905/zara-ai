
import { useEffect } from 'react';
import { ViewMode } from '../types';
import { ThemeName } from '../theme/types';
import { MODE_THEME_MAPPING } from '../constants/appConstants';

export const useModeThemeSync = (
  currentView: ViewMode, 
  isEnabled: boolean, 
  setTheme: (t: ThemeName) => void
) => {
  useEffect(() => {
    if (!isEnabled) return;
    
    const targetTheme = MODE_THEME_MAPPING[currentView];
    if (targetTheme) {
      setTheme(targetTheme);
    }
  }, [currentView, isEnabled, setTheme]);
};
