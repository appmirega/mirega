import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface QuotationSettingsData {
  id: string;
  validity_days: number;
  alert_new_quotation: boolean;
  alert_quotation_completed: boolean;
  alert_urgent_quotation_active: boolean;
  alert_urgent_quotation_days: number;
  alert_expiring_quotation: boolean;
}

export function QuotationSettings() {
  const [settings, setSettings] = useState<QuotationSettingsData>({
    id: '',
    validity_days: 30,
    alert_new_quotation: true,
    alert_quotation_completed: true,
    alert_urgent_quotation_active: true,
    alert_urgent_quotation_days: 2,
    alert_expiring_quotation: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('quotation_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('quotation_settings')
        .update({
          validity_days: settings.validity_days,
          alert_new_quotation: settings.alert_new_quotation,
          alert_quotation_completed: settings.alert_quotation_completed,
          alert_urgent_quotation_active: settings.alert_urgent_quotation_active,
          alert_urgent_quotation_days: settings.alert_urgent_quotation_days,
          alert_expiring_quotation: settings.alert_expiring_quotation,
        })
        .eq('id', settings.id);

      if (error) throw error;

      showMessage('success', 'Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('error', 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">
          Configuración de Cotizaciones
        </h2>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Vigencia de Cotizaciones */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Vigencia de Cotizaciones
          </h3>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días de vigencia
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.validity_days}
              onChange={(e) =>
                setSettings({ ...settings, validity_days: parseInt(e.target.value) || 30 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500">
              Todas las cotizaciones tendrán esta vigencia por defecto
            </p>
          </div>
        </div>

        {/* Alertas */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Configuración de Alertas
          </h3>

          <div className="space-y-4">
            {/* Alerta por nueva cotización */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="alert_new"
                  type="checkbox"
                  checked={settings.alert_new_quotation}
                  onChange={(e) =>
                    setSettings({ ...settings, alert_new_quotation: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="alert_new" className="font-medium text-gray-900">
                  Alerta por nueva cotización
                </label>
                <p className="text-sm text-gray-500">
                  Notificar al cliente cuando se crea una nueva cotización
                </p>
              </div>
            </div>

            {/* Alerta por cotización finalizada */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="alert_completed"
                  type="checkbox"
                  checked={settings.alert_quotation_completed}
                  onChange={(e) =>
                    setSettings({ ...settings, alert_quotation_completed: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="alert_completed" className="font-medium text-gray-900">
                  Alerta por cotización finalizada
                </label>
                <p className="text-sm text-gray-500">
                  Notificar al creador cuando una cotización se completa
                </p>
              </div>
            </div>

            {/* Alerta por cotización urgente */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="alert_urgent"
                  type="checkbox"
                  checked={settings.alert_urgent_quotation_active}
                  onChange={(e) =>
                    setSettings({ ...settings, alert_urgent_quotation_active: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 flex-1">
                <label htmlFor="alert_urgent" className="font-medium text-gray-900">
                  Alerta por cotización de criterio urgente
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Enviar recordatorios periódicos para cotizaciones urgentes pendientes
                </p>

                {settings.alert_urgent_quotation_active && (
                  <div className="max-w-xs mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repetir cada (días)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.alert_urgent_quotation_days}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          alert_urgent_quotation_days: parseInt(e.target.value) || 2,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      La alerta se repetirá cada {settings.alert_urgent_quotation_days} día(s) hasta que el
                      cliente apruebe la cotización
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Alerta por vigencia de cotización */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="alert_expiring"
                  type="checkbox"
                  checked={settings.alert_expiring_quotation}
                  onChange={(e) =>
                    setSettings({ ...settings, alert_expiring_quotation: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="alert_expiring" className="font-medium text-gray-900">
                  Alerta por vigencia de cotización
                </label>
                <p className="text-sm text-gray-500">
                  Notificar cuando una cotización esté a 7 días de vencer y cuando ya esté vencida
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
