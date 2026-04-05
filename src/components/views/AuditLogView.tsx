import { useState } from "react";
import AdminForm from "../forms/AdminForm";
import TechnicianForm from "../forms/TechnicianForm";
import ClientForm from "../forms/ClientForm";

export default function UsersView({ users }: any) {
  const [editingUser, setEditingUser] = useState<any>(null);

  const handleEdit = (user: any) => {
    setEditingUser(user);
  };

  const handleSubmit = (data: any) => {
    console.log("Actualizar usuario:", editingUser.id, data);

    // Aquí debes conectar con tu update real en Supabase
    // await supabase.from("profiles").update(data).eq("id", editingUser.id)

    setEditingUser(null);
  };

  const renderForm = () => {
    if (!editingUser) return null;

    if (editingUser.role === "admin") {
      return <AdminForm initialData={editingUser} onSubmit={handleSubmit} />;
    }

    if (editingUser.role === "technician") {
      return <TechnicianForm initialData={editingUser} onSubmit={handleSubmit} />;
    }

    if (editingUser.role === "client") {
      return <ClientForm initialData={editingUser} onSubmit={handleSubmit} />;
    }

    return null;
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Gestión de Usuarios</h2>

      <table className="w-full border">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {users.map((user: any) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <button
                  onClick={() => handleEdit(user)}
                  className="btn-secondary"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">{renderForm()}</div>
    </div>
  );
}