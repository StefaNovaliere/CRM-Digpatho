// src/hooks/useAppSettings.js
//
// Lee y escribe la tabla app_settings (migración 010). Antes esta
// configuración vivía hardcodeada en constants.js y en Dashboard.jsx, o
// directamente en estados de React que no persistían: el handleSave de
// Settings.jsx era un setTimeout.
//
// Si la tabla todavía no existe (migración sin correr), cae a los valores por
// defecto de constants.js en vez de romper la pantalla.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { DEFAULT_DAILY_GOALS, APP_CONFIG } from '../config/constants';

const FALLBACK = {
  daily_goals: DEFAULT_DAILY_GOALS,
  followup_days: APP_CONFIG?.followUpDays ?? 14,
  stalled_days: 30,
};

export const useAppSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // true cuando la 010 no se corrió: la UI lo avisa en vez de fingir que guarda
  const [tableMissing, setTableMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('app_settings')
      .select('key, value');

    if (err) {
      // 42P01 = undefined_table. Cualquier otro error sí es un problema real.
      if (err.code === '42P01') {
        setTableMissing(true);
      } else {
        console.error('Error leyendo app_settings:', err);
        setError('No se pudo leer la configuración.');
      }
      setSettings(FALLBACK);
      setLoading(false);
      return;
    }

    const desdeDb = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    setSettings({ ...FALLBACK, ...desdeDb });
    setTableMissing(false);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Guarda una clave. Devuelve true si se persistió. */
  const saveSetting = useCallback(async (key, value) => {
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('app_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: user?.id || null },
        { onConflict: 'key' }
      );

    setSaving(false);

    if (err) {
      console.error(`Error guardando ${key}:`, err);
      setError(
        err.code === '42P01'
          ? 'Falta correr la migración 010 en Supabase.'
          : 'No se pudo guardar la configuración.'
      );
      return false;
    }

    setSettings(prev => ({ ...prev, [key]: value }));
    return true;
  }, [user?.id]);

  return { settings, loading, saving, error, tableMissing, saveSetting, reload: load };
};

export default useAppSettings;
