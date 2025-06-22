/**
 * 🔄 MAPPER ENTRE LOCATION TYPES Y MEETING COMBINATIONS
 * 
 * Este archivo mapea desde los EventLocationEnumType existentes hacia las nuevas 
 * MeetingCombination, manteniendo compatibilidad con el sistema actual.
 */

import { EventLocationEnumType } from "../../../database/entities/event.entity";
import { MeetingCombination, CombinationUtils } from "./meeting-combination.types";
import { BadRequestException } from "../../../utils/app-error";

/**
 * Mapea desde EventLocationEnumType hacia MeetingCombination
 * 
 * @param locationType - Tipo de ubicación del evento existente
 * @returns La combinación correspondiente
 * @throws BadRequestException si el tipo no está soportado
 */
export function mapLocationTypeToCombination(locationType: EventLocationEnumType): MeetingCombination {
  const mapping: Record<EventLocationEnumType, MeetingCombination> = {
    [EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR]: MeetingCombination.GOOGLE_MEET_CALENDAR,
    [EventLocationEnumType.ZOOM_MEETING]: MeetingCombination.ZOOM_GOOGLE_CALENDAR,
    [EventLocationEnumType.OUTLOOK_WITH_ZOOM]: MeetingCombination.ZOOM_OUTLOOK_CALENDAR,
    // 🚀 FUTURAS COMBINACIONES
    [EventLocationEnumType.OUTLOOK_WITH_TEAMS]: MeetingCombination.TEAMS_OUTLOOK_CALENDAR,
    // [EventLocationEnumType.GOOGLE_WITH_TEAMS]: MeetingCombination.TEAMS_GOOGLE_CALENDAR, // Si se añade
    // [EventLocationEnumType.OUTLOOK_WITH_GOOGLE_MEET]: MeetingCombination.GOOGLE_MEET_OUTLOOK_CALENDAR, // Si se añade
  };

  const combination = mapping[locationType];
  
  if (!combination) {
    throw new BadRequestException(
      `Unsupported location type: ${locationType}. ` +
      `Supported types: ${Object.keys(mapping).join(', ')}`
    );
  }

  return combination;
}

/**
 * Mapea desde MeetingCombination hacia EventLocationEnumType (reverse mapping)
 * 
 * @param combination - Combinación de meeting
 * @returns El EventLocationEnumType correspondiente
 * @throws BadRequestException si la combinación no está mapeada
 */
export function mapCombinationToLocationType(combination: MeetingCombination): EventLocationEnumType {
  const reverseMapping: Record<MeetingCombination, EventLocationEnumType> = {
    [MeetingCombination.GOOGLE_MEET_CALENDAR]: EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR,
    [MeetingCombination.ZOOM_GOOGLE_CALENDAR]: EventLocationEnumType.ZOOM_MEETING,
    [MeetingCombination.ZOOM_OUTLOOK_CALENDAR]: EventLocationEnumType.OUTLOOK_WITH_ZOOM,
    [MeetingCombination.TEAMS_OUTLOOK_CALENDAR]: EventLocationEnumType.OUTLOOK_WITH_TEAMS,
    // Combinaciones futuras que podrían no tener LocationType equivalente
    [MeetingCombination.TEAMS_GOOGLE_CALENDAR]: EventLocationEnumType.ZOOM_MEETING, // Placeholder
    [MeetingCombination.GOOGLE_MEET_OUTLOOK_CALENDAR]: EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR, // Placeholder
  };

  const locationType = reverseMapping[combination];
  
  if (!locationType) {
    throw new BadRequestException(
      `No location type mapping for combination: ${combination}`
    );
  }

  return locationType;
}

/**
 * Valida si un EventLocationEnumType está soportado y implementado
 * 
 * @param locationType - Tipo de ubicación a validar
 * @returns true si está soportado e implementado
 */
export function isLocationTypeSupported(locationType: EventLocationEnumType): boolean {
  try {
    const combination = mapLocationTypeToCombination(locationType);
    return CombinationUtils.isImplemented(combination);
  } catch {
    return false;
  }
}

/**
 * Obtiene información detallada sobre un EventLocationEnumType
 * 
 * @param locationType - Tipo de ubicación
 * @returns Información de la combinación correspondiente
 */
export function getLocationTypeInfo(locationType: EventLocationEnumType) {
  const combination = mapLocationTypeToCombination(locationType);
  const config = CombinationUtils.getConfig(combination);
  
  return {
    locationType,
    combination,
    config,
    isImplemented: config.isImplemented,
    requiredIntegrations: config.requiredIntegrations,
    meetingProvider: config.meetingProvider,
    calendarProvider: config.calendarProvider,
    description: config.description
  };
}

/**
 * Obtiene todos los EventLocationEnumType soportados actualmente
 */
export function getSupportedLocationTypes(): EventLocationEnumType[] {
  return Object.values(EventLocationEnumType).filter(isLocationTypeSupported);
}

/**
 * Obtiene todos los EventLocationEnumType que serán soportados en el futuro
 */
export function getFutureLocationTypes(): EventLocationEnumType[] {
  return Object.values(EventLocationEnumType).filter(locationType => {
    try {
      const combination = mapLocationTypeToCombination(locationType);
      return !CombinationUtils.isImplemented(combination);
    } catch {
      return false;
    }
  });
}

/**
 * Utilidad para logging y debugging
 */
export class LocationMappingDebugger {
  /**
   * Imprime un resumen de todos los mapeos disponibles
   */
  static printMappingSummary(): void {
    console.log('\n🎯 MAPPING SUMMARY - EventLocationEnumType → MeetingCombination\n');
    
    const supported = getSupportedLocationTypes();
    const future = getFutureLocationTypes();
    
    console.log('✅ IMPLEMENTED:');
    supported.forEach(locationType => {
      const info = getLocationTypeInfo(locationType);
      console.log(`  ${locationType} → ${info.combination} (${info.description})`);
    });
    
    console.log('\n🚀 FUTURE:');
    future.forEach(locationType => {
      try {
        const info = getLocationTypeInfo(locationType);
        console.log(`  ${locationType} → ${info.combination} (${info.description})`);
      } catch (error) {
        console.log(`  ${locationType} → NOT_MAPPED`);
      }
    });
    
    console.log(`\nTOTAL: ${supported.length} implemented, ${future.length} future\n`);
  }
  
  /**
   * Valida que todos los EventLocationEnumType están mapeados
   */
  static validateAllLocationTypesMapped(): boolean {
    const allLocationTypes = Object.values(EventLocationEnumType);
    const unmapped: string[] = [];
    
    allLocationTypes.forEach(locationType => {
      try {
        mapLocationTypeToCombination(locationType);
      } catch {
        unmapped.push(locationType);
      }
    });
    
    if (unmapped.length > 0) {
      console.warn('⚠️ UNMAPPED LOCATION TYPES:', unmapped);
      return false;
    }
    
    console.log('✅ All EventLocationEnumType are properly mapped');
    return true;
  }
}