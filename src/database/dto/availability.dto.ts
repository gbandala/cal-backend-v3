import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";
import { DayOfWeekEnum } from "../entities/day-availability";
import { Type } from "class-transformer";

export class DayAvailabilityDto {
  @IsEnum(DayOfWeekEnum)
  @IsNotEmpty()
  day: DayOfWeekEnum;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:MM format (e.g., 09:00, 17:30)'
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:MM format (e.g., 09:00, 17:30)'
  })
  endTime: string;


  @IsBoolean()
  @IsNotEmpty()
  isAvailable: boolean;
}

export class UpdateAvailabilityDto {
  @IsNumber()
  @IsNotEmpty()
  timeGap: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayAvailabilityDto)
  days: DayAvailabilityDto[];
}
