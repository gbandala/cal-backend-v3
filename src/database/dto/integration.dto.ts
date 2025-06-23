import { IsEnum, IsNotEmpty } from "class-validator";
// import { IntegrationAppTypeEnum } from "../entities/integration.entity";
import { IntegrationAppTypeEnum } from "../../enums/integration.enum";

export class AppTypeDTO {
  @IsEnum(IntegrationAppTypeEnum)
  @IsNotEmpty()
  appType: IntegrationAppTypeEnum;
}
