import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../config/database.config";
import { LoginDto, RegisterDto } from "../database/dto/auth.dto";
import { User } from "../database/entities/user.entity";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/app-error";
import { Availability } from "../database/entities/availability.entity";
import {
  DayAvailability,
  DayOfWeekEnum,
} from "../database/entities/day-availability";
import { signJwtToken } from "../utils/jwt";

/**
 * FUNCIÓN AUXILIAR: Crear fecha con hora específica en timezone dado
 * 
 * @param hour - Hora en formato 24h (ej: 9 para 9 AM, 17 para 5 PM)
 * @param minute - Minutos (opcional, default 0)
 * @param timezone - Timezone (ej: 'America/Mexico_City', 'Europe/Madrid')
 * @returns Date - Fecha con la hora especificada en el timezone
 */
function createTimeInTimezone(hour: number, minute: number = 0, timezone: string): Date {
  // Crear fecha base (usar fecha fija para consistencia, solo importa la hora)
  const baseDate = new Date('2025-03-01');

  // Si el timezone es UTC, usar directamente
  if (timezone === 'UTC' || timezone === 'Z') {
    return new Date(`2025-03-01T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00Z`);
  }

  // Para otros timezones, usar Intl.DateTimeFormat para obtener el offset
  try {
    // Crear fecha en el timezone especificado
    const tempDate = new Date('2025-03-01T12:00:00Z');

    // Obtener el offset del timezone
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    });

    const parts = formatter.formatToParts(tempDate);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');

    if (offsetPart && offsetPart.value.includes('GMT')) {
      // Parsear offset (ej: "GMT-6" -> -6)
      const offsetMatch = offsetPart.value.match(/GMT([+-]\d{1,2})/);
      if (offsetMatch) {
        const offsetHours = parseInt(offsetMatch[1]);
        // Crear fecha ajustada al timezone
        const utcTime = new Date(`2025-03-01T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
        utcTime.setHours(utcTime.getHours() - offsetHours);
        return utcTime;
      }
    }

    // Fallback: usar toLocaleString para obtener la hora en el timezone
    const localTime = new Date(`2025-03-01T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
    const utcTime = new Date(localTime.toLocaleString("en-US", { timeZone: "UTC" }));
    const targetTime = new Date(localTime.toLocaleString("en-US", { timeZone: timezone }));
    const diff = utcTime.getTime() - targetTime.getTime();

    return new Date(localTime.getTime() + diff);

  } catch (error) {
    console.warn(`Invalid timezone "${timezone}", falling back to UTC`);
    return new Date(`2025-03-01T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00Z`);
  }
}
/**
 * FUNCIÓN AUXILIAR: Generar sufijo aleatorio para usernames únicos
 * 
 * @returns string - Sufijo de 6 caracteres: 3 números + 3 letras
 * 
 * PROPÓSITO: Garantizar que los usernames sean únicos añadiendo aleatoriedad
 * FORMATO: "123abc", "789xyz", "456def"
 * 
 * ALGORITMO:
 * 1. Generar 3 números aleatorios (0-9)
 * 2. Generar 3 letras aleatorias (a-z)
 * 3. Concatenar números + letras
 */
function generateRandomSuffix(): string {
  // Generar 3 letras aleatorias (a-z)
  // Array.from crea array de 3 elementos
  // String.fromCharCode(97 + random) convierte a letra (97 = 'a' en ASCII)
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)) // 26 letras del alfabeto
  ).join(''); // Unir array en string

  // Generar 3 números aleatorios (0-9)
  const numbers = Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 10) // 0-9
  ).join(''); // Unir array en string

  // Formato final: números + letras (ej: "123abc")
  return numbers + letters;
}

/**
 * SERVICIO PRINCIPAL: Registro completo de nuevo usuario
 * 
 * @param registerDto - DTO con datos de registro (name, email, password, etc.)
 * @returns Objeto con usuario registrado (sin contraseña)
 * 
 * FLUJO COMPLETO DE REGISTRO:
 * 1. Validar que email no esté en uso
 * 2. Generar username único
 * 3. Crear entidad de usuario
 * 4. Crear disponibilidad predeterminada (L-V 9AM-5PM) en timezone
 * 5. Relacionar usuario con disponibilidad
 * 6. Persistir en base de datos
 * 7. Retornar usuario seguro (sin password)
 */
export const registerService = async (registerDto: RegisterDto, timezone: string = 'UTC') => {
  // Obtener repositorios necesarios para las operaciones de BD
  const userRepository = AppDataSource.getRepository(User);
  const availabilityRepository = AppDataSource.getRepository(Availability);
  const dayAvailabilityRepository = AppDataSource.getRepository(DayAvailability);

  // PASO 1: Verificar que el email no esté registrado
  const existingUser = await userRepository.findOne({
    where: { email: registerDto.email },
  });

  if (existingUser) {
    console.log('User already exists:', registerDto.email);
    throw new BadRequestException("User already exists");
  }

  // PASO 2: Generar username único basado en el nombre
  const username = await generateUsername(registerDto.name);
  console.log("Generated username:", username);

  // PASO 3: Crear entidad de usuario con datos del DTO + username generado
  const user = userRepository.create({
    ...registerDto, // Spread de todos los campos del DTO (name, email, password, etc.)
    username,       // Username generado automáticamente
    timezone
  });
  // console.log("User created:", user);
  // const dayAvailability = new DayAvailability();
  // dayAvailability.startTime = "09:00";
  // dayAvailability.endTime = "17:30";

  // PASO 4: Crear configuración de disponibilidad predeterminada
  const availability = availabilityRepository.create({
    timeGap: 30, // Intervalo predeterminado de 30 minutos entre citas
    // Crear configuración para todos los días de la semana
    days: Object.values(DayOfWeekEnum).map((day) => {
      return dayAvailabilityRepository.create({
        day: day, // Día específico (MONDAY, TUESDAY, etc.)
        // Horarios predeterminados: 9:00 AM - 5:00 PM UTC
        // startTime : createTimeInTimezone(9, 0, timezone),  // 9:00 AM de la zona horaria del usuario
        // endTime : createTimeInTimezone(17, 0, timezone),  // 5:00 PM de la zona horaria del usuario
        startTime: '09:00',  // 9:00 AM de la zona horaria del usuario
        endTime: '17:00',  // 5:00 PM de la zona horaria del usuario
        // Disponible de lunes a viernes, fines de semana libres
        isAvailable: day !== DayOfWeekEnum.SUNDAY && day !== DayOfWeekEnum.SATURDAY,
      });
    }),
  });
  // PASO 5: Establecer relación entre usuario y su disponibilidad
  user.availability = availability;
  // PASO 6: Persistir todo en base de datos
  // TypeORM guardará automáticamente las entidades relacionadas (cascade)
  await userRepository.save(user);
  // PASO 7: Retornar usuario sin información sensible
  // omitPassword() es método del modelo User que remueve el campo password
  return { user: user.omitPassword() };
};

/**
 * SERVICIO PRINCIPAL: Autenticación de usuario existente
 * 
 * @param loginDto - DTO con credenciales (email, password)
 * @returns Objeto con usuario, token JWT y tiempo de expiración
 * 
 * FLUJO DE AUTENTICACIÓN:
 * 1. Buscar usuario por email
 * 2. Validar que existe
 * 3. Verificar contraseña
 * 4. Generar token JWT
 * 5. Retornar sesión completa
 */
export const loginService = async (loginDto: LoginDto) => {
  const userRepository = AppDataSource.getRepository(User);

  // PASO 1: Buscar usuario por email
  const user = await userRepository.findOne({
    where: { email: loginDto.email },
  });

  // PASO 2: Validar existencia del usuario
  if (!user) {
    console.log('user not found:', loginDto.email);
    throw new NotFoundException("User not found");
  }

  // PASO 3: Verificar contraseña usando método seguro del modelo
  // comparePassword() debería usar bcrypt u otra librería de hashing
  const isPasswordValid = await user.comparePassword(loginDto.password);

  if (!isPasswordValid) {
    console.log('invalid password for user:', user.email);
    // Error genérico para evitar revelar si el email existe
    throw new UnauthorizedException("Invalid email/password");
  }

  // PASO 4: Generar token JWT con payload del usuario
  const { token, expiresAt } = signJwtToken({ userId: user.id });

  console.log("user logged in:", user.omitPassword());
  // PASO 5: Retornar sesión completa
  return {
    user: user.omitPassword(), // Usuario sin contraseña
    accessToken: token,        // Token para autenticación de API calls
    expiresAt,                // Timestamp de expiración del token
  };
};

/**
 * FUNCIÓN AUXILIAR: Generar username único basado en el nombre del usuario
 * 
 * @param name - Nombre completo del usuario
 * @returns Promise<string> - Username único y válido
 * 
 * PROCESO DE GENERACIÓN:
 * 1. Limpiar nombre (remover caracteres especiales)
 * 2. Convertir a minúsculas
 * 3. Limitar longitud para evitar usernames excesivamente largos
 * 4. Añadir sufijo aleatorio para garantizar unicidad
 * 5. Manejar casos edge (nombres vacíos, caracteres especiales)
 */
async function generateUsername(name: string): Promise<string> {
  try {
    // PASO 1: Limpiar y normalizar el nombre
    const cleanName = name
      .replace(/[^a-zA-Z0-9]/g, '') // Eliminar espacios, acentos, símbolos, etc.
      .toLowerCase()                // Convertir a minúsculas para consistencia
      .slice(0, 20);               // Limitar a 20 caracteres máximo

    // PASO 2: Crear base del username con fallback
    // Si después de limpiar queda vacío, usar 'user' como fallback
    const baseUsername = cleanName || 'user';

    // PASO 3: Añadir sufijo aleatorio para garantizar unicidad
    // No necesita verificar BD porque el sufijo aleatorio hace prácticamente
    // imposible las colisiones (26^3 * 10^3 = 17,576,000 combinaciones)
    let username = `${baseUsername}${generateRandomSuffix()}`;

    return username;

  } catch (error) {
    // Manejo de errores: logging + excepción controlada
    console.error("Error generating username:", error);
    throw new BadRequestException("Error generating username");
  }
}
