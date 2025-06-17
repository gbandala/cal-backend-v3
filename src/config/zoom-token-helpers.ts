/**
 * HELPERS PARA VERIFICAR Y MANEJAR TOKENS DE ZOOM
 */

/**
 * Verificar si un token tiene los scopes necesarios
 */
export async function verifyZoomTokenScopes(accessToken: string): Promise<{
  hasDeleteScope: boolean;
  currentScopes: string[];
  missingScopes: string[];
}> {
  try {
    // Hacer request para obtener info del token actual
    const response = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    // Para obtener los scopes actuales, necesitamos verificar cada scope individualmente
    // o usar el endpoint de token info (si está disponible)
    const requiredScopes = [
      'user:read:user',
      'meeting:read:meeting',
      'meeting:write:meeting',
      'meeting:update:meeting',
      'meeting:delete:meeting',  // 👈 Scope crítico para delete
      'zoomapp:inmeeting'
    ];

    // Verificar si puede hacer DELETE de meetings
    const testResponse = await fetch('https://api.zoom.us/v2/meetings/test123', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const hasDeleteScope = testResponse.status !== 401 || 
      !testResponse.statusText.includes('scopes');

    return {
      hasDeleteScope,
      currentScopes: requiredScopes, // Placeholder - Zoom no expone scopes directamente
      missingScopes: hasDeleteScope ? [] : ['meeting:delete:meeting']
    };

  } catch (error) {
    console.error('Error verifying token scopes:', error);
    return {
      hasDeleteScope: false,
      currentScopes: [],
      missingScopes: ['meeting:delete:meeting']
    };
  }
}

/**
 * Construir URL de reautorización para obtener scopes faltantes
 */
export function buildZoomReauthUrl(
  clientId: string, 
  redirectUri: string,
  currentUserId?: string
): string {
  const scopes = [
    'user:read:user',
    'meeting:read:meeting',
    'meeting:write:meeting',
    'meeting:update:meeting',
    'meeting:delete:meeting',
    'zoomapp:inmeeting'
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: currentUserId || 'reauth', // Para identificar reautorización
  });

  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

/**
 * Función mejorada para eliminar meeting con mejor manejo de errores
 */
export async function deleteZoomMeetingWithValidation(
  accessToken: string,
  meetingId: string
): Promise<{ success: boolean; error?: string; needsReauth?: boolean }> {
  try {
    // Primero verificar scopes
    const scopeCheck = await verifyZoomTokenScopes(accessToken);
    
    if (!scopeCheck.hasDeleteScope) {
      return {
        success: false,
        error: 'Missing required scope: meeting:delete:meeting',
        needsReauth: true
      };
    }

    // Proceder con la eliminación
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return { success: true };
    }

    // Manejar errores específicos
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 401) {
      return {
        success: false,
        error: 'Token expired or invalid',
        needsReauth: true
      };
    }

    if (response.status === 400 && errorData.message?.includes('scopes')) {
      return {
        success: false,
        error: 'Missing required scopes for deletion',
        needsReauth: true
      };
    }

    return {
      success: false,
      error: errorData.message || 'Failed to delete meeting'
    };

  } catch (error) {
    console.error('Error deleting Zoom meeting:', error);
    return {
      success: false,
      error: 'Network error during deletion'
    };
  }
}