import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { QrCode, Printer, CheckSquare, Square, Search, Download, Shield } from 'lucide-react';
import { QRCard } from '../qr/QRCard';
import QRCode from 'qrcode';

interface ClientQR {
  id: string;
  building_name: string;
  company_name: string;
  clientCode: string;
  qrDataURL: string;
}

type PaperSize = 'letter' | 'a4';

export function QRGalleryView() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const printRef = useRef<HTMLDivElement>(null);

  if (!profile || (profile.role !== 'developer' && profile.role !== 'admin')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600">Solo los desarrolladores y administradores pueden acceder a esta vista.</p>
        </div>
      </div>
    );
  }
  // ...resto del código de la galería de QR...
}
