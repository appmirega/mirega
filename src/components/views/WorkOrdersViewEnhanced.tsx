import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, FileText, Clock, CheckCircle, X, AlertCircle, DollarSign, Calendar, Package, Users, Download } from 'lucide-react';

interface WorkOrder {
  id: string;
  building_id: string;
  service_request_id?: string;
  folio_number?: string;
  created_at: string;
  work_type: string;
  description: string;
  status: string;
  assigned_technician_id?: string;
  priority: string;
  scheduled_date?: string;
  completed_at?: string;
  notes?: string;
  // Nuevos campos
  is_internal: boolean;
  has_client_cost: boolean;
  requires_client_approval: boolean;
  external_quotation_number?: string;
  external_quotation_pdf_url?: string;
  quotation_amount?: number;
  quotation_description?: string;
  involves_foreign_parts: boolean;
  foreign_parts_supplier?: string;
  foreign_parts_lead_time?: string;
  estimated_execution_days?: number;
  requires_advance_payment: boolean;
  advance_percentage?: number;
  advance_amount?: number;
  approval_deadline?: string;
  work_warranty_months?: number;
  work_warranty_description?: string;
  parts_warranty_months?: number;
  parts_warranty_description?: string;
  client_approved_at?: string;
  client_rejected_at?: string;
  // Personal externo
  uses_external_personnel: boolean;
  external_personnel_ids?: string[];
  mixed_personnel: boolean;
  buildings?: {
    name: string;
    clients?: {
      business_name: string;
    };
  };
  profiles?: {
    full_name: string;
  };
}

interface ExternalProvider {
  id: string;
  name: string;
  provider_type: 'company' | 'individual' | 'specialist';
  service_category?: string;
  elevator_brand_specialty?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
}

type ViewMode = 'list' | 'create';
type OrderType = 'internal' | 'quotation' | null;

export function WorkOrdersViewEnhanced() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState('basic');
  const [orderType, setOrderType] = useState<OrderType>(null);
  
  const [formData, setFormData] = useState({
    // Básico
    building_id: '',
    service_request_id: '',
    work_type: 'maintenance',
    description: '',
    priority: 'medium',
    notes: '',
    // Designación (solo si es orden interna O después de aprobación)
    assigned_technician_id: '',
    scheduled_date: '',
    uses_external_personnel: false,
    external_personnel_ids: [] as string[],
    mixed_personnel: false,
    // Costo y cotización (solo si es con cotización)
    has_client_cost: false,
    requires_client_approval: false,
    approval_deadline: '',
    external_quotation_number: '',
    external_quotation_pdf_url: '',
    quotation_amount: '',
    quotation_description: '',
    // Repuestos
    involves_foreign_parts: false,
    foreign_parts_supplier: '',
    foreign_parts_lead_time: '',
    estimated_execution_days: '',
    // Adelantos
    requires_advance_payment: false,
    advance_percentage: '',
    // Garantías
    work_warranty_months: '',
    work_warranty_description: '',
    parts_warranty_months: '',
    parts_warranty_description: '',
  });

  const [buildings, setBuildings] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [externalProviders, setExternalProviders] = useState<ExternalProvider[]>([]);
  const [showNewProviderForm, setShowNewProviderForm] = useState(false);
  const [newProviderData, setNewProviderData] = useState({
    name: '',
    email: '',
    phone: '',
    provider_type: 'individual' as const,
    service_category: '',
  });
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWorkOrders();
    loadBuildings();
    loadTechnicians();
    loadExternalProviders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          buildings (
            name,
            clients (
              business_name
            )
          ),
          profiles (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('id, name, clients(business_name)')
        .order('name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Error loading buildings:', error);
    }
  };

  const loadServiceRequests = async (buildingId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, description, request_type')
        .eq('building_id', buildingId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServiceRequests(data || []);
    } catch (error) {
      console.error('Error loading service requests:', error);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'technician')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const loadExternalProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('external_service_providers')
        .select('id, name, provider_type, service_category, elevator_brand_specialty, phone, email, contact_person')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setExternalProviders(data || []);
    } catch (error) {
      console.error('Error loading external providers:', error);
    }
  };

  const uploadQuotationPdf = async (): Promise<string | null> => {
    if (!quotationFile) return null;

    const fileExt = quotationFile.name.split('.').pop();
    const fileName = `quotation-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `pdf/${fileName}`;

    const { data, error } = await supabase.storage
      .from('work-order-quotations')
      .upload(filePath, quotationFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('work-order-quotations')
      .getPublicUrl(data?.path || filePath);

    return publicUrlData?.publicUrl || null;
  };

  const handleAddExternalProvider = async () => {
    if (!newProviderData.name) {
      alert('Por favor ingresa el nombre del prestador');
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('create_external_provider', {
          p_name: newProviderData.name,
          p_email: newProviderData.email,
          p_phone: newProviderData.phone,
          p_provider_type: newProviderData.provider_type,
          p_service_category: newProviderData.service_category,
        });

      if (error) throw error;

      // Agregar a la lista de providers
      const newProvider: ExternalProvider = {
        id: data.provider_id,
        name: newProviderData.name,
        provider_type: newProviderData.provider_type,
        service_category: newProviderData.service_category,
        phone: newProviderData.phone,
        email: newProviderData.email,
      };

      setExternalProviders([...externalProviders, newProvider]);
      setFormData({
        ...formData,
        external_personnel_ids: [...formData.external_personnel_ids, newProvider.id],
      });

      // Reset form
      setNewProviderData({
        name: '',
        email: '',
        phone: '',
        provider_type: 'individual',
        service_category: '',
      });
      setShowNewProviderForm(false);

      alert('✅ Prestador creado exitosamente');
    } catch (error: any) {
      console.error('Error creating provider:', error);
      alert('Error al crear prestador: ' + error.message);
    }
  };

  const handleToggleExternalProvider = (providerId: string) => {
    const updated = formData.external_personnel_ids.includes(providerId)
      ? formData.external_personnel_ids.filter((id) => id !== providerId)
      : [...formData.external_personnel_ids, providerId];

    setFormData({
      ...formData,
      external_personnel_ids: updated,
    });
  };

  const handleAdvancePercentageChange = (value: string) => {
    const percentage = value ? parseFloat(value) : 0;
    const quotationAmount = formData.quotation_amount ? parseFloat(formData.quotation_amount) : 0;
    const advanceAmount = (quotationAmount * percentage) / 100;

    setFormData({
      ...formData,
      advance_percentage: value,
      advance_amount: advanceAmount > 0 ? advanceAmount.toString() : '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.building_id) {
      alert('Por favor selecciona un edificio');
      return;
    }

    if (!formData.description) {
      alert('Por favor ingresa una descripción');
      return;
    }

    if (!orderType) {
      alert('Por favor selecciona el tipo de orden (Interna o Con Cotización)');
      return;
    }

    setSubmitting(true);

    try {
      // Validaciones específicas por tipo
      if (orderType === 'quotation') {
        if (!formData.has_client_cost) {
          alert('Para órdenes con cotización, debes marcar que tiene costo al cliente');
          return;
        }
        if (formData.requires_client_approval && !formData.approval_deadline) {
          alert('Por favor ingresa una fecha límite de aprobación');
          return;
        }
      }

      let quotationPdfUrl: string | null = formData.external_quotation_pdf_url || null;

      if (orderType === 'quotation' && quotationFile) {
        const uploadedUrl = await uploadQuotationPdf();
        if (uploadedUrl) {
          quotationPdfUrl = uploadedUrl;
        }
      }

      if (orderType === 'internal') {
        // Para órdenes internas, la designación es opcional pero si se pone, la fecha también debe existir
        if ((formData.assigned_technician_id && !formData.scheduled_date) ||
            (!formData.assigned_technician_id && formData.scheduled_date)) {
          alert('Para asignar técnico, también debes establecer una fecha programada (o viceversa)');
          return;
        }
      }

      const insertData = {
        building_id: formData.building_id,
        service_request_id: formData.service_request_id || null,
        work_type: formData.work_type,
        description: formData.description,
        priority: formData.priority,
        notes: formData.notes || null,
        status: 'pending',
        is_internal: orderType === 'internal',
        // Para órdenes internas: asignar inmediatamente
        // Para órdenes con cotización: asignar después de aprobación
        assigned_technician_id: orderType === 'internal' ? (formData.assigned_technician_id || null) : null,
        scheduled_date: orderType === 'internal' ? (formData.scheduled_date || null) : null,
        // Personal externo
        uses_external_personnel: formData.uses_external_personnel,
        external_personnel_ids: formData.uses_external_personnel ? formData.external_personnel_ids : [],
        mixed_personnel: formData.mixed_personnel,
        // Cotización (solo si es con cotización)
        has_client_cost: orderType === 'quotation' ? formData.has_client_cost : false,
        requires_client_approval: orderType === 'quotation' ? formData.requires_client_approval : false,
        approval_deadline: orderType === 'quotation' ? (formData.approval_deadline || null) : null,
        external_quotation_number: orderType === 'quotation' ? (formData.external_quotation_number || null) : null,
        external_quotation_pdf_url: orderType === 'quotation' ? quotationPdfUrl : null,
        quotation_amount: orderType === 'quotation' ? (formData.quotation_amount ? parseFloat(formData.quotation_amount) : null) : null,
        quotation_description: orderType === 'quotation' ? (formData.quotation_description || null) : null,
        // Repuestos
        involves_foreign_parts: orderType === 'quotation' ? formData.involves_foreign_parts : false,
        foreign_parts_supplier: orderType === 'quotation' ? (formData.foreign_parts_supplier || null) : null,
        foreign_parts_lead_time: orderType === 'quotation' ? (formData.foreign_parts_lead_time || null) : null,
        estimated_execution_days: orderType === 'quotation' ? (formData.estimated_execution_days ? parseInt(formData.estimated_execution_days) : null) : null,
        // Adelantos
        requires_advance_payment: orderType === 'quotation' ? formData.requires_advance_payment : false,
        advance_percentage: orderType === 'quotation' ? (formData.advance_percentage ? parseFloat(formData.advance_percentage) : null) : null,
        advance_amount: orderType === 'quotation' ? (formData.advance_amount ? parseFloat(formData.advance_amount) : null) : null,
        // Garantías
        work_warranty_months: orderType === 'quotation' ? (formData.work_warranty_months ? parseInt(formData.work_warranty_months) : null) : null,
        work_warranty_description: orderType === 'quotation' ? (formData.work_warranty_description || null) : null,
        parts_warranty_months: orderType === 'quotation' ? (formData.parts_warranty_months ? parseInt(formData.parts_warranty_months) : null) : null,
        parts_warranty_description: orderType === 'quotation' ? (formData.parts_warranty_description || null) : null,
      };

      const { error } = await supabase.from('work_orders').insert([insertData]);

      if (error) throw error;

      alert(`✅ Orden de trabajo ${orderType === 'internal' ? 'interna' : 'con cotización'} creada exitosamente`);
      resetForm();
      setViewMode('list');
      loadWorkOrders();
    } catch (error: any) {
      console.error('Error creating work order:', error);
      alert('Error al crear orden de trabajo: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      service_request_id: '',
      work_type: 'maintenance',
      description: '',
      priority: 'medium',
      notes: '',
      assigned_technician_id: '',
      scheduled_date: '',
      uses_external_personnel: false,
      external_personnel_ids: [],
      mixed_personnel: false,
      has_client_cost: false,
      requires_client_approval: false,
      approval_deadline: '',
      external_quotation_number: '',
      external_quotation_pdf_url: '',
      quotation_amount: '',
      quotation_description: '',
      involves_foreign_parts: false,
      foreign_parts_supplier: '',
      foreign_parts_lead_time: '',
      estimated_execution_days: '',
      requires_advance_payment: false,
      advance_percentage: '',
      work_warranty_months: '',
      work_warranty_description: '',
      parts_warranty_months: '',
      parts_warranty_description: '',
    });
    setQuotationFile(null);
    setOrderType(null);
    setActiveTab('basic');
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending_approval: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      low: 'bg-slate-100 text-slate-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return badges[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (viewMode === 'create') {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Crear Orden de Trabajo
          </h1>
          <button
            onClick={() => {
              resetForm();
              setViewMode('list');
            }}
            className="p-2 hover:bg-slate-200 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* TAB: BÁSICO */}
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 border-b pb-3">
              Información Básica
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Edificio *
                </label>
                <select
                  required
                  value={formData.building_id}
                  onChange={(e) => {
                    setFormData({ ...formData, building_id: e.target.value });
                    loadServiceRequests(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona un edificio</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Solicitud de Servicio (Opcional)
                </label>
                <select
                  value={formData.service_request_id}
                  onChange={(e) => setFormData({ ...formData, service_request_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sin relacionar</option>
                  {serviceRequests.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.description.substring(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Trabajo
                </label>
                <select
                  value={formData.work_type}
                  onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="maintenance">Mantenimiento</option>
                  <option value="repair">Reparación</option>
                  <option value="installation">Instalación</option>
                  <option value="inspection">Inspección</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prioridad *
                </label>
                <select
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Descripción *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe el trabajo a realizar..."
              />
            </div>

            {/* SELECTOR DE TIPO DE ORDEN - CRÍTICO */}
            {!orderType && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  ¿Qué tipo de orden deseas crear?
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center p-4 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition">
                    <input
                      type="radio"
                      name="orderType"
                      value="internal"
                      checked={orderType === 'internal'}
                      onChange={() => {
                        setOrderType('internal');
                        setActiveTab('schedule');
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3">
                      <span className="block font-semibold text-slate-900">
                        🔧 Orden Interna
                      </span>
                      <span className="text-sm text-slate-600">
                        Para trabajos sin costo al cliente. Directo a coordinación de técnico y fecha.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-center p-4 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition">
                    <input
                      type="radio"
                      name="orderType"
                      value="quotation"
                      checked={orderType === 'quotation'}
                      onChange={() => {
                        setOrderType('quotation');
                        setActiveTab('approval');
                      }}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="ml-3">
                      <span className="block font-semibold text-slate-900">
                        📊 Orden con Cotización
                      </span>
                      <span className="text-sm text-slate-600">
                        Para trabajos con costo. Requiere aprobación del cliente y coordinación posterior.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {orderType && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Orden {orderType === 'internal' ? 'Interna' : 'con Cotización'} seleccionada
                </span>
                <button
                  type="button"
                  onClick={() => setOrderType(null)}
                  className="ml-auto text-sm text-green-600 hover:text-green-800 underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* TABS CONDICIONALES BASADOS EN TIPO DE ORDEN */}
          {orderType === 'internal' && (
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 border-b pb-3">
                🗓️ Programación (Orden Interna)
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fecha Programada
                  </label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Técnico Responsable
                  </label>
                  <select
                    value={formData.assigned_technician_id}
                    onChange={(e) => setFormData({ ...formData, assigned_technician_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PERSONAL EXTERNO */}
              <div className="border-t-2 border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Equipo de Trabajo
                </h3>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.uses_external_personnel}
                      onChange={(e) => setFormData({ ...formData, uses_external_personnel: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-slate-900">Utilizar personal externo</span>
                  </label>

                  {formData.uses_external_personnel && (
                    <>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.mixed_personnel}
                          onChange={(e) => setFormData({ ...formData, mixed_personnel: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-slate-900">Mezclar con técnico interno</span>
                      </label>

                      <div className="bg-slate-50 rounded-lg p-4">
                        <h4 className="font-semibold text-slate-900 mb-3">
                          Selecciona prestadores externos:
                        </h4>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {externalProviders.map((provider) => (
                            <label key={provider.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded">
                              <input
                                type="checkbox"
                                checked={formData.external_personnel_ids.includes(provider.id)}
                                onChange={() => handleToggleExternalProvider(provider.id)}
                                className="w-4 h-4 rounded border-slate-300"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{provider.name}</p>
                                <p className="text-xs text-slate-600">
                                  {provider.provider_type === 'company' && '🏢 Empresa'}
                                  {provider.provider_type === 'individual' && '👤 Independiente'}
                                  {provider.provider_type === 'specialist' && '⭐ Especialista'} • {provider.service_category}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowNewProviderForm(!showNewProviderForm)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-semibold underline"
                        >
                          + Agregar nuevo prestador
                        </button>

                        {showNewProviderForm && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                            <h5 className="font-semibold text-slate-900">Nuevo Prestador</h5>
                            <input
                              type="text"
                              placeholder="Nombre *"
                              value={newProviderData.name}
                              onChange={(e) => setNewProviderData({ ...newProviderData, name: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <input
                              type="email"
                              placeholder="Email"
                              value={newProviderData.email}
                              onChange={(e) => setNewProviderData({ ...newProviderData, email: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <input
                              type="tel"
                              placeholder="Teléfono"
                              value={newProviderData.phone}
                              onChange={(e) => setNewProviderData({ ...newProviderData, phone: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <select
                              value={newProviderData.provider_type}
                              onChange={(e) => setNewProviderData({ ...newProviderData, provider_type: e.target.value as any })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            >
                              <option value="individual">Independiente</option>
                              <option value="company">Empresa</option>
                              <option value="specialist">Especialista en marca</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Categoría de servicio"
                              value={newProviderData.service_category}
                              onChange={(e) => setNewProviderData({ ...newProviderData, service_category: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <button
                              type="button"
                              onClick={handleAddExternalProvider}
                              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition text-sm"
                            >
                              Crear Prestador
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notas Adicionales
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas o instrucciones especiales..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {submitting ? 'Creando...' : '✅ Crear Orden Interna'}
              </button>
            </div>
          )}

          {orderType === 'quotation' && (
            <>
              {/* APROBACIÓN */}
              <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 border-b pb-3">
                  📋 Aprobación del Cliente
                </h2>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requires_client_approval}
                    onChange={(e) => setFormData({ ...formData, requires_client_approval: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-900">
                    Esta orden requiere aprobación del cliente
                  </span>
                </label>

                {formData.requires_client_approval && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Fecha Límite de Aprobación *
                    </label>
                    <input
                      type="date"
                      required={formData.requires_client_approval}
                      value={formData.approval_deadline}
                      onChange={(e) => setFormData({ ...formData, approval_deadline: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-600 mt-2">
                      El cliente tendrá hasta esta fecha para aprobar o rechazar
                    </p>
                  </div>
                )}
              </div>

              {/* COSTO Y COTIZACIÓN */}
              <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 border-b pb-3">
                  💰 Cotización y Costos
                </h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.has_client_cost}
                      onChange={(e) => setFormData({ ...formData, has_client_cost: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="font-medium text-slate-900">
                      ¿Esta OT tiene costo al cliente?
                    </span>
                  </label>
                  {formData.has_client_cost && (
                    <p className="text-sm text-blue-700 mt-2">
                      📋 Folio generado automáticamente: OT-XXXX-2026
                    </p>
                  )}
                </div>

                {formData.has_client_cost && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Número de Cotización Externa
                        </label>
                        <input
                          type="text"
                          value={formData.external_quotation_number}
                          onChange={(e) => setFormData({ ...formData, external_quotation_number: e.target.value })}
                          placeholder="Ej: COTI-2025-001"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Monto de Cotización (CLP)
                        </label>
                        <input
                          type="number"
                          value={formData.quotation_amount}
                          onChange={(e) => setFormData({ ...formData, quotation_amount: e.target.value })}
                          placeholder="0"
                          min="0"
                          step="1000"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Adjuntar Cotización (PDF)
                        </label>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setQuotationFile(e.target.files?.[0] || null)}
                          className="w-full text-sm text-slate-700"
                        />
                        <p className="text-xs text-slate-500 mt-1">Formato PDF. Se almacenará y el cliente podrá descargarla.</p>
                        {formData.external_quotation_pdf_url && !quotationFile && (
                          <a
                            href={formData.external_quotation_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium mt-2"
                          >
                            <Download className="w-3 h-3" /> Ver cotización existente
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Descripción de Cotización
                      </label>
                      <textarea
                        value={formData.quotation_description}
                        onChange={(e) => setFormData({ ...formData, quotation_description: e.target.value })}
                        rows={3}
                        placeholder="Descripción detallada de lo cotizado..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* REPUESTOS */}
                    <div className="border-t-2 border-slate-200 pt-4">
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Repuestos y Materiales
                      </h4>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.involves_foreign_parts}
                          onChange={(e) => setFormData({ ...formData, involves_foreign_parts: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-slate-900">¿Incluye compras en el extranjero?</span>
                      </label>

                      {formData.involves_foreign_parts && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Proveedor / País
                          </label>
                          <input
                            type="text"
                            value={formData.foreign_parts_supplier}
                            onChange={(e) => setFormData({ ...formData, foreign_parts_supplier: e.target.value })}
                            placeholder="Ej: Germany / Siemens"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />

                          <div className="mt-3">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Plazo de Importación (días o rango)
                            </label>
                            <input
                              type="text"
                              value={formData.foreign_parts_lead_time}
                              onChange={(e) => setFormData({ ...formData, foreign_parts_lead_time: e.target.value })}
                              placeholder="Ej: 15 días o 7-10 días"
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Se muestra al cliente para transparentar tiempos de importación fuera de nuestro control.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Estimación de Ejecución (días)
                      </label>
                      <input
                        type="number"
                        value={formData.estimated_execution_days}
                        onChange={(e) => setFormData({ ...formData, estimated_execution_days: e.target.value })}
                        placeholder="Ej: 5"
                        min="1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* ADELANTOS */}
                    <div className="border-t-2 border-slate-200 pt-4">
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Adelanto de Pago
                      </h4>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.requires_advance_payment}
                          onChange={(e) => setFormData({ ...formData, requires_advance_payment: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-slate-900">Requiere adelanto de pago</span>
                      </label>

                      {formData.requires_advance_payment && (
                        <div className="mt-3 grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Porcentaje Adelanto (%)
                            </label>
                            <input
                              type="number"
                              value={formData.advance_percentage}
                              onChange={(e) => handleAdvancePercentageChange(e.target.value)}
                              placeholder="0"
                              min="0"
                              max="100"
                              step="5"
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Monto Adelanto (CLP) (Auto)
                            </label>
                            <input
                              type="number"
                              value={formData.advance_amount}
                              disabled
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* GARANTÍAS */}
              <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 border-b pb-3">
                  🛡️ Garantías
                </h2>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Garantía de Trabajo</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Meses
                      </label>
                      <input
                        type="number"
                        value={formData.work_warranty_months}
                        onChange={(e) => setFormData({ ...formData, work_warranty_months: e.target.value })}
                        placeholder="Ej: 12"
                        min="0"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={formData.work_warranty_description}
                        onChange={(e) => setFormData({ ...formData, work_warranty_description: e.target.value })}
                        placeholder="Cobertura de trabajo..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-slate-200 pt-4">
                  <h4 className="font-semibold text-slate-900 mb-3">Garantía de Repuestos</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Meses
                      </label>
                      <input
                        type="number"
                        value={formData.parts_warranty_months}
                        onChange={(e) => setFormData({ ...formData, parts_warranty_months: e.target.value })}
                        placeholder="Ej: 24"
                        min="0"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={formData.parts_warranty_description}
                        onChange={(e) => setFormData({ ...formData, parts_warranty_description: e.target.value })}
                        placeholder="Cobertura de repuestos..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* PROGRAMACIÓN - DESPUÉS DE APROBACIÓN (SOLO MUESTRA BOTÓN) */}
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                <AlertCircle className="w-5 h-5 inline text-blue-600 mr-2" />
                <span className="text-sm text-blue-800">
                  ℹ️ La designación de técnico y fecha se realizará después de la aprobación del cliente.
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50"
              >
                {submitting ? 'Creando...' : '✅ Crear Orden con Cotización'}
              </button>
            </>
          )}
        </form>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Órdenes de Trabajo
        </h1>
        <button
          onClick={() => {
            resetForm();
            setViewMode('create');
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          <Plus className="w-5 h-5" />
          Nueva Orden
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-slate-600 text-sm">Total Órdenes</p>
          <p className="text-3xl font-bold text-slate-900">{workOrders.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 shadow">
          <p className="text-slate-600 text-sm">Pendientes</p>
          <p className="text-3xl font-bold text-yellow-800">{workOrders.filter((o) => o.status === 'pending').length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 shadow">
          <p className="text-slate-600 text-sm">En Progreso</p>
          <p className="text-3xl font-bold text-blue-800">{workOrders.filter((o) => o.status === 'in_progress').length}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 shadow">
          <p className="text-slate-600 text-sm">Completadas</p>
          <p className="text-3xl font-bold text-green-800">{workOrders.filter((o) => o.status === 'completed').length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Folio</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Cliente/Edificio</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Prioridad</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{workOrder.folio_number || workOrder.id.substring(0, 8)}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {workOrder.buildings?.clients?.business_name} / {workOrder.buildings?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {workOrder.is_internal ? '🔧 Interna' : '📊 Cotización'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{workOrder.description.substring(0, 40)}...</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {workOrder.quotation_amount ? `$${workOrder.quotation_amount.toLocaleString('es-CL')}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityBadge(workOrder.priority)}`}>
                      {workOrder.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(workOrder.status)}`}>
                      {workOrder.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
