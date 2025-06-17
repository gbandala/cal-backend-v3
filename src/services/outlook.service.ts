import { BadRequestException } from "../utils/app-error";

/**
 * SERVICIO DE OUTLOOK/MICROSOFT GRAPH
 * 
 * Proporciona funcionalidades para:
 * - Autenticación OAuth con Microsoft Graph
 * - Gestión de calendarios de Outlook
 * - Creación de eventos en calendarios de Outlook
 * - Validación y renovación de tokens
 */

interface OutlookCalendar {
  id: string;
  name: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
}

interface OutlookEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  attendeeEmail: string;
  organizerEmail: string;
  zoomJoinUrl?: string; // Para eventos de Outlook + Zoom
}

interface OutlookEvent {
  id: string;
  webLink: string;
}

/**
 * Obtiene calendarios disponibles del usuario desde Microsoft Graph
 * @param accessToken - Token de acceso válido de Microsoft
 * @returns Array de calendarios disponibles
 */
export const getOutlookCalendars = async (accessToken: string): Promise<OutlookCalendar[]> => {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Failed to fetch Outlook calendars: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    return data.value.map((calendar: any) => ({
      id: calendar.id,
      name: calendar.name,
      isDefaultCalendar: calendar.isDefaultCalendar || false,
      canEdit: calendar.canEdit || false
    }));

  } catch (error) {
    console.error('Error fetching Outlook calendars:', error);
    throw new BadRequestException('Failed to fetch Outlook calendars');
  }
};

/**
 * Crea un evento en el calendario de Outlook especificado
 * @param accessToken - Token de acceso válido de Microsoft
 * @param calendarId - ID del calendario donde crear el evento
 * @param eventData - Datos del evento a crear
 * @returns Información del evento creado
 */
export const createOutlookEvent = async (
  accessToken: string, 
  calendarId: string, 
  eventData: OutlookEventData
): Promise<OutlookEvent> => {
  try {
    // Formatear descripción con link de Zoom si está presente
    let description = eventData.description || '';
    if (eventData.zoomJoinUrl) {
      description += `\n\nUnirse a la reunión Zoom: ${eventData.zoomJoinUrl}`;
    }

    const requestBody = {
      subject: eventData.title,
      body: {
        contentType: 'Text',
        content: description
      },
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timezone
      },
      end: {
        dateTime: eventData.endTime.toISOString(), 
        timeZone: eventData.timezone
      },
      attendees: [
        {
          emailAddress: {
            address: eventData.attendeeEmail,
            name: eventData.attendeeEmail.split('@')[0] // Nombre básico del email
          },
          type: 'required'
        }
      ],
      // No incluimos onlineMeeting para Outlook + Zoom ya que usamos Zoom externamente
      isOnlineMeeting: false
    };

    console.log('Creating Outlook event with data:', {
      calendarId,
      subject: requestBody.subject,
      attendees: requestBody.attendees.length
    });

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Outlook event creation failed:', error);
      throw new BadRequestException(`Failed to create Outlook event: ${error.error?.message || 'Unknown error'}`);
    }

    const event = await response.json();
    
    console.log('Outlook event created successfully:', {
      id: event.id,
      subject: event.subject
    });

    return {
      id: event.id,
      webLink: event.webLink
    };

  } catch (error) {
    console.error('Error creating Outlook event:', error);
    throw error instanceof BadRequestException ? error : new BadRequestException('Failed to create Outlook event');
  }
};

/**
 * Elimina un evento del calendario de Outlook
 * @param accessToken - Token de acceso válido de Microsoft
 * @param eventId - ID del evento a eliminar
 */
export const deleteOutlookEvent = async (accessToken: string, eventId: string): Promise<void> => {
  try {
    console.log('Deleting Outlook event:', eventId);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Outlook event deletion failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Si el evento no existe (404), considerarlo como éxito
      if (response.status === 404) {
        console.log('Outlook event not found (may have been deleted already)');
        return;
      }
      
      throw new BadRequestException(`Failed to delete Outlook event: ${response.statusText}`);
    }

    console.log('Outlook event deleted successfully');

  } catch (error) {
    console.error('Error deleting Outlook event:', error);
    throw error instanceof BadRequestException ? error : new BadRequestException('Failed to delete Outlook event');
  }
};

/**
 * Valida y renueva token de Microsoft si es necesario
 * @param accessToken - Token actual de acceso
 * @param refreshToken - Token de renovación
 * @param expiryDate - Fecha de expiración del token (timestamp)
 * @returns Token válido (actual o renovado)
 */
export const validateMicrosoftToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
): Promise<string> => {
  // Verificar si el token está expirado (con 5 minutos de margen)
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
  
  if (expiryDate === null || fiveMinutesFromNow >= expiryDate) {
    console.log('Microsoft token expired, refreshing...');
    
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: process.env.MICROSOFT_SCOPE!
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BadRequestException(`Failed to refresh Microsoft token: ${error.error_description || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Microsoft token refreshed successfully');
      
      return data.access_token;

    } catch (error) {
      console.error('Error refreshing Microsoft token:', error);
      throw new BadRequestException('Failed to refresh Microsoft token');
    }
  }

  // Token aún válido
  return accessToken;
};

/**
 * Obtiene información del usuario desde Microsoft Graph
 * @param accessToken - Token de acceso válido
 * @returns Información básica del usuario
 */
export const getMicrosoftUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Failed to fetch user info: ${error.error?.message || 'Unknown error'}`);
    }

    const userInfo = await response.json();
    
    return {
      id: userInfo.id,
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
      givenName: userInfo.givenName,
      surname: userInfo.surname
    };

  } catch (error) {
    console.error('Error fetching Microsoft user info:', error);
    throw new BadRequestException('Failed to fetch user info');
  }
};