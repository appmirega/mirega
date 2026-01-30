import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  getElevatorHistoricalCosts,
  getClientHistoricalCosts,
  calculateROI,
  HistoricalCosts,
  ROIScenario,
} from '../../lib/roiService';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  // ...existing code...
  Download,
} from 'lucide-react';

export function ROICalculatorView() {
  const [mode, setMode] = useState<'elevator' | 'client'>('elevator');
  const [buildings, setBuildings] = useState<any[]>([]);
  const [elevators, setElevators] = useState<any[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedElevator, setSelectedElevator] = useState('');
  const [historicalCosts, setHistoricalCosts] = useState<HistoricalCosts | null>(null);
  const [loading, setLoading] = useState(false);

  // Formulario de entrada
  const [investmentCost, setInvestmentCost] = useState(28000);
  const [annualMaintenanceCost, setAnnualMaintenanceCost] = useState(8000);
  const [repairReduction, setRepairReduction] = useState(80);
  const [inactivityReduction, setInactivityReduction] = useState(95);

  const [roiResults, setRoiResults] = useState<ROIScenario | null>(null);
  const [scenarioComparisons, setScenarioComparisons] = useState<{ name: string; result: ROIScenario }[]>([]);

  const presets = {
    conservative: { investment: 18000, maintenance: 6000, repair: 60, inactivity: 80, label: 'Conservador' },
    standard: { investment: 28000, maintenance: 8000, repair: 80, inactivity: 95, label: 'Estándar' },
    premium: { investment: 40000, maintenance: 10000, repair: 95, inactivity: 99, label: 'Premium' },
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('id, building_name')
        .order('building_name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Error loading buildings:', error);
    }
  };

  const loadElevators = async (buildingId: string) => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select('id, location_name, brand, model')
        .eq('building_id', buildingId)
        .order('location_name');

      if (error) throw error;
      setElevators(data || []);
      setSelectedElevator('');
    } catch (error) {
      console.error('Error loading elevators:', error);
    }
  };

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      if (mode === 'elevator' && selectedElevator) {
        const costs = await getElevatorHistoricalCosts(selectedElevator);
        setHistoricalCosts(costs);
      } else if (mode === 'client' && selectedBuilding) {
        const { data: building } = await supabase
          .from('buildings')
          .select('client_id')
          .eq('id', selectedBuilding)
          .single();

        if (building) {
          const costs = await getClientHistoricalCosts(building.client_id);
          setHistoricalCosts(costs);
        }
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
      alert('Error al cargar datos históricos: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    setInvestmentCost(preset.investment);
    setAnnualMaintenanceCost(preset.maintenance);
    setRepairReduction(preset.repair);
    setInactivityReduction(preset.inactivity);
  };

  const compareScenarios = () => {
    if (!historicalCosts) {
      alert('Primero carga los datos históricos');
      return;
    }

    const comparisons = Object.entries(presets).map(([, preset]) => {
      const result = calculateROI(
        historicalCosts,
        preset.investment,
        preset.maintenance,
        preset.repair / 100,
        preset.inactivity / 100
      );
      return { name: preset.label, result };
    });
    setScenarioComparisons(comparisons);
  };

  const handleCalculate = () => {
    if (!historicalCosts) {
      alert('Primero carga los datos históricos');
      return;
    }

    const results = calculateROI(
      historicalCosts,
      investmentCost,
      annualMaintenanceCost,
      repairReduction / 100,
      inactivityReduction / 100
    );

    setRoiResults(results);
  };

  const handleExportPDF = () => {
    if (!roiResults || !historicalCosts) return;

    const doc = `
REPORTE DE ANÁLISIS ROI
========================
Fecha: ${new Date().toLocaleDateString('es-CL')}

DATOS HISTÓRICOS (Últimos 3 años)
─────────────────────────────────
Costo total reparaciones: $${historicalCosts.totalRepairCosts.toLocaleString('es-CL')}
Número de reparaciones: ${historicalCosts.repairCount}
Costo promedio por reparación: $${historicalCosts.avgCostPerRepair.toLocaleString('es-CL')}
Horas de inactividad: ${historicalCosts.inactivityHours} horas

ESCENARIO ACTUAL (Sin mejoras)
───────────────────────────────
Costo anual reparaciones: $${roiResults.current.annualRepairCost.toLocaleString('es-CL')}
Costo anual inactividad: $${roiResults.current.annualInactivityCost.toLocaleString('es-CL')}
Costo total anual: $${roiResults.current.totalAnnualCost.toLocaleString('es-CL')}

ESCENARIO MEJORADO (Con inversión)
──────────────────────────────────
Inversión inicial: $${roiResults.improved.investmentCost.toLocaleString('es-CL')}
Costo mantenimiento anual: $${roiResults.improved.annualMaintenanceCost.toLocaleString('es-CL')}
Costo reparaciones anual: $${roiResults.improved.annualRepairCost.toLocaleString('es-CL')}
Costo inactividad anual: $${roiResults.improved.annualInactivityCost.toLocaleString('es-CL')}
Costo total anual: $${roiResults.improved.totalAnnualCost.toLocaleString('es-CL')}

RESULTADO FINANCIERO
───────────────────
Ahorro anual: $${roiResults.metrics.annualSavings.toLocaleString('es-CL')}
Período de recuperación: ${roiResults.metrics.paybackPeriod} años
ROI acumulado: ${roiResults.metrics.roi.toFixed(1)}%

RECOMENDACIÓN: ${
      roiResults.metrics.recommendation === 'procced'
        ? '✅ PROCEDER (ROI excelente)'
        : roiResults.metrics.recommendation === 'review'
        ? '⚠️ REVISAR (ROI moderado)'
        : '❌ NO RECOMENDADO (ROI insuficiente)'
    }
    `;

    const blob = new Blob([doc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi-analysis-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const handleExportCSV = () => {
    if (!roiResults || !historicalCosts) return;
    const rows = [
      ['Metrica', 'Actual', 'Mejorado'],
      ['Costo reparaciones anual', roiResults.current.annualRepairCost.toFixed(0), roiResults.improved.annualRepairCost.toFixed(0)],
      ['Costo inactividad anual', roiResults.current.annualInactivityCost.toFixed(0), roiResults.improved.annualInactivityCost.toFixed(0)],
      ['Costo total anual', roiResults.current.totalAnnualCost.toFixed(0), roiResults.improved.totalAnnualCost.toFixed(0)],
      ['Inversion inicial', '', roiResults.improved.investmentCost.toFixed(0)],
      ['Mantencion anual', '', roiResults.improved.annualMaintenanceCost.toFixed(0)],
      ['Ahorro anual', roiResults.metrics.annualSavings.toFixed(0), ''],
      ['Payback (años)', roiResults.metrics.paybackPeriod.toString(), ''],
      ['ROI (%)', roiResults.metrics.roi.toFixed(1), ''],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi-comparacion-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Calculator className="w-8 h-8 text-green-600" />
          Prioridades Operativas
        </h1>
        <p className="text-slate-600 mt-1">Analiza el costo-beneficio de mejoras en ascensores</p>
      </div>

      {/* Modo Selection */}
      <div className="flex gap-3">
        <button
          onClick={() => setMode('elevator')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            mode === 'elevator'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          📊 Por Ascensor
        </button>
        <button
          onClick={() => setMode('client')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
            mode === 'client'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          🏢 Por Edificio
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado izquierdo: Selección y datos históricos */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4">Seleccionar</h2>

            {mode === 'elevator' ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Edificio
                    </label>
                    <select
                      value={selectedBuilding}
                      onChange={(e) => {
                        setSelectedBuilding(e.target.value);
                        loadElevators(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar edificio...</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.building_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Ascensor
                    </label>
                    <select
                      value={selectedElevator}
                      onChange={(e) => setSelectedElevator(e.target.value)}
                      disabled={!selectedBuilding}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Seleccionar ascensor...</option>
                      {elevators.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.location_name} ({e.brand} {e.model})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Edificio
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar edificio...</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.building_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={loadHistoricalData}
              disabled={
                loading ||
                (mode === 'elevator' ? !selectedElevator : !selectedBuilding)
              }
              className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Cargando...' : 'Cargar Datos Históricos'}
            </button>
          </div>

          {/* Datos históricos */}
          {historicalCosts && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-bold text-slate-900">Histórico (Últimos 3 años)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total reparaciones:</span>
                  <span className="font-semibold">
                    ${historicalCosts.totalRepairCosts.toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Número de reparaciones:</span>
                  <span className="font-semibold">{historicalCosts.repairCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Promedio por reparación:</span>
                  <span className="font-semibold">
                    ${historicalCosts.avgCostPerRepair.toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Horas inactividad:</span>
                  <span className="font-semibold">{historicalCosts.inactivityHours}h</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lado derecho: Parámetros y resultados */}
        <div className="lg:col-span-2 space-y-4">
          {historicalCosts && (
            <>
              {/* Parámetros de inversión */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">Parámetros de Mejora</h2>
                  <button
                    onClick={compareScenarios}
                    className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium"
                  >
                    Comparar Presets
                  </button>
                </div>

                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => applyPreset('conservative')}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
                  >
                    Conservador
                  </button>
                  <button
                    onClick={() => applyPreset('standard')}
                    className="flex-1 px-3 py-2 text-xs bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 font-medium text-blue-700"
                  >
                    Estándar
                  </button>
                  <button
                    onClick={() => applyPreset('premium')}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
                  >
                    Premium
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Inversión inicial ($)
                    </label>
                    <input
                      type="number"
                      value={investmentCost}
                      onChange={(e) => setInvestmentCost(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Costo mantenimiento anual ($)
                    </label>
                    <input
                      type="number"
                      value={annualMaintenanceCost}
                      onChange={(e) => setAnnualMaintenanceCost(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reducción de reparaciones: {repairReduction}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={repairReduction}
                      onChange={(e) => setRepairReduction(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reducción de inactividad: {inactivityReduction}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={inactivityReduction}
                      onChange={(e) => setInactivityReduction(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCalculate}
                  className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  Calcular ROI
                </button>
              </div>

              {/* Resultados */}
              {roiResults && (
                <>
                  {/* Comparativa de costos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-end gap-2 md:col-span-2 -mb-2">
                      <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                      >
                        <Download className="h-4 w-4" /> Exportar CSV
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200"
                      >
                        <Download className="h-4 w-4" /> Resumen TXT
                      </button>
                    </div>
                    <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Escenario Actual
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Reparaciones/año:</span>
                          <span className="font-semibold">
                            ${roiResults.current.annualRepairCost.toLocaleString('es-CL')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Inactividad/año:</span>
                          <span className="font-semibold">
                            ${roiResults.current.annualInactivityCost.toLocaleString('es-CL')}
                          </span>
                        </div>
                        <div className="border-t border-orange-200 pt-2 mt-2">
                          <div className="flex justify-between text-base font-bold text-orange-900">
                            <span>Total anual:</span>
                            <span>
                              ${roiResults.current.totalAnnualCost.toLocaleString('es-CL')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                      <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Escenario Mejorado
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Mantenimiento/año:</span>
                          <span className="font-semibold">
                            ${roiResults.improved.annualMaintenanceCost.toLocaleString('es-CL')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Reparaciones/año:</span>
                          <span className="font-semibold">
                            ${roiResults.improved.annualRepairCost.toLocaleString('es-CL')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Inactividad/año:</span>
                          <span className="font-semibold">
                            ${roiResults.improved.annualInactivityCost.toLocaleString('es-CL')}
                          </span>
                        </div>
                        <div className="border-t border-green-200 pt-2 mt-2">
                          <div className="flex justify-between text-base font-bold text-green-900">
                            <span>Total anual:</span>
                            <span>
                              ${roiResults.improved.totalAnnualCost.toLocaleString('es-CL')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-slate-600">Ahorro Anual</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        ${roiResults.metrics.annualSavings.toLocaleString('es-CL')}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-slate-600">Payback</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {roiResults.metrics.paybackPeriod} años
                      </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        <span className="text-sm font-medium text-slate-600">ROI</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">
                        {roiResults.metrics.roi.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Recomendación */}
                  <div
                    className={`rounded-xl border p-6 ${
                      roiResults.metrics.recommendation === 'procced'
                        ? 'bg-green-50 border-green-200'
                        : roiResults.metrics.recommendation === 'review'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <h3
                      className={`font-bold text-lg mb-2 ${
                        roiResults.metrics.recommendation === 'procced'
                          ? 'text-green-900'
                          : roiResults.metrics.recommendation === 'review'
                          ? 'text-yellow-900'
                          : 'text-red-900'
                      }`}
                    >
                      {roiResults.metrics.recommendation === 'procced'
                        ? '✅ RECOMENDACIÓN: PROCEDER'
                        : roiResults.metrics.recommendation === 'review'
                        ? '⚠️ RECOMENDACIÓN: REVISAR'
                        : '❌ RECOMENDACIÓN: NO RECOMENDADO'}
                    </h3>
                  </div>

                  {/* Comparación de escenarios */}
                  {scenarioComparisons.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                      <h3 className="font-bold text-slate-900 mb-4">Comparación de Escenarios</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500 border-b">
                              <th className="py-2 px-2">Escenario</th>
                              <th className="py-2 px-2 text-right">Inversión</th>
                              <th className="py-2 px-2 text-right">Ahorro Anual</th>
                              <th className="py-2 px-2 text-right">Payback</th>
                              <th className="py-2 px-2 text-right">ROI %</th>
                              <th className="py-2 px-2 text-right">Recomendación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scenarioComparisons.map((scenario) => (
                              <tr key={scenario.name} className="border-t text-slate-700 hover:bg-slate-50">
                                <td className="py-2 px-2 font-semibold">{scenario.name}</td>
                                <td className="py-2 px-2 text-right">${(scenario.result.improved.investmentCost / 1000).toFixed(0)}k</td>
                                <td className="py-2 px-2 text-right text-green-600 font-semibold">${(scenario.result.metrics.annualSavings / 1000).toFixed(0)}k</td>
                                <td className="py-2 px-2 text-right">{scenario.result.metrics.paybackPeriod.toFixed(1)} años</td>
                                <td className="py-2 px-2 text-right font-semibold">{scenario.result.metrics.roi.toFixed(1)}%</td>
                                <td className="py-2 px-2 text-right">
                                  {scenario.result.metrics.recommendation === 'procced' ? '✅' : scenario.result.metrics.recommendation === 'review' ? '⚠️' : '❌'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
