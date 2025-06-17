import { IsString, IsOptional, IsBoolean } from 'class-validator';

// DTO para configurar calendario de un evento
export class SetEventCalendarDto {
  @IsString()
  calendar_id: string;

  @IsOptional()
  @IsString()
  calendar_name?: string;
}

// DTO para respuesta de lista de calendarios
export class CalendarSummaryDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsBoolean()
  isPrimary: boolean;

  @IsOptional()
  @IsString()
  accessRole?: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsBoolean()
  isActive: boolean;
}

// DTO para sincronizar calendarios desde Google API
export class SyncCalendarsDto {
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

// DTO para filtrar calendarios
export class CalendarFilterDto {
  @IsOptional()
  @IsBoolean()
  onlyActive?: boolean;

  @IsOptional()
  @IsBoolean()
  onlyWritable?: boolean;
}