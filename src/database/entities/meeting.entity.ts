import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Event } from "./event.entity";
import { IntegrationAppTypeEnum } from "./integration.entity";

export enum MeetingStatus {
  SCHEDULED = "SCHEDULED",
  CANCELLED = "CANCELLED",
}

@Entity({ name: "meetings" })
export class Meeting {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.meetings)
  user: User;

  @ManyToOne(() => Event, (event) => event.meetings)
  event: Event;

  @Column()
  guestName: string;

  @Column()
  guestEmail: string;

  @Column({ nullable: true })
  additionalInfo: string;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column()
  meetLink: string;

  @Column()
  calendarEventId: string;

  @Column()
  calendarAppType: string;


  // *** NUEVO CAMPO PARA CALENDARIO ***
  @Column({
    name: 'calendar_id',
    type: 'varchar',
    default: 'primary',
    nullable: true
  })
  calendar_id?: string;
  // *** FIN NUEVO CAMPO ***

  // AGREGAR campos de Zoom:
  @Column({ name: 'zoom_meeting_id', type: 'bigint', nullable: true })
  zoom_meeting_id?: number;

  @Column({ name: 'zoom_join_url', type: 'varchar', nullable: true })
  zoom_join_url?: string;

  @Column({ name: 'zoom_start_url', type: 'varchar', nullable: true })
  zoom_start_url?: string;

  @Column({
    type: "enum",
    enum: MeetingStatus,
    default: MeetingStatus.SCHEDULED,
  })
  status: MeetingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
