import { UserRole } from '../../../domain/identity/enums/user-role.enum';
import { RegisterCustomerDto } from './RegisterCustomerDto';
import { RegisterDriverDto } from './RegisterDriverDto';

export interface RegisterUserDto {
  role: UserRole;
  customer?: RegisterCustomerDto;
  driver?: RegisterDriverDto;
}
