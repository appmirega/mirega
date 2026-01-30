import React, { useState, useEffect } from 'react';
import { Upload, FileText, Calendar, Hash, AlertTriangle, Building2, X, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Client {
  id: string;
  name: string;
  company_name: string;
}

interface Elevator {
  id: string;
  internal_code: string;
  location: string;
}

interface ExternalQuotationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExternalQuotationForm({ onSuccess, onCancel }: ExternalQuotationFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validityDays, setValidityDays] = useState(30);
  const [formData, setFormData] = useState({
    client_id: '',
    quotation_number: '',
    quotation_date: new Date().toISOString().split('T')[0],
    elevator_ids: [] as string[],
    urgency: 'scheduled',
    description: '',
  });

  useEffect(() => {
    loadClients();
    loadValidityDays();
  }, []);

  useEffect(() => {
    if (formData.client_id) {
      loadClientElevators(formData.client_id);
    } else {
      setElevators([]);
    }
  }, [formData.client_id]);

  const loadValidityDays = async () => {
    try {
      const { data } = await supabase
        .from('quotation_settings')
        .select('validity_days')
        .limit(1)
        .maybeSingle();

      if (data) {
        setValidityDays(data.validity_days);
      }
    } catch (error) {
      console.error('Error loading validity days:', error);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company_name')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadClientElevators = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select('id, internal_code, location')
        .eq('client_id', clientId)
        .order('internal_code');

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        alert('Solo se permiten archivos PDF');
      }
    }
  };

  const toggleElevator = (elevatorId: string) => {
    setFormData((prev) => ({
      ...prev,
      elevator_ids: prev.elevator_ids.includes(elevatorId)
        ? prev.elevator_ids.filter((id) => id !== elevatorId)
        : [...prev.elevator_ids, elevatorId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      alert('Debe seleccionar un archivo PDF');
      return;
    }

    if (!formData.client_id) {
      alert('Debe seleccionar un cliente');
      return;
    }

    if (formData.elevator_ids.length === 0) {
      alert('Debe seleccionar al menos un ascensor');
      return;
    }

    setLoading(true);

    try {
      const fileExt = 'pdf';
      const fileName = `${Date.now()}_${formData.quotation_number.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
      const filePath = `${formData.client_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quotation-pdfs')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('quotation-pdfs')
        .getPublicUrl(filePath);

      const expiryDate = new Date(formData.quotation_date);
      expiryDate.setDate(expiryDate.getDate() + validityDays);

      const { error: insertError } = await supabase
        .from('quotations')
        .insert({
          quotation_number: formData.quotation_number,
          client_id: formData.client_id,
          elevator_ids: formData.elevator_ids,
          quotation_date: formData.quotation_date,
          expiry_date: expiryDate.toISOString().split('T')[0],
          urgency: formData.urgency,
          type: 'external',
          pdf_url: publicUrl,
          description: formData.description,
          created_by: user?.id,
          status: 'pending',
        });

      if (insertError) throw insertError;

      alert('Cotización creada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error creating quotation:', error);
      alert('Error al crear la cotización');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Upload className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Subir Cotización Externa
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cliente *
          </label>
          <select
            value={formData.client_id}
            onChange={(e) =>
              setFormData({ ...formData, client_id: e.target.value, elevator_ids: [] })
            }
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company_name || client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Número de cotización */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Hash className="h-4 w-4" />
              Número de Cotización *
            </label>
            <input
              type="text"
              value={formData.quotation_number}
              onChange={(e) =>
                setFormData({ ...formData, quotation_number: e.target.value })
              }
              required
              placeholder="Ej: COT-2024-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4" />
              Fecha de Cotización *
            </label>
            <input
              type="date"
              value={formData.quotation_date}
              onChange={(e) =>
                setFormData({ ...formData, quotation_date: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Ascensores */}
        {formData.client_id && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="h-4 w-4" />
              Ascensores *
            </label>
            {elevators.length > 0 ? (
              <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                {elevators.map((elevator) => (
                  <label
                    key={elevator.id}
                    className="flex items-center gap-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.elevator_ids.includes(elevator.id)}
                      onChange={() => toggleElevator(elevator.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {elevator.internal_code} - {elevator.location}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No hay ascensores registrados para este cliente
              </p>
            )}
          </div>
        )}

        {/* Urgencia */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Nivel de Urgencia *
          </label>
          <select
            value={formData.urgency}
            onChange={(e) =>
              setFormData({ ...formData, urgency: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="scheduled">Programable</option>
            <option value="priority">Prioritaria</option>
            <option value="urgent">Urgente</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {formData.urgency === 'urgent' &&
              'Se enviarán recordatorios periódicos hasta su aprobación'}
            {formData.urgency === 'priority' &&
              'Aparecerá destacada en la lista de cotizaciones'}
            {formData.urgency === 'scheduled' &&
              'Cotización estándar sin recordatorios adicionales'}
          </p>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
            placeholder="Descripción breve de la cotización..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Archivo PDF */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4" />
            Archivo PDF *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              {selectedFile ? (
                <>
                  <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Click para seleccionar archivo
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PDF hasta 10MB</p>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Info de vigencia */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Vigencia:</strong> La cotización será válida por {validityDays} días (hasta{' '}
            {new Date(
              new Date(formData.quotation_date).getTime() + validityDays * 24 * 60 * 60 * 1000
            ).toLocaleDateString('es-CL')}
            )
          </p>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Crear Cotización
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
