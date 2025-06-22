/**
 * 🎥 ZOOM MEETING PROVIDER
 * 
 * Este provider maneja todas las operaciones de Zoom API.
 * Implementa la interfaz IMeetingProvider para operaciones estándar.
 */

import { 
  IMeetingProvider, 
  MeetingConfig, 
  MeetingInfo,
  MeetingOperationResult 
} from "../interfaces/meeting-provider.interface";
import{TokenConfig} from "../../../services/meeting/interfaces/calendar-provider.interface";
import { validateZoomToken } from "../../integration.service";
import { 
  deleteZoomMeetingWithValidation, 
  buildZoomReauthUrl 
} from "../../../config/zoom-token-helpers";
import { zoomOAuth2Client } from "../../../config/oauth.config";
import { BadRequestException } from "../../../utils/app-error";

export class ZoomMeetingProvider implements IMeetingProvider {

  /**
   * Crea un meeting en Zoom
   */
  async createMeeting(config: MeetingConfig, tokenConfig: TokenConfig): Promise<MeetingInfo> {
    console.log('🎥 [ZOOM] Creating meeting:', {
      topic: config.topic,
      startTime: config.startTime,
      duration: Math.ceil((config.endTime.getTime() - config.startTime.getTime()) / (1000 * 60)),
      timezone: config.timezone
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Preparar datos del meeting
      const meetingData = this.prepareMeetingData(config);

      // 3. Crear meeting en Zoom API
      const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      });

      const meeting = await response.json();

      if (!response.ok) {
        throw new BadRequestException(`Zoom API error: ${meeting.message || 'Unknown error'}`);
      }

      // 4. Validar respuesta
      if (!meeting.join_url || !meeting.start_url) {
        console.warn('⚠️ [ZOOM] Meeting missing URLs:', meeting);
      }

      const meetingInfo: MeetingInfo = {
        id: meeting.id,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        passcode: meeting.password,
        dialInNumbers: meeting.dial_in_numbers?.map((dialIn: any) => ({
          country: dialIn.country_name,
          number: dialIn.number,
          type: dialIn.type === 'toll' ? 'toll' : 'toll_free'
        })),
        additionalData: {
          uuid: meeting.uuid,
          hostId: meeting.host_id,
          duration: meeting.duration,
          settings: meeting.settings,
          agenda: meeting.agenda
        }
      };

      console.log('✅ [ZOOM] Meeting created successfully:', {
        meetingId: meetingInfo.id,
        joinUrl: meetingInfo.joinUrl ? '✅' : '❌',
        startUrl: meetingInfo.startUrl ? '✅' : '❌'
      });

      return meetingInfo;

    } catch (error) {
      console.error('❌ [ZOOM] Failed to create meeting:', {
        error: error instanceof Error ? error.message : String(error),
        topic: config.topic
      });
      
      throw new BadRequestException(
        `Failed to create Zoom meeting: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Elimina un meeting de Zoom
   */
  async deleteMeeting(
    meetingId: string | number, 
    tokenConfig: TokenConfig, 
    userId?: string
  ): Promise<void> {
    console.log('🗑️ [ZOOM] Deleting meeting:', {
      meetingId,
      userId
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Usar helper existente para eliminar con validación
      const deleteResult = await deleteZoomMeetingWithValidation(
        validToken,
        meetingId.toString()
      );

      if (!deleteResult.success) {
        if (deleteResult.needsReauth && userId) {
          const reauthUrl = buildZoomReauthUrl(
            zoomOAuth2Client.clientId,
            zoomOAuth2Client.redirectUri,
            userId
          );

          throw new BadRequestException(
            `Missing required permissions for Zoom. User needs to reauthorize: ${reauthUrl}`
          );
        } else {
          throw new BadRequestException(
            `Failed to delete Zoom meeting: ${deleteResult.error}`
          );
        }
      }

      console.log('✅ [ZOOM] Meeting deleted successfully:', {
        meetingId
      });

    } catch (error) {
      console.error('❌ [ZOOM] Failed to delete meeting:', {
        error: error instanceof Error ? error.message : String(error),
        meetingId
      });

      // Ser permisivo con ciertos errores - el meeting podría ya estar eliminado
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.isMeetingNotFoundError(errorMessage)) {
        console.log('ℹ️ [ZOOM] Meeting already deleted or not found - continuing');
        return;
      }

      throw error; // Re-lanzar si no es un error de "not found"
    }
  }

  /**
   * Valida y refresca el token de Zoom
   */
  async validateAndRefreshToken(tokenConfig: TokenConfig): Promise<string> {
    try {
      return await validateZoomToken(
        tokenConfig.accessToken,
        tokenConfig.refreshToken,
        tokenConfig.expiryDate
      );
    } catch (error) {
      console.error('❌ [ZOOM] Token validation failed:', error);
      throw new BadRequestException(
        `Zoom token validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retorna el tipo de este proveedor
   */
  getProviderType(): string {
    return 'zoom';
  }

  /**
   * Verifica si el usuario puede crear meetings
   */
  async canCreateMeetings(userId: string, tokenConfig: TokenConfig): Promise<boolean> {
    try {
      // Intentar validar token como prueba básica
      await this.validateAndRefreshToken(tokenConfig);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene información de un meeting existente (implementación opcional)
   */
  async getMeetingInfo(
    meetingId: string | number, 
    tokenConfig: TokenConfig
  ): Promise<MeetingInfo | null> {
    try {
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Meeting no encontrado
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const meeting = await response.json();

      return {
        id: meeting.id,
        joinUrl: meeting.join_url,
        startUrl: meeting.start_url,
        passcode: meeting.password,
        additionalData: {
          uuid: meeting.uuid,
          hostId: meeting.host_id,
          duration: meeting.duration,
          settings: meeting.settings
        }
      };

    } catch (error) {
      console.warn('⚠️ [ZOOM] Could not get meeting info:', error);
      return null;
    }
  }

  // ============================================
  // 🔧 MÉTODOS HELPER PRIVADOS
  // ============================================

  /**
   * Prepara los datos del meeting para Zoom API
   */
  private prepareMeetingData(config: MeetingConfig) {
    const duration = Math.ceil((config.endTime.getTime() - config.startTime.getTime()) / (1000 * 60));

    return {
      topic: config.topic,
      type: 2, // Scheduled meeting
      start_time: config.startTime.toISOString(),
      duration: duration,
      timezone: config.timezone,
      agenda: config.agenda || '',
      settings: {
        // Configuraciones por defecto
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true,
        mute_upon_entry: false,
        auto_recording: 'none',
        // Sobrescribir con configuraciones personalizadas
        ...config.settings
      }
    };
  }

  /**
   * Verifica si un error indica que el meeting no existe
   */
  private isMeetingNotFoundError(errorMessage: string): boolean {
    const notFoundIndicators = [
      'does not exist',
      'not found',
      'meeting not found',
      'invalid meeting id',
      '404'
    ];

    return notFoundIndicators.some(indicator => 
      errorMessage.toLowerCase().includes(indicator)
    );
  }

  /**
   * Construye configuraciones por defecto para meetings
   */
  private getDefaultMeetingSettings() {
    return {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      waiting_room: true,
      mute_upon_entry: false,
      auto_recording: 'none',
      alternative_hosts: '',
      approval_type: 2, // Manual approval
      registration_type: 1, // Attendees register once
      password: '', // Zoom generará automáticamente
      use_pmi: false // No usar Personal Meeting ID
    };
  }

  /**
   * Valida la configuración del meeting antes de crear
   */
  private validateMeetingConfig(config: MeetingConfig): void {
    if (!config.topic || config.topic.trim().length === 0) {
      throw new BadRequestException('Meeting topic is required');
    }

    if (config.endTime <= config.startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const duration = (config.endTime.getTime() - config.startTime.getTime()) / (1000 * 60);
    if (duration > 1440) { // 24 horas
      throw new BadRequestException('Meeting duration cannot exceed 24 hours');
    }

    if (duration < 1) {
      throw new BadRequestException('Meeting duration must be at least 1 minute');
    }
  }
}