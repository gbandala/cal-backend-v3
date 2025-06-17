export const MeetingFilterEnum = {
  UPCOMING: "UPCOMING",
  PAST: "PAST",
  CANCELLED: "CANCELLED",
} as const;

export type MeetingFilterEnumType =
  (typeof MeetingFilterEnum)[keyof typeof MeetingFilterEnum];

// Para el STATUS interno en la base de datos
export enum MeetingStatus {
  SCHEDULED = "SCHEDULED",
  CANCELLED = "CANCELLED",
  // posiblemente otros como COMPLETED, etc.
}
