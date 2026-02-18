
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- Required for midnight reset

-- 0. CLEANUP (Destructive: Drops existing tables to allow a clean reset)
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS counters CASCADE; -- Drop counters before tickets due to circular dependency usually, but CASCADE handles it
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS ticket_status CASCADE;

-- 1. ENUMS (Mapping to types.ts enums)
CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'KIOSK', 'DISPLAY');
CREATE TYPE ticket_status AS ENUM ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- 2. TABLES

-- Users Table
-- Changed ID to TEXT to support 'admin_1' style legacy IDs from constants.ts
CREATE TABLE app_users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, 
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'STAFF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services Table
-- Added default_wait_time
CREATE TABLE services (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL, -- e.g., 'A', 'B'
    color_theme TEXT NOT NULL DEFAULT 'blue',
    default_wait_time INTEGER DEFAULT 5, -- Default wait time in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Counters Table
CREATE TABLE counters (
    id INTEGER PRIMARY KEY, -- 1, 2, 3, 4...
    is_open BOOLEAN DEFAULT TRUE,
    current_ticket_id TEXT, -- FK to tickets (TEXT)
    assigned_staff_id TEXT REFERENCES app_users(id) ON DELETE SET NULL
);

-- Tickets Table
CREATE TABLE tickets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    number TEXT NOT NULL, -- e.g. A001
    name TEXT NOT NULL,
    phone TEXT,
    service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
    service_name TEXT, -- Denormalized for easier display/archiving
    status ticket_status DEFAULT 'WAITING',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    served_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    counter_id INTEGER REFERENCES counters(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Circular Foreign Key for counters
ALTER TABLE counters 
ADD CONSTRAINT fk_current_ticket 
FOREIGN KEY (current_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

-- System Settings (Singleton Table)
-- Updated operating_hours to JSONB to match React frontend structure
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
    whatsapp_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_template TEXT,
    whatsapp_api_key TEXT,
    allow_mobile_entry BOOLEAN DEFAULT TRUE,
    mobile_entry_url TEXT,
    operating_hours JSONB DEFAULT '{"enabled": true, "start": "09:00", "end": "17:00"}'::jsonb
);

-- 3. ROW LEVEL SECURITY (RLS)

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for public (mimicking local dev environment)
CREATE POLICY "Allow public access to users" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to counters" ON counters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. REALTIME SETUP
-- Note: You might need to re-enable realtime in Supabase Dashboard if this fails, or remove these lines if handled by dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE counters;
ALTER PUBLICATION supabase_realtime ADD TABLE services;
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;

-- 5. SEED DATA

-- Services (Using IDs from constants.ts with default wait times)
INSERT INTO services (id, name, prefix, color_theme, default_wait_time) VALUES
('srv_1', 'General Inquiry', 'A', 'blue', 5),
('srv_2', 'Bill Payment', 'B', 'emerald', 3),
('srv_3', 'Technical Support', 'C', 'amber', 15),
('srv_4', 'VIP Services', 'V', 'purple', 10);

-- Users (Using IDs from constants.ts)
INSERT INTO app_users (id, username, password, name, role) VALUES
('admin_1', 'admin', '1234', 'System Administrator', 'ADMIN'),
('staff_1', 'staff1', 'password', 'Counter 1 Staff', 'STAFF'),
('staff_2', 'staff2', 'password', 'Counter 2 Staff', 'STAFF'),
('kiosk_1', 'kiosk', 'password', 'Main Kiosk', 'KIOSK'),
('display_1', 'display', 'password', 'Main Display', 'DISPLAY');

-- Counters (1 to 4)
INSERT INTO counters (id, is_open) VALUES
(1, true), (2, true), (3, true), (4, true);

-- Settings
INSERT INTO system_settings (id, whatsapp_template, operating_hours) VALUES 
(1, 'Hello {name}, your turn for {service} is coming up! Your ticket number is {number}. Please proceed to Counter {counter}.', '{"enabled": true, "start": "09:00", "end": "17:00"}'::jsonb);


-- 6. AUTOMATED MIDNIGHT RESET (Database Level)

CREATE OR REPLACE FUNCTION reset_daily_queue()
RETURNS void AS $$
BEGIN
  -- 1. Archive or Delete Tickets
  DELETE FROM tickets;

  -- 2. Reset Counters
  UPDATE counters SET current_ticket_id = NULL;
END;
$$ LANGUAGE plpgsql;

-- Schedule the cron job for 00:00 (Midnight) every day
-- NOTE: Requires pg_cron extension enabled in Supabase Dashboard
SELECT cron.schedule('midnight-reset', '0 0 * * *', 'SELECT reset_daily_queue()');
