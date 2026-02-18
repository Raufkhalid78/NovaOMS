
import { ServiceDefinition, User, UserRole } from './types';

// Available color themes for services
export const COLOR_THEMES = [
  { name: 'Blue', value: 'blue', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: 'Emerald', value: 'emerald', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { name: 'Amber', value: 'amber', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  { name: 'Purple', value: 'purple', classes: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Rose', value: 'rose', classes: 'bg-rose-100 text-rose-800 border-rose-200' },
  { name: 'Cyan', value: 'cyan', classes: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { name: 'Indigo', value: 'indigo', classes: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
];

export const INITIAL_SERVICES: ServiceDefinition[] = [
  { id: 'srv_1', name: 'General Inquiry', prefix: 'A', colorTheme: 'blue' },
  { id: 'srv_2', name: 'Bill Payment', prefix: 'B', colorTheme: 'emerald' },
  { id: 'srv_3', name: 'Technical Support', prefix: 'C', colorTheme: 'amber' },
  { id: 'srv_4', name: 'VIP Services', prefix: 'V', colorTheme: 'purple' },
];

export const INITIAL_USERS: User[] = [
  { id: 'admin_1', username: 'admin', password: '1234', role: UserRole.ADMIN, name: 'System Administrator' },
  { id: 'staff_1', username: 'staff1', password: 'password', role: UserRole.STAFF, name: 'Counter 1 Staff' },
  { id: 'staff_2', username: 'staff2', password: 'password', role: UserRole.STAFF, name: 'Counter 2 Staff' },
  { id: 'kiosk_1', username: 'kiosk', password: 'password', role: UserRole.KIOSK, name: 'Main Kiosk' },
  { id: 'display_1', username: 'display', password: 'password', role: UserRole.DISPLAY, name: 'Main Display' },
];

export const TOTAL_COUNTERS = 4;
