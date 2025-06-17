import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_calendars')
export class UserCalendar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'calendar_id', type: 'varchar' })
  calendarId: string;

  @Column({ name: 'calendar_name', type: 'varchar' })
  calendarName: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'access_role', type: 'varchar', nullable: true })
  accessRole: string; // 'owner', 'writer', 'reader'

  @Column({ name: 'background_color', type: 'varchar', nullable: true })
  backgroundColor: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_synced', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSynced: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => User, user => user.calendars, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}