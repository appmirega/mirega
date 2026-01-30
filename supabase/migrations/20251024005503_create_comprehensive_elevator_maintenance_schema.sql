/*
  # Comprehensive Elevator Maintenance Management System Database Schema

  ## Overview
  Complete database structure for managing elevator maintenance operations with multi-role access control.

  ## 1. New Tables

  ### User Management
  - `profiles` - Extended user profiles with role-based information
    - `id` (uuid, references auth.users)
    - `role` (text) - developer, admin, technician, client
    - `full_name` (text)
    - `email` (text)
    - `phone` (text)
    - `avatar_url` (text)
    - `is_active` (boolean)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  - `permissions` - Granular permission control
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `resource` (text) - what can be accessed
    - `action` (text) - read, write, delete, update
    - `created_at` (timestamptz)

  ### Client & Elevator Management
  - `clients` - Client companies and their information
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles) - linked user account
    - `company_name` (text)
    - `rut` (text) - Chilean tax ID
    - `address` (text)
    - `city` (text)
    - `contact_person` (text)
    - `contact_phone` (text)
    - `contact_email` (text)
    - `billing_address` (text)
    - `is_active` (boolean)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  - `elevators` - Individual elevator units
    - `id` (uuid, primary key)
    - `client_id` (uuid, references clients)
    - `qr_code` (text) - unique QR identifier
    - `internal_code` (text)
    - `brand` (text)
    - `model` (text)
    - `serial_number` (text)
    - `installation_date` (date)
    - `last_certification_date` (date)
    - `next_certification_date` (date)
    - `capacity_kg` (integer)
    - `capacity_persons` (integer)
    - `floors` (integer)
    - `location_building` (text)
    - `location_address` (text)
    - `location_coordinates` (text) - GPS coordinates
    - `status` (text) - active, inactive, under_maintenance
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  - `elevator_documents` - Digital folder zero
    - `id` (uuid, primary key)
    - `elevator_id` (uuid, references elevators)
    - `document_type` (text) - electrical_plan, model_specs, certification, etc.
    - `file_name` (text)
    - `file_url` (text)
    - `uploaded_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  ### Maintenance & Checklists
  - `checklist_templates` - Reusable checklist templates
    - `id` (uuid, primary key)
    - `name` (text)
    - `description` (text)
    - `frequency` (text) - monthly, quarterly, semi_annual, annual
    - `is_active` (boolean)
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  - `checklist_items` - Individual items in templates
    - `id` (uuid, primary key)
    - `template_id` (uuid, references checklist_templates)
    - `item_order` (integer)
    - `description` (text)
    - `is_critical` (boolean)
    - `requires_photo` (boolean)
    - `created_at` (timestamptz)

  - `maintenance_schedules` - Planned maintenance
    - `id` (uuid, primary key)
    - `elevator_id` (uuid, references elevators)
    - `template_id` (uuid, references checklist_templates)
    - `assigned_technician_id` (uuid, references profiles)
    - `scheduled_date` (date)
    - `status` (text) - pending, in_progress, completed, cancelled
    - `created_at` (timestamptz)

  - `maintenance_executions` - Actual maintenance performed
    - `id` (uuid, primary key)
    - `schedule_id` (uuid, references maintenance_schedules)
    - `elevator_id` (uuid, references elevators)
    - `technician_id` (uuid, references profiles)
    - `started_at` (timestamptz)
    - `completed_at` (timestamptz)
    - `general_notes` (text)
    - `signature_url` (text)
    - `created_at` (timestamptz)

  - `checklist_responses` - Responses to checklist items
    - `id` (uuid, primary key)
    - `execution_id` (uuid, references maintenance_executions)
    - `item_id` (uuid, references checklist_items)
    - `status` (text) - ok, needs_attention, critical
    - `notes` (text)
    - `photo_url` (text)
    - `created_at` (timestamptz)

  ### Emergency & Visits
  - `emergency_visits` - Emergency call reports
    - `id` (uuid, primary key)
    - `elevator_id` (uuid, references elevators)
    - `client_id` (uuid, references clients)
    - `reported_by` (text)
    - `report_method` (text) - app, whatsapp, phone, email
    - `incident_type` (text) - stopped, malfunction, noise, other
    - `priority` (text) - low, medium, high, critical
    - `description` (text)
    - `reported_at` (timestamptz)
    - `assigned_technician_id` (uuid, references profiles)
    - `attended_at` (timestamptz)
    - `resolved_at` (timestamptz)
    - `resolution_notes` (text)
    - `status` (text) - reported, assigned, in_progress, resolved, closed
    - `created_at` (timestamptz)

  ### Work Orders & Quotations
  - `work_orders` - OT (Órdenes de Trabajo)
    - `id` (uuid, primary key)
    - `order_number` (text) - unique OT number
    - `elevator_id` (uuid, references elevators)
    - `client_id` (uuid, references clients)
    - `order_type` (text) - maintenance, repair, emergency, installation
    - `title` (text)
    - `description` (text)
    - `assigned_technician_id` (uuid, references profiles)
    - `scheduled_date` (date)
    - `priority` (text)
    - `status` (text) - draft, assigned, in_progress, completed, cancelled
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  - `quotations` - Repair and service quotations
    - `id` (uuid, primary key)
    - `quotation_number` (text)
    - `elevator_id` (uuid, references elevators)
    - `client_id` (uuid, references clients)
    - `title` (text)
    - `description` (text)
    - `total_amount` (decimal)
    - `currency` (text)
    - `valid_until` (date)
    - `status` (text) - draft, sent, approved, rejected, expired
    - `sent_at` (timestamptz)
    - `approved_at` (timestamptz)
    - `approved_by` (text)
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  - `quotation_items` - Line items in quotations
    - `id` (uuid, primary key)
    - `quotation_id` (uuid, references quotations)
    - `description` (text)
    - `quantity` (integer)
    - `unit_price` (decimal)
    - `total_price` (decimal)
    - `spare_part_id` (uuid, references spare_parts)

  ### Inventory Management
  - `spare_parts` - Parts inventory
    - `id` (uuid, primary key)
    - `part_code` (text)
    - `name` (text)
    - `description` (text)
    - `brand` (text)
    - `category` (text)
    - `unit_price` (decimal)
    - `stock_quantity` (integer)
    - `min_stock_level` (integer)
    - `location` (text)
    - `supplier` (text)
    - `is_active` (boolean)
    - `created_at` (timestamptz)

  - `inventory_movements` - Stock movements
    - `id` (uuid, primary key)
    - `spare_part_id` (uuid, references spare_parts)
    - `movement_type` (text) - in, out, adjustment
    - `quantity` (integer)
    - `reference_type` (text) - work_order, purchase, adjustment
    - `reference_id` (uuid)
    - `notes` (text)
    - `performed_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  ### Routes & Scheduling
  - `work_routes` - Daily/weekly technician routes
    - `id` (uuid, primary key)
    - `route_name` (text)
    - `route_date` (date)
    - `technician_id` (uuid, references profiles)
    - `status` (text) - planned, in_progress, completed
    - `created_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  - `route_stops` - Individual stops in routes
    - `id` (uuid, primary key)
    - `route_id` (uuid, references work_routes)
    - `stop_order` (integer)
    - `elevator_id` (uuid, references elevators)
    - `maintenance_schedule_id` (uuid, references maintenance_schedules)
    - `estimated_duration` (integer) - minutes
    - `status` (text) - pending, completed, skipped
    - `completed_at` (timestamptz)

  ### Notifications & Communications
  - `notifications` - In-app notifications
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `title` (text)
    - `message` (text)
    - `type` (text) - info, warning, alert, reminder
    - `reference_type` (text)
    - `reference_id` (uuid)
    - `is_read` (boolean)
    - `created_at` (timestamptz)

  - `email_queue` - Email sending queue
    - `id` (uuid, primary key)
    - `recipient_email` (text)
    - `subject` (text)
    - `body` (text)
    - `attachments` (jsonb) - array of file URLs
    - `status` (text) - pending, sent, failed
    - `sent_at` (timestamptz)
    - `created_at` (timestamptz)

  ### Technical Manuals & Resources
  - `technical_manuals` - Elevator manuals and documentation
    - `id` (uuid, primary key)
    - `title` (text)
    - `brand` (text)
    - `model` (text)
    - `document_type` (text) - manual, diagram, specifications
    - `file_url` (text)
    - `uploaded_by` (uuid, references profiles)
    - `created_at` (timestamptz)

  ### Audit & History
  - `audit_logs` - System audit trail
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `action` (text)
    - `resource_type` (text)
    - `resource_id` (uuid)
    - `old_values` (jsonb)
    - `new_values` (jsonb)
    - `ip_address` (text)
    - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Create restrictive policies based on user roles
  - Audit logging for sensitive operations
  - Proper authentication checks using auth.uid()

  ## 3. Indexes
  - Performance indexes on frequently queried columns
  - Foreign key indexes for relationship joins
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('developer', 'admin', 'technician', 'client')),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  resource text NOT NULL,
  action text NOT NULL CHECK (action IN ('read', 'write', 'delete', 'update')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, resource, action)
);

-- =============================================
-- CLIENT & ELEVATOR MANAGEMENT
-- =============================================

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  rut text UNIQUE NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  contact_person text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  billing_address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elevators (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  qr_code text UNIQUE,
  internal_code text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  serial_number text,
  installation_date date,
  last_certification_date date,
  next_certification_date date,
  capacity_kg integer,
  capacity_persons integer,
  floors integer,
  location_building text,
  location_address text NOT NULL,
  location_coordinates text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'under_maintenance')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elevator_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- MAINTENANCE & CHECKLISTS
-- =============================================

CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE,
  item_order integer NOT NULL,
  description text NOT NULL,
  is_critical boolean DEFAULT false,
  requires_photo boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  template_id uuid REFERENCES checklist_templates(id),
  assigned_technician_id uuid REFERENCES profiles(id),
  scheduled_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_executions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id uuid REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  general_notes text,
  signature_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_responses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id uuid REFERENCES maintenance_executions(id) ON DELETE CASCADE,
  item_id uuid REFERENCES checklist_items(id),
  status text NOT NULL CHECK (status IN ('ok', 'needs_attention', 'critical')),
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- EMERGENCY & VISITS
-- =============================================

CREATE TABLE IF NOT EXISTS emergency_visits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  reported_by text NOT NULL,
  report_method text DEFAULT 'app' CHECK (report_method IN ('app', 'whatsapp', 'phone', 'email')),
  incident_type text NOT NULL CHECK (incident_type IN ('stopped', 'malfunction', 'noise', 'door_issue', 'other')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  reported_at timestamptz DEFAULT now(),
  assigned_technician_id uuid REFERENCES profiles(id),
  attended_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  status text DEFAULT 'reported' CHECK (status IN ('reported', 'assigned', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- WORK ORDERS & QUOTATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number text UNIQUE NOT NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  order_type text NOT NULL CHECK (order_type IN ('maintenance', 'repair', 'emergency', 'installation', 'inspection')),
  title text NOT NULL,
  description text,
  assigned_technician_id uuid REFERENCES profiles(id),
  scheduled_date date,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'assigned', 'in_progress', 'completed', 'cancelled')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number text UNIQUE NOT NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  total_amount decimal(10,2) DEFAULT 0,
  currency text DEFAULT 'CLP',
  valid_until date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  spare_part_id uuid
);

-- =============================================
-- INVENTORY MANAGEMENT
-- =============================================

CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  brand text,
  category text,
  unit_price decimal(10,2) DEFAULT 0,
  stock_quantity integer DEFAULT 0,
  min_stock_level integer DEFAULT 0,
  location text,
  supplier text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  spare_part_id uuid REFERENCES spare_parts(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  performed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Add FK after spare_parts exists
ALTER TABLE quotation_items 
ADD CONSTRAINT fk_spare_part 
FOREIGN KEY (spare_part_id) 
REFERENCES spare_parts(id) ON DELETE SET NULL;

-- =============================================
-- ROUTES & SCHEDULING
-- =============================================

CREATE TABLE IF NOT EXISTS work_routes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_name text NOT NULL,
  route_date date NOT NULL,
  technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_stops (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id uuid REFERENCES work_routes(id) ON DELETE CASCADE,
  stop_order integer NOT NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE,
  maintenance_schedule_id uuid REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  estimated_duration integer DEFAULT 60,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at timestamptz
);

-- =============================================
-- NOTIFICATIONS & COMMUNICATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'warning', 'alert', 'reminder')),
  reference_type text,
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  attachments jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- TECHNICAL MANUALS & RESOURCES
-- =============================================

CREATE TABLE IF NOT EXISTS technical_manuals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  brand text,
  model text,
  document_type text NOT NULL CHECK (document_type IN ('manual', 'diagram', 'specifications', 'guide')),
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- AUDIT & HISTORY
-- =============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_clients_rut ON clients(rut);
CREATE INDEX IF NOT EXISTS idx_elevators_client ON elevators(client_id);
CREATE INDEX IF NOT EXISTS idx_elevators_qr ON elevators(qr_code);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_date ON maintenance_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_technician ON maintenance_schedules(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_emergency_visits_status ON emergency_visits(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevators ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevator_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Developers can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

CREATE POLICY "Developers and admins can manage profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- CLIENTS POLICIES
-- =============================================

CREATE POLICY "Clients can view own data"
  ON clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Technicians can view client data"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
    )
  );

CREATE POLICY "Admins and developers can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- ELEVATORS POLICIES
-- =============================================

CREATE POLICY "Clients can view own elevators"
  ON elevators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = elevators.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can view all elevators"
  ON elevators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

CREATE POLICY "Admins can manage elevators"
  ON elevators FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- MAINTENANCE POLICIES
-- =============================================

CREATE POLICY "Technicians can view assigned maintenance"
  ON maintenance_schedules FOR SELECT
  TO authenticated
  USING (
    assigned_technician_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Clients can view their elevator maintenance"
  ON maintenance_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM elevators e
      JOIN clients c ON e.client_id = c.id
      WHERE e.id = maintenance_schedules.elevator_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage maintenance schedules"
  ON maintenance_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Technicians can create and update maintenance executions"
  ON maintenance_executions FOR INSERT
  TO authenticated
  WITH CHECK (technician_id = auth.uid());

CREATE POLICY "Technicians can view and update own executions"
  ON maintenance_executions FOR ALL
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =============================================
-- EMERGENCY VISITS POLICIES
-- =============================================

CREATE POLICY "Clients can view own emergency visits"
  ON emergency_visits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = emergency_visits.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create emergency visits"
  ON emergency_visits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = emergency_visits.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can view and update emergency visits"
  ON emergency_visits FOR ALL
  TO authenticated
  USING (
    assigned_technician_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- WORK ORDERS & QUOTATIONS POLICIES
-- =============================================

CREATE POLICY "Clients can view own quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = quotations.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage quotations"
  ON quotations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Technicians can view work orders"
  ON work_orders FOR SELECT
  TO authenticated
  USING (
    assigned_technician_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Admins can manage work orders"
  ON work_orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- SPARE PARTS POLICIES
-- =============================================

CREATE POLICY "All authenticated users can view spare parts"
  ON spare_parts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage spare parts"
  ON spare_parts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- TECHNICAL MANUALS POLICIES
-- =============================================

CREATE POLICY "All authenticated users can view manuals"
  ON technical_manuals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage manuals"
  ON technical_manuals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- =============================================
-- GENERIC POLICIES FOR REMAINING TABLES
-- =============================================

CREATE POLICY "Allow read access to related data"
  ON checklist_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage checklist templates"
  ON checklist_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Allow read access to checklist items"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage checklist items"
  ON checklist_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Technicians can manage checklist responses"
  ON checklist_responses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_executions me
      WHERE me.id = checklist_responses.execution_id
      AND me.technician_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Users can view related documents"
  ON elevator_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM elevators e
      JOIN clients c ON e.client_id = c.id
      WHERE e.id = elevator_documents.elevator_id
      AND (
        c.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('technician', 'admin', 'developer')
        )
      )
    )
  );

CREATE POLICY "Admins can manage documents"
  ON elevator_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "View quotation items with quotation access"
  ON quotation_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN clients c ON q.client_id = c.id
      WHERE q.id = quotation_items.quotation_id
      AND (
        c.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'developer')
        )
      )
    )
  );

CREATE POLICY "Admins manage quotation items"
  ON quotation_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Technicians and admins view inventory movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

CREATE POLICY "Admins manage inventory movements"
  ON inventory_movements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Technicians view own routes"
  ON work_routes FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Admins manage routes"
  ON work_routes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "View route stops with route access"
  ON route_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_routes wr
      WHERE wr.id = route_stops.route_id
      AND (
        wr.technician_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'developer')
        )
      )
    )
  );

CREATE POLICY "Technicians update own route stops"
  ON route_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_routes wr
      WHERE wr.id = route_stops.route_id
      AND wr.technician_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_routes wr
      WHERE wr.id = route_stops.route_id
      AND wr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage route stops"
  ON route_stops FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Admins view email queue"
  ON email_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "System can manage email queue"
  ON email_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

CREATE POLICY "Developers view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

CREATE POLICY "System creates audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Developers view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

CREATE POLICY "Developers manage permissions"
  ON permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );