// export enum EventLocationEnumType {
//   GOOGLE_MEET_AND_CALENDAR = 'GOOGLE_MEET_AND_CALENDAR',
//   ZOOM_MEETING = 'ZOOM_MEETING',
//   OUTLOOK_WITH_ZOOM = 'OUTLOOK_WITH_ZOOM', 
//   OUTLOOK_WITH_TEAMS = 'OUTLOOK_WITH_TEAMS',
// }
export enum EventLocationEnumType {
  GOOGLE_MEET_AND_CALENDAR = 'GOOGLE_MEET_AND_CALENDAR',
  GOOGLE_WITH_ZOOM = 'GOOGLE_WITH_ZOOM',        // ✅ Zoom + Google explícito
  OUTLOOK_WITH_ZOOM = 'OUTLOOK_WITH_ZOOM',      // ✅ Zoom + Outlook explícito
  OUTLOOK_WITH_TEAMS = 'OUTLOOK_WITH_TEAMS',
  // ZOOM_MEETING = 'ZOOM_MEETING',             // ❌ ELIMINAR - era ambiguo
}