
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- Cron no longer required for manual operation

-- 0. CLEANUP (Destructive: Drops existing tables to allow a clean reset)
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS counters CASCADE; 
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
CREATE TABLE app_users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, 
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'STAFF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services Table
CREATE TABLE services (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL, -- e.g., 'A', 'B'
    color_theme TEXT NOT NULL DEFAULT 'blue',
    default_wait_time INTEGER DEFAULT 5, 
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
    service_name TEXT, 
    status ticket_status DEFAULT 'WAITING',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    served_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    counter_id INTEGER REFERENCES counters(id),
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Circular Foreign Key for counters
ALTER TABLE counters 
ADD CONSTRAINT fk_current_ticket 
FOREIGN KEY (current_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

-- System Settings
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
    whatsapp_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_template TEXT,
    whatsapp_api_key TEXT,
    auto_notify_15m BOOLEAN DEFAULT FALSE,
    allow_mobile_entry BOOLEAN DEFAULT TRUE,
    mobile_entry_url TEXT,
    operating_hours JSONB DEFAULT '{"enabled": true, "start": "09:00", "end": "17:00"}'::jsonb,
    country_code TEXT DEFAULT '+1'
);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to users" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to counters" ON counters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. REALTIME SETUP
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE counters;
ALTER PUBLICATION supabase_realtime ADD TABLE services;
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;

-- 5. SEED DATA
INSERT INTO services (id, name, prefix, color_theme, default_wait_time) VALUES
('srv_1', 'General Inquiry', 'A', 'blue', 5),
('srv_2', 'Bill Payment', 'B', 'emerald', 3),
('srv_3', 'Technical Support', 'C', 'amber', 15),
('srv_4', 'VIP Services', 'V', 'purple', 10);

INSERT INTO app_users (id, username, password, name, role) VALUES
('admin_1', 'admin', '1234', 'System Administrator', 'ADMIN'),
('staff_1', 'staff1', '12345', 'Counter 1 Staff', 'STAFF'),
('staff_2', 'staff2', '12345', 'Counter 2 Staff', 'STAFF'),
('kiosk_1', 'kiosk', '12345', 'Main Kiosk', 'KIOSK'),
('display_1', 'display', '12345', 'Main Display', 'DISPLAY');

INSERT INTO counters (id, is_open) VALUES
(1, true), (2, true), (3, true), (4, true);

INSERT INTO system_settings (id, whatsapp_template, operating_hours, country_code) VALUES 
(1, 'Hello {name}, your turn for {service} is coming up! Your ticket number is {number}. Please proceed to Counter {counter}.', '{"enabled": true, "start": "09:00", "end": "17:00"}'::jsonb, '+1');


-- 6. MANUAL RESET FUNCTIONS

-- Function to Reset All Statistics (Deletes completed history, keeps active queue)
CREATE OR REPLACE FUNCTION clear_history_stats()
RETURNS void AS $$
BEGIN
  DELETE FROM tickets WHERE status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW');
END;
$$ LANGUAGE plpgsql;

-- Function to Wipe Entire System (Deletes everything)
CREATE OR REPLACE FUNCTION reset_daily_queue()
RETURNS void AS $$
BEGIN
  -- 1. Archive or Delete Tickets
  DELETE FROM tickets WHERE 1=1;

  -- 2. Reset Counters
  UPDATE counters SET current_ticket_id = NULL WHERE 1=1;
END;
$$ LANGUAGE plpgsql;

-- Removed automated cron schedule to prevent midnight deletion
