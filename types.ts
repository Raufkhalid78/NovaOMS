
export enum TicketStatus {
  WAITING = 'WAITING',
  SERVING = 'SERVING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export type Ticket = {
  id: string;
  number: string; // e.g., A001, B002
  name: string;
  phone?: string;
  serviceId: string;
  serviceName: string; // De-normalized for easier display
  status: TicketStatus;
  joinedAt: number; // timestamp
  servedAt?: number; // timestamp
  completedAt?: number; // timestamp
  counter?: number;
}

export interface CounterState {
  id: number;
  isOpen: boolean;
  currentTicketId: string | null;
  assignedStaffId?: string; // ID of the staff user logged in here
}

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  KIOSK = 'KIOSK',
  DISPLAY = 'DISPLAY'
}

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, this would be hashed.
  role: UserRole;
  name: string;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  prefix: string; // e.g., 'A', 'B'
  colorTheme: string; // e.g., 'blue', 'emerald'
  defaultWaitTime?: number; // Default wait time in minutes per ticket
}

export interface AIInsight {
  message: string;
  severity: 'info' | 'warning' | 'alert';
  timestamp: number;
}

export interface SystemSettings {
  whatsappEnabled: boolean;
  whatsappTemplate: string; // e.g., "Hello {name}, your ticket {number} is ready at Counter {counter}."
  whatsappApiKey?: string; // API Key for backend integration
  allowMobileEntry: boolean;
  mobileEntryUrl?: string; // Custom URL for the QR code
  operatingHours: {
    enabled: boolean;
    start: string; // "09:00" (24h format)
    end: string;   // "17:00" (24h format)
  };
}
