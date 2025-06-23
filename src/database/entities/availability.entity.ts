import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
// import { User } from "./user.entity";
// import { DayAvailability } from "./day-availability";

@Entity()
export class Availability {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // @OneToOne(() => User, (user) => user.availability)
  // user: User;
  @OneToOne('User', 'availability')
  user: any;

  // @OneToMany(
  //   () => DayAvailability,
  //   (dayAvailability) => dayAvailability.availability,
  //   {
  //     cascade: true,
  //   }
  // )
  // days: DayAvailability[];

  @OneToMany('DayAvailability', 'availability', {
    cascade: true,
  })
  days: any[];

  @Column({ default: 30 })
  timeGap: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
