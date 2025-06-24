/**
 * 🏭 FACTORY PARA CREAR ESTRATEGIAS DE MEETING
 * 
 * Este factory determina qué estrategia usar según el EventLocationEnumType
 * y crea la instancia correspondiente con sus dependencias.
 */

// import { EventLocationEnumType } from "../../database/entities/event.entity";
import { EventLocationEnumType } from "../../enums/EventLocationEnum";
import { IMeetingStrategy } from "./interfaces/meeting-strategy.interface";
import { 
  MeetingCombination, 
  CombinationUtils 
} from "./types/meeting-combination.types";
import { 
  mapLocationTypeToCombination, 
  isLocationTypeSupported,
  getLocationTypeInfo 
} from "./types/meeting-combination.mapper";
import { BadRequestException } from "../../utils/app-error";

// ✅ IMPORTS DE ESTRATEGIAS IMPLEMENTADAS
import { ZoomOutlookCalendarStrategy } from "./strategies/zoom-outlook-calendar.strategy";
import { ZoomGoogleCalendarStrategy } from "./strategies/zoom-google-calendar.strategy"; // 🆕 AÑADIR

/**
 * Factory principal para crear estrategias de meeting
 */
export class MeetingStrategyFactory {
  
  constructor(
    // ✅ ESTRATEGIA IMPLEMENTADA
    private zoomOutlookCalendarStrategy: ZoomOutlookCalendarStrategy,
    private zoomGoogleCalendarStrategy: ZoomGoogleCalendarStrategy, // 🆕 AÑADIR
  ) {}

  /**
   * Crea la estrategia apropiada según el tipo de ubicación del evento
   * 
   * @param locationType - Tipo de ubicación del evento
   * @returns Estrategia correspondiente
   * @throws BadRequestException si el tipo no está soportado o implementado
   */
  createStrategy(locationType: EventLocationEnumType): IMeetingStrategy {
    // 1. Validar que el tipo está soportado
    if (!isLocationTypeSupported(locationType)) {
      const info = this.getDetailedErrorInfo(locationType);
      throw new BadRequestException(
        `Location type '${locationType}' is not supported or not implemented yet. ` +
        `Supported types: ${this.getSupportedLocationTypesString()}. ${info}`
      );
    }

    // 2. Mapear a combinación
    const combination = mapLocationTypeToCombination(locationType);
    
    // 3. Crear estrategia según combinación
    return this.createStrategyByCombination(combination, locationType);
  }

  /**
   * Crea estrategia según MeetingCombination (método interno)
   */
  private createStrategyByCombination(
    combination: MeetingCombination, 
    locationType: EventLocationEnumType
  ): IMeetingStrategy {
    
    switch (combination) {
      case MeetingCombination.GOOGLE_MEET_CALENDAR:
        // return this.googleMeetCalendarStrategy;
        throw new BadRequestException('GoogleMeetCalendarStrategy will be migrated in Fase 3');
      
      case MeetingCombination.ZOOM_GOOGLE_CALENDAR:
        return this.zoomGoogleCalendarStrategy; 
      
      case MeetingCombination.ZOOM_OUTLOOK_CALENDAR:
        // ✅ IMPLEMENTADA - Esta ya funciona!
        return this.zoomOutlookCalendarStrategy;
      
      case MeetingCombination.TEAMS_OUTLOOK_CALENDAR:
        // return this.teamsOutlookCalendarStrategy;
        throw new BadRequestException(
          'TeamsOutlookCalendarStrategy is planned for future implementation'
        );
      
      default:
        throw new BadRequestException(
          `No strategy implementation found for combination: ${combination} ` +
          `(location type: ${locationType})`
        );
    }
  }

  /**
   * Verifica si una combinación está soportada e implementada
   */
  isCombinationSupported(locationType: EventLocationEnumType): boolean {
    return isLocationTypeSupported(locationType);
  }

  /**
   * Obtiene la configuración de una combinación
   */
  getCombinationConfig(locationType: EventLocationEnumType) {
    try {
      const combination = mapLocationTypeToCombination(locationType);
      return CombinationUtils.getConfig(combination);
    } catch (error) {
      throw new BadRequestException(
        `Cannot get configuration for location type: ${locationType}. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Obtiene información detallada sobre un tipo de ubicación
   */
  getLocationTypeInfo(locationType: EventLocationEnumType) {
    try {
      return getLocationTypeInfo(locationType);
    } catch (error) {
      throw new BadRequestException(
        `Cannot get info for location type: ${locationType}. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Lista todos los tipos de ubicación soportados actualmente
   */
  getSupportedLocationTypes(): EventLocationEnumType[] {
    return Object.values(EventLocationEnumType).filter(isLocationTypeSupported);
  }

  /**
   * Lista todos los tipos de ubicación que serán soportados en el futuro
   */
  getFutureLocationTypes(): EventLocationEnumType[] {
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
   * Valida que todas las integraciones requeridas están disponibles para un usuario
   */
  async validateRequiredIntegrations(
    locationType: EventLocationEnumType, 
    userId: string
  ): Promise<{
    isValid: boolean;
    missingIntegrations: string[];
    config: any;
  }> {
    try {
      const config = this.getCombinationConfig(locationType);
      
      // 🚀 TODO: En Fase 2, aquí verificaremos las integraciones reales
      // const missingIntegrations = await this.checkUserIntegrations(userId, config.requiredIntegrations);
      
      // Por ahora, simulamos que todas las integraciones están disponibles
      const missingIntegrations: string[] = [];
      
      return {
        isValid: missingIntegrations.length === 0,
        missingIntegrations,
        config
      };
    } catch (error) {
      return {
        isValid: false,
        missingIntegrations: ['VALIDATION_ERROR'],
        config: null
      };
    }
  }

  // ============================================
  // 🔧 MÉTODOS HELPER PRIVADOS
  // ============================================

  private getSupportedLocationTypesString(): string {
    return this.getSupportedLocationTypes().join(', ');
  }

  private getDetailedErrorInfo(locationType: EventLocationEnumType): string {
    try {
      const info = getLocationTypeInfo(locationType);
      if (!info.isImplemented) {
        return `This combination (${info.combination}) is planned for future implementation.`;
      }
      return `Combination: ${info.combination}, Required integrations: ${info.requiredIntegrations.join(', ')}`;
    } catch {
      return `This location type is not mapped to any meeting combination.`;
    }
  }

  
}