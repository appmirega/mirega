import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { QRCard } from '../qr/QRCard';
import {
  QrCode,
  Plus,
  Printer,
  Building2,
  Search,
  CheckSquare,
  Square,
  Download,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';

interface ClientItem {
  id: string;
  company_name?: string | null;
  building_name?: string | null;
  internal_alias?: string | null;
  address?: string | null;
}

interface Elevator {
  id: string;
  client_id: string;
  internal_code?: string | null;
  elevator_number?: number | string | null;
  location_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  location_building?: string | null;
  location_address?: string | null;
  status?: 'active' | 'inactive' | 'under_maintenance' | string | null;
  clients?: ClientItem | ClientItem[] | null;
}

type ViewTab = 'manage' | 'gallery';

interface ElevatorFormData {
  client_id: string;
  internal_code: string;
  elevator_number: string;
  location_name: string;
  brand: string;
  model: string;
  serial_number: string;
  location_building: string;
  location_address: string;
}

function getElevatorQrUrl(elevatorId: string) {
  return `${window.location.origin}/elevator/${elevatorId}`;
}

function getClientObject(elevator: Elevator): ClientItem | null {
  if (!elevator.clients) return null;
  return Array.isArray(elevator.clients) ? elevator.clients[0] ?? null : elevator.clients;
}

function getShortBuildingName(elevator: Elevator) {
  const client = getClientObject(elevator);

  const internalAlias = client?.internal_alias?.trim();
  const buildingName = client?.building_name?.trim();
  const locationBuilding = elevator.location_building?.trim();
  const companyName = client?.company_name?.trim();

  return internalAlias || buildingName || locationBuilding || companyName || 'EDIFICIO';
}

function getElevatorNumber(elevator: Elevator) {
  const elevatorNumber =
    elevator.elevator_number !== null &&
    elevator.elevator_number !== undefined &&
    String(elevator.elevator_number).trim() !== ''
      ? String(elevator.elevator_number).trim()
      : null;

  const internalCode = elevator.internal_code?.trim();

  return elevatorNumber || internalCode || 'S/N';
}

function getElevatorLabelLine(elevator: Elevator) {
  return `Ascensor ${getElevatorNumber(elevator)}`;
}

function QRCodesCompleteView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('manage');
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [selectedElevators, setSelectedElevators] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ElevatorFormData>({
    client_id: '',
    internal_code: '',
    elevator_number: '',
    location_name: '',
    brand: '',
    model: '',
    serial_number: '',
    location_building: '',
    location_address: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const filteredElevators = useMemo(() => {
    let filtered = [...elevators];
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      filtered = filtered.filter((elevator) => {
        const client = getClientObject(elevator);

        return (
          getShortBuildingName(elevator).toLowerCase().includes(term) ||
          getElevatorLabelLine(elevator).toLowerCase().includes(term) ||
          (client?.company_name || '').toLowerCase().includes(term) ||
          (client?.internal_alias || '').toLowerCase().includes(term) ||
          (client?.building_name || '').toLowerCase().includes(term) ||
          (elevator.location_name || '').toLowerCase().includes(term) ||
          (elevator.internal_code || '').toLowerCase().includes(term) ||
          String(elevator.elevator_number ?? '').toLowerCase().includes(term) ||
          (elevator.brand || '').toLowerCase().includes(term) ||
          (elevator.model || '').toLowerCase().includes(term) ||
          (elevator.serial_number || '').toLowerCase().includes(term)
        );
      });
    }

    if (filterClient !== 'all') {
      filtered = filtered.filter((elevator) => elevator.client_id === filterClient);
    }

    return filtered;
  }, [elevators, searchTerm, filterClient]);

  useEffect(() => {
    const generateQrs = async () => {
      const nextMap: Record<string, string> = {};

      for (const elevator of filteredElevators) {
        try {
          nextMap[elevator.id] = await QRCode.toDataURL(getElevatorQrUrl(elevator.id), {
            width: 900,
            margin: 1,
          });
        } catch (error) {
          console.error('Error generating QR:', error);
        }
      }

      setQrMap(nextMap);
    };

    if (filteredElevators.length > 0) {
      generateQrs();
    } else {
      setQrMap({});
    }
  }, [filteredElevators]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadElevators(), loadClients()]);
    } finally {
      setLoading(false);
    }
  };

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select(`
          id,
          client_id,
          internal_code,
          elevator_number,
          location_name,
          brand,
          model,
          serial_number,
          location_building,
          location_address,
          status,
          clients (
            id,
            company_name,
            building_name,
            internal_alias,
            address
          )