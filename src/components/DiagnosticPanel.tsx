import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function DiagnosticPanel() {
  const [diagnostics, setDiagnostics] = useState({
    envVarsLoaded: false,
    supabaseUrl: '',
    connectionTest: 'testing',
    authTest: 'testing',
    rlsTest: 'testing',
    dataTest: 'testing',
  });

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const supabaseUrl = import.meta.env.VITE_BOLT_DATABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_BOLT_DATABASE_ANON_KEY || '';

    setDiagnostics(prev => ({
      ...prev,
      envVarsLoaded: !!(supabaseUrl && supabaseKey),
      supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT FOUND',
    }));

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      setDiagnostics(prev => ({
        ...prev,
        connectionTest: 'success',
        authTest: sessionData.session ? 'authenticated' : 'not-authenticated',
      }));

      if (sessionData.session) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', sessionData.session.user.id)
          .maybeSingle();

        setDiagnostics(prev => ({
          ...prev,
          rlsTest: profileError ? 'error' : 'success',
        }));

        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true });

        setDiagnostics(prev => ({
          ...prev,
          dataTest: clientsError ? 'error' : 'success',
        }));

        if (profileError) console.error('Profile error:', profileError);
        if (clientsError) console.error('Clients error:', clientsError);
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnostics(prev => ({
        ...prev,
        connectionTest: 'error',
      }));
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'success' || status === 'authenticated') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (status === 'error') return <XCircle className="w-5 h-5 text-red-600" />;
    if (status === 'not-authenticated') return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <AlertCircle className="w-5 h-5 text-gray-400 animate-pulse" />;
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-md border border-slate-200 z-50">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
        <Database className="w-5 h-5 text-slate-700" />
        <h3 className="font-semibold text-slate-900">Diagnóstico del Sistema</h3>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Variables de entorno:</span>
          {getStatusIcon(diagnostics.envVarsLoaded ? 'success' : 'error')}
        </div>

        <div className="flex items-start justify-between">
          <span className="text-slate-600">URL Supabase:</span>
          <span className="text-xs text-slate-500 ml-2 text-right">{diagnostics.supabaseUrl}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Conexión:</span>
          {getStatusIcon(diagnostics.connectionTest)}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Autenticación:</span>
          {getStatusIcon(diagnostics.authTest)}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">RLS (Permisos):</span>
          {getStatusIcon(diagnostics.rlsTest)}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">Datos (Clientes):</span>
          {getStatusIcon(diagnostics.dataTest)}
        </div>
      </div>

      <button
        onClick={runDiagnostics}
        className="mt-3 w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-md transition-colors"
      >
        Volver a probar
      </button>
    </div>
  );
}
