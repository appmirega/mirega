import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TechnicianClientTechnicalView() {
  const [elevators, setElevators] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("elevators").select("*");
    setElevators(data || []);
  };

  const update = (i: number, field: string, value: any) => {
    const copy = [...elevators];
    copy[i][field] = value;
    setElevators(copy);
  };

  const save = async () => {
    for (const e of elevators) {
      await supabase
        .from("elevators")
        .update(e)
        .eq("id", e.id);
    }
    alert("Guardado");
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Edición Técnica</h1>

      {elevators.map((e, i) => (
        <div key={e.id} className="border p-3 rounded">
          <input value={e.brand || ""} onChange={(ev)=>update(i,"brand",ev.target.value)} placeholder="Marca"/>
          <input value={e.model || ""} onChange={(ev)=>update(i,"model",ev.target.value)} placeholder="Modelo"/>
        </div>
      ))}

      <button onClick={save}>Guardar</button>
    </div>
  );
}