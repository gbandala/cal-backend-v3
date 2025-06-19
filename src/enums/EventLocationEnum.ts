// Agregar en EventLocationEnum
export enum EventLocationEnum {
    GOOGLE_MEET_AND_CALENDAR = 'GOOGLE_MEET_AND_CALENDAR',
    ZOOM_MEETING = 'ZOOM_MEETING',
    OUTLOOK_WITH_ZOOM = 'OUTLOOK_WITH_ZOOM' // ← NUEVO
}

// En IntegrationAppTypeEnum (si no existe ya)
export enum IntegrationAppTypeEnum {
    GOOGLE_MEET_AND_CALENDAR = 'GOOGLE_MEET_AND_CALENDAR',
    ZOOM_MEETING = 'ZOOM_MEETING',
    OUTLOOK_CALENDAR = 'OUTLOOK_CALENDAR',
    // OUTLOOK_WITH_ZOOM = 'OUTLOOK_WITH_ZOOM' // ← NUEVO
}