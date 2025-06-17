-- Limpiar datos en el orden correcto (respetando foreign keys)
TRUNCATE TABLE "meetings" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "day_availability" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "user_calendars" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "events" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "integrations" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "users" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "availability" RESTART IDENTITY CASCADE;

-- Verificar que las tablas están vacías
SELECT 
    'meetings' as tabla, COUNT(*) as registros FROM "meetings"
UNION ALL SELECT 
    'day_availability', COUNT(*) FROM "day_availability"
UNION ALL SELECT 
    'user_calendars', COUNT(*) FROM "user_calendars"
UNION ALL SELECT 
    'events', COUNT(*) FROM "events"
UNION ALL SELECT 
    'integrations', COUNT(*) FROM "integrations"
UNION ALL SELECT 
    'users', COUNT(*) FROM "users"
UNION ALL SELECT 
    'availability', COUNT(*) FROM "availability";
