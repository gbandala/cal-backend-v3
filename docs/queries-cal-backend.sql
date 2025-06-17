-- ====================================================================
-- CONSULTAS DE EJEMPLO - SLOTS DISPONIBLES
-- ====================================================================
-- Ejemplos prácticos de cómo usar las vistas creadas
-- ====================================================================

-- ====================================================================
-- 1. CONSULTAS BÁSICAS
-- ====================================================================

-- Ver todos los slots disponibles HOY
SELECT 
    user_email,
    event_title,
    slot_start_time || ' - ' || slot_end_time as horario,
    calendar_id
FROM available_slots_today
ORDER BY user_email, slot_start_time;

select * from users
-- Ver slots disponibles para un usuario específico
SELECT 
    slot_date,
    slot_start_time,
    slot_end_time,
    event_title,
    day_of_week
FROM available_slots_next_7_days 
WHERE user_email = 'dr.juan.perez@ejemplo.com'
ORDER BY slot_start_datetime;

select * from events
-- Ver slots para un tipo de evento específico
SELECT 
    user_email,
    slot_date,
    slot_start_time,
    slot_end_time
FROM available_slots_next_7_days 
WHERE event_slug = 'conferencias-c779'
ORDER BY slot_start_datetime;

-- ====================================================================
-- 2. CONSULTAS PARA FRONTEND/API
-- ====================================================================

-- API: Obtener próximos 5 slots para un usuario/evento
SELECT 
    slot_date,
    slot_start_time,
    slot_end_time,
    slot_start_datetime,
    time_category
FROM available_slots_next_30_days 
WHERE user_email = 'dr.juan.perez@ejemplo.com' 
AND event_slug = 'conferencias-c779'
ORDER BY slot_start_datetime
LIMIT 5;

-- API: Slots por día para calendario semanal
SELECT 
    slot_date,
    TO_CHAR(slot_date, 'Day') as dia_semana,
    COUNT(*) as slots_disponibles,
    MIN(slot_start_time) as primer_slot,
    MAX(slot_start_time) as ultimo_slot
FROM available_slots_next_7_days 
WHERE user_email = 'dr.juan.perez@ejemplo.com'
GROUP BY slot_date
ORDER BY slot_date;

-- API: Verificar si un slot específico está disponible
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'DISPONIBLE'
        ELSE 'NO_DISPONIBLE'
    END as disponibilidad
FROM available_slots_next_30_days
WHERE user_email = 'dr.juan.perez@ejemplo.com'
AND event_slug = 'conferencias-c779'
AND slot_date = '2024-06-10'
AND slot_start_time = '10:00:00';

-- ====================================================================
-- 3. CONSULTAS PARA DASHBOARD ADMINISTRATIVO
-- ====================================================================

-- Dashboard: Resumen de disponibilidad por usuario
SELECT 
    user_email,
    total_slots_disponibles,
    slots_hoy,
    slots_esta_semana,
    primera_fecha_disponible
FROM user_availability_summary
ORDER BY total_slots_disponibles DESC;

-- Dashboard: Usuarios con más disponibilidad HOY
SELECT 
    user_email,
    COUNT(*) as slots_hoy,
    MIN(slot_start_time) as primer_horario,
    MAX(slot_start_time) as ultimo_horario
FROM available_slots_today
GROUP BY user_email
ORDER BY slots_hoy DESC;

-- Dashboard: Horarios más populares (con más slots disponibles)
SELECT 
    slot_start_time,
    COUNT(*) as total_slots_disponibles,
    COUNT(DISTINCT user_email) as usuarios_disponibles,
    STRING_AGG(DISTINCT user_email, ', ') as usuarios
FROM available_slots_next_7_days
GROUP BY slot_start_time
ORDER BY total_slots_disponibles DESC;

-- Dashboard: Eventos con más disponibilidad
SELECT 
    event_title,
    event_slug,
    COUNT(*) as slots_disponibles,
    COUNT(DISTINCT user_email) as usuarios_que_ofrecen
FROM available_slots_next_7_days
GROUP BY event_title, event_slug
ORDER BY slots_disponibles DESC;

-- ====================================================================
-- 4. CONSULTAS POR HORARIOS Y PERÍODOS
-- ====================================================================

-- Slots disponibles solo en la MAÑANA
SELECT 
    user_email,
    slot_date,
    slot_start_time,
    event_title
FROM available_slots_by_time_range
WHERE time_period = 'MAÑANA'
ORDER BY user_email, slot_date, slot_start_time;

-- Slots disponibles en HORARIO ESPECÍFICO
SELECT 
    user_email,
    slot_date,
    slot_start_time,
    event_title
FROM available_slots_next_7_days
WHERE slot_start_time BETWEEN '09:00:00' AND '11:00:00'
ORDER BY user_email, slot_date, slot_start_time;

-- Contar slots por período del día
SELECT 
    time_period,
    COUNT(*) as total_slots,
    COUNT(DISTINCT user_email) as usuarios_disponibles
FROM available_slots_by_time_range
GROUP BY time_period
ORDER BY total_slots DESC;

-- ====================================================================
-- 5. CONSULTAS AVANZADAS CON JOINS
-- ====================================================================

-- Combinar con información del usuario
SELECT 
    u.name as nombre_doctor,
    u.email,
    s.event_title,
    s.slot_date,
    s.slot_start_time,
    s.calendar_id
FROM available_slots_next_7_days s
JOIN users u ON s.user_email = u.email
WHERE s.slot_date = CURRENT_DATE
ORDER BY u.name, s.slot_start_time;

-- ====================================================================
-- 6. CONSULTAS PARA NOTIFICACIONES Y ALERTAS
-- ====================================================================

-- Usuarios sin slots disponibles HOY
SELECT 
    u.email as user_email,
    u.name,
    'SIN_SLOTS_HOY' as alerta
FROM users u
WHERE u.email NOT IN (
    SELECT DISTINCT user_email 
    FROM available_slots_today
)
AND EXISTS (
    SELECT 1 FROM events e WHERE e."userId" = u.id
);

-- Usuarios con pocos slots esta semana (menos de 10)
SELECT 
    user_email,
    slots_esta_semana,
    'POCOS_SLOTS_SEMANA' as alerta
FROM user_availability_summary
WHERE slots_esta_semana < 10;

-- Próximo slot disponible por usuario (para widget)
SELECT DISTINCT ON (user_email)
    user_email,
    event_title,
    slot_date,
    slot_start_time,
    time_category
FROM available_slots_next_30_days
ORDER BY user_email, slot_start_datetime;

-- ====================================================================
-- 7. CONSULTAS DE PERFORMANCE Y MONITOREO
-- ====================================================================

-- Estadísticas del cache
SELECT * FROM cache_statistics;

-- Tiempo de respuesta de vistas (benchmark)
EXPLAIN ANALYZE 
SELECT COUNT(*) 
FROM available_slots_next_7_days 
WHERE user_email = 'dr.juan.perez@ejemplo.com';

-- Comparar performance: vista vs cache
EXPLAIN ANALYZE 
SELECT COUNT(*) 
FROM available_slots_cached 
WHERE user_email = 'dr.juan.perez@ejemplo.com';

-- ====================================================================
-- 8. CONSULTAS PARA REPORTES
-- ====================================================================

-- Reporte: Disponibilidad por día de la semana
SELECT 
    EXTRACT(dow FROM slot_date) as dia_numero,
    TO_CHAR(slot_date, 'Day') as dia_semana,
    COUNT(*) as slots_disponibles,
    COUNT(DISTINCT user_email) as usuarios_activos
FROM available_slots_next_30_days
GROUP BY EXTRACT(dow FROM slot_date), TO_CHAR(slot_date, 'Day')
ORDER BY dia_numero;

-- Reporte: Distribución de slots por hora
SELECT 
    EXTRACT(hour FROM slot_start_time) as hora,
    COUNT(*) as slots_disponibles,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM available_slots_next_7_days
GROUP BY EXTRACT(hour FROM slot_start_time)
ORDER BY hora;

-- Reporte: Calendario con más slots
SELECT 
    calendar_id,
    COUNT(*) as slots_disponibles,
    COUNT(DISTINCT user_email) as usuarios,
    COUNT(DISTINCT event_slug) as tipos_eventos
FROM available_slots_next_30_days
GROUP BY calendar_id
ORDER BY slots_disponibles DESC;

-- ====================================================================
-- INSTRUCCIONES FINALES
-- ====================================================================

/*
PARA USAR ESTAS CONSULTAS:

1. DESARROLLO/TESTING:
   - Usar vistas normales (available_slots_next_7_days, etc.)
   - Datos siempre actualizados en tiempo real

2. PRODUCCIÓN CON ALTO TRÁFICO:
   - Usar vista materializada (available_slots_cached)
   - Refrescar cada hora: SELECT refresh_slots_cache();

3. FRONTEND/API:
   - Usar las consultas de la sección 2
   - Agregar LIMIT para paginación

4. DASHBOARD:
   - Usar las consultas de la sección 3
   - Combinar con gráficos

5. ALERTAS:
   - Usar las consultas de la sección 6
   - Ejecutar en cron jobs
*/

-- Verificación final
SELECT 
    'Todas las consultas de ejemplo están listas' as resultado,
    NOW() as fecha_creacion;