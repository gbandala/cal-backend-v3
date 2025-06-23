import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
// import { Availability } from "./availability.entity";

export enum DayOfWeekEnum {
  SUNDAY = "SUNDAY",
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
}

@Entity()
export class DayAvailability {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // @ManyToOne(() => Availability, (availability) => availability.days)
  // availability: Availability;
  @ManyToOne('Availability', 'days')
  availability: any;

  @Column({ type: "enum", enum: DayOfWeekEnum })
  day: DayOfWeekEnum;

  @Column({ type: "time" })
  startTime: string;

  @Column({ type: "time" })
  endTime: string;

  @Column({ default: true })
  isAvailable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
