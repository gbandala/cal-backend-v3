import { CalendarSummaryDto } from '../database/dto/calendar.dto';

// Interfaz para calendarios de Google API
export interface GoogleCalendarItem {
  id: string;
  summary?: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
}

// Formatear lista de calendarios de Google API a DTOs
export function formatCalendarList(googleCalendars: GoogleCalendarItem[]): CalendarSummaryDto[] {
  return googleCalendars.map(gCal => ({
    id: gCal.id,
    name: gCal.summary || gCal.id,
    isPrimary: gCal.primary || false,
    accessRole: gCal.accessRole,
    backgroundColor: gCal.backgroundColor,
    isActive: true
  }));
}

// Validar que el usuario tiene acceso a un calendario específico
export function validateCalendarAccess(calendarId: string, userCalendars: CalendarSummaryDto[]): boolean {
  return userCalendars.some(calendar => 
    calendar.id === calendarId && 
    calendar.isActive &&
    ['owner', 'writer'].includes(calendar.accessRole || '')
  );
}

// Obtener calendario por defecto (primary o el primero disponible)
export function getDefaultCalendar(userCalendars: CalendarSummaryDto[]): CalendarSummaryDto | null {
  // Buscar calendario primary primero
  const primaryCalendar = userCalendars.find(cal => cal.isPrimary && cal.isActive);
  if (primaryCalendar) {
    return primaryCalendar;
  }

  // Si no hay primary, retornar el primero activo con permisos de escritura
  const writableCalendar = userCalendars.find(cal => 
    cal.isActive && 
    ['owner', 'writer'].includes(cal.accessRole || '')
  );

  return writableCalendar || null;
}

// Filtrar calendarios por rol de acceso
export function filterCalendarsByRole(
  calendars: CalendarSummaryDto[], 
  minRole: 'reader' | 'writer' | 'owner' = 'reader'
): CalendarSummaryDto[] {
  const roleHierarchy = {
    'reader': 0,
    'writer': 1, 
    'owner': 2
  };

  const minRoleLevel = roleHierarchy[minRole];

  return calendars.filter(calendar => {
    const calendarRoleLevel = roleHierarchy[calendar.accessRole as keyof typeof roleHierarchy] ?? -1;
    return calendarRoleLevel >= minRoleLevel && calendar.isActive;
  });
}

// Formatear nombre de calendario para display
export function formatCalendarDisplayName(calendar: CalendarSummaryDto): string {
  if (calendar.isPrimary) {
    return `${calendar.name} (Principal)`;
  }
  return calendar.name;
}

// Validar formato de calendar_id
export function isValidCalendarId(calendarId: string): boolean {
  if (!calendarId || typeof calendarId !== 'string') {
    return false;
  }

  // Permitir 'primary' o emails válidos
  if (calendarId === 'primary') {
    return true;
  }

  // Validar formato de email básico para calendar_id
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(calendarId);
}

// Generar colores por defecto para calendarios sin color
export function getDefaultCalendarColor(index: number): string {
  const defaultColors = [
    '#3F51B5', // Indigo
    '#4CAF50', // Green  
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#795548', // Brown
    '#607D8B', // Blue Grey
  ];

  return defaultColors[index % defaultColors.length];
}

// Agrupar calendarios por tipo/dominio
export function groupCalendarsByDomain(calendars: CalendarSummaryDto[]): Record<string, CalendarSummaryDto[]> {
  const groups: Record<string, CalendarSummaryDto[]> = {
    'personal': [],
    'workspace': [],
    'other': []
  };

  calendars.forEach(calendar => {
    if (calendar.isPrimary || calendar.id === 'primary') {
      groups.personal.push(calendar);
    } else if (calendar.id.includes('@') && calendar.id.includes('.')) {
      // Determinar si es workspace basado en dominio común
      const domain = calendar.id.split('@')[1];
      if (domain && !['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'].includes(domain)) {
        groups.workspace.push(calendar);
      } else {
        groups.personal.push(calendar);
      }
    } else {
      groups.other.push(calendar);
    }
  });

  return groups;
}

// Utilidad para debug - mostrar información del calendario
export function debugCalendarInfo(calendar: CalendarSummaryDto): string {
  return `Calendar: ${calendar.name} (${calendar.id}) - Primary: ${calendar.isPrimary}, Role: ${calendar.accessRole}, Active: ${calendar.isActive}`;
}