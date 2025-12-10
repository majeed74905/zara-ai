import { useState, useEffect } from 'react';
import { fileToBase64 } from '../utils/fileUtils';

const STORAGE_KEY_STUDY_MATERIAL = 'zara_study_material';

export const useStudyMaterial = () => {
  const [studyMaterial, setStudyMaterial] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_STUDY_MATERIAL);
    if (stored) setStudyMaterial(stored);
  }, []);

  const updateMaterial = (text: string) => {
    setStudyMaterial(text);
    localStorage.setItem(STORAGE_KEY_STUDY_MATERIAL, text);
  };

  const loadFromFile = async (file: File) => {
    // Simple text handling. For PDF/Images, we might need OCR or Gemini Vision extraction
    // Here we handle plain text files directly.
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const text = await file.text();
      updateMaterial(text);
    } else {
       // For simplified usage in this specific hook, we throw if not text.
       // In a full implementation, we'd send the file to Gemini to "extract text" first.
       throw new Error("Currently only text files (.txt, .md) are supported for direct context loading. For PDFs, upload them as attachments in the main chat.");
    }
  };

  const clearMaterial = () => {
    setStudyMaterial('');
    localStorage.removeItem(STORAGE_KEY_STUDY_MATERIAL);
  };

  return {
    studyMaterial,
    updateMaterial,
    loadFromFile,
    clearMaterial
  };
};