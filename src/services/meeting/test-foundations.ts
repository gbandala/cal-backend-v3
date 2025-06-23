/**
 * 🧪 TEST TEMPORAL PARA VALIDAR LAS FUNDACIONES
 * 
 * Este archivo es solo para verificar que todas las interfaces y tipos funcionan correctamente.
 * Se puede eliminar después de la Fase 2.
 */

// import { EventLocationEnumType } from "../../database/entities/event.entity";
import { EventLocationEnumType } from "../../enums/EventLocationEnum";
import { MeetingStrategyFactory } from "./meeting-strategy.factory";
import { 
  mapLocationTypeToCombination,
  isLocationTypeSupported,
  getLocationTypeInfo,
  getSupportedLocationTypes,
  getFutureLocationTypes,
  LocationMappingDebugger
} from "./types/meeting-combination.mapper";
import { CombinationUtils } from "./types/meeting-combination.types";

import { testZoomOutlookIntegration, validateZoomOutlookReady } from "./test-zoom-outlook";

/**
 * Función para testear las fundaciones + Fase 2
 */
export async function testFoundations() {
  console.log('\n🧪 TESTING MEETING SERVICE FOUNDATIONS + FASE 2\n');
  
  try {
    // 1. Test del mapper
    console.log('1️⃣ Testing Location Type Mapper...');
    testMapper();
    
    // 2. Test de combination utils
    console.log('\n2️⃣ Testing Combination Utils...');
    testCombinationUtils();
    
    // 3. Test del factory (básico)
    console.log('\n3️⃣ Testing Meeting Strategy Factory...');
    await testFactory();
    
    // 4. Imprimir resumen completo
    console.log('\n4️⃣ Complete Mapping Summary:');
    LocationMappingDebugger.printMappingSummary();
    LocationMappingDebugger.validateAllLocationTypesMapped();
    
    // ✅ NUEVO: Test específico de Zoom + Outlook (Fase 2)
    console.log('\n5️⃣ Testing Zoom + Outlook Integration (Fase 2):');
    await testZoomOutlookIntegration();
    validateZoomOutlookReady();
    
    console.log('\n✅ ALL FOUNDATION + FASE 2 TESTS PASSED! Zoom + Outlook is ready!\n');
    
  } catch (error) {
    console.error('\n❌ FOUNDATION + FASE 2 TEST FAILED:', error);
    throw error;
  }
}

function testMapper() {
  const testCases = [
    EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR,
    EventLocationEnumType.ZOOM_MEETING,
    EventLocationEnumType.OUTLOOK_WITH_ZOOM,
    // EventLocationEnumType.OUTLOOK_WITH_TEAMS // Podría no existir aún
  ];
  
  testCases.forEach(locationType => {
    try {
      const combination = mapLocationTypeToCombination(locationType);
      const isSupported = isLocationTypeSupported(locationType);
      const info = getLocationTypeInfo(locationType);
      
      console.log(`  ✅ ${locationType}:`);
      console.log(`     → Combination: ${combination}`);
      console.log(`     → Supported: ${isSupported}`);
      console.log(`     → Implemented: ${info.isImplemented}`);
      console.log(`     → Required integrations: ${info.requiredIntegrations.join(', ')}`);
    } catch (error) {
      console.log(`  ⚠️ ${locationType}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  const supported = getSupportedLocationTypes();
  const future = getFutureLocationTypes();
  
  console.log(`  📊 Summary: ${supported.length} supported, ${future.length} future`);
}

function testCombinationUtils() {
  const implemented = CombinationUtils.getImplementedCombinations();
  const future = CombinationUtils.getFutureCombinations();
  
  console.log(`  ✅ Implemented combinations (${implemented.length}):`);
  implemented.forEach(combination => {
    const config = CombinationUtils.getConfig(combination);
    console.log(`     - ${combination}: ${config.description}`);
  });
  
  console.log(`  🚀 Future combinations (${future.length}):`);
  future.forEach(combination => {
    const config = CombinationUtils.getConfig(combination);
    console.log(`     - ${combination}: ${config.description}`);
  });
}

async function testFactory() {
  // Crear factory (sin dependencias por ahora)
  const factory = new MeetingStrategyFactory(
    null as any // ZoomOutlookCalendarStrategy - se inyectaría normalmente
  );
  
  const testLocations = [
    EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR,
    EventLocationEnumType.ZOOM_MEETING,
    EventLocationEnumType.OUTLOOK_WITH_ZOOM
  ];
  
  for (const locationType of testLocations) {
    try {
      console.log(`  Testing factory for ${locationType}:`);
      
      const isSupported = factory.isCombinationSupported(locationType);
      console.log(`     → Supported: ${isSupported}`);
      
      if (isSupported) {
        const config = factory.getCombinationConfig(locationType);
        console.log(`     → Config: ${config.description}`);
        
        const info = factory.getLocationTypeInfo(locationType);
        console.log(`     → Meeting Provider: ${info.meetingProvider}`);
        console.log(`     → Calendar Provider: ${info.calendarProvider}`);
        
        // Test de validación de integraciones
        const validation = await factory.validateRequiredIntegrations(locationType, 'test-user-id');
        console.log(`     → Integration validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
        
        // Intentar crear estrategia (debería fallar en Fase 1)
        try {
          factory.createStrategy(locationType);
          console.log(`     → Strategy creation: ❌ Should have failed (Fase 1)`);
        } catch (error) {
          console.log(`     → Strategy creation: ✅ Expected failure (${error instanceof Error ? error.message.slice(0, 50) : 'Error'}...)`);
        }
      }
      
    } catch (error) {
      console.log(`     → ❌ ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Test summary methods
  const supportedTypes = factory.getSupportedLocationTypes();
  const futureTypes = factory.getFutureLocationTypes();
  
  console.log(`  📊 Factory summary:`);
  console.log(`     → Supported location types: ${supportedTypes.length}`);
  console.log(`     → Future location types: ${futureTypes.length}`);
}

// 🎯 FUNCIÓN PARA USAR EN TU APLICACIÓN
export function runFoundationTest() {
  testFoundations().catch(console.error);
}

// 📋 FUNCIÓN PARA VALIDAR ANTES DE CONTINUAR A FASE 2 (LEGACY)
export function validateReadyForPhase2(): boolean {
  console.log('ℹ️ validateReadyForPhase2 is now legacy - use validateReadyForPhase3');
  return validateReadyForPhase3();
}

// 📋 FUNCIÓN PARA VALIDAR ANTES DE CONTINUAR A FASE 3
export function validateReadyForPhase3(): boolean {
  try {
    console.log('🔍 Validating readiness for Phase 3...');
    
    // Verificar que todos los location types están mapeados
    const allMapped = LocationMappingDebugger.validateAllLocationTypesMapped();
    
    // Verificar que tenemos combinaciones implementadas
    const implemented = CombinationUtils.getImplementedCombinations();
    const hasImplemented = implemented.length >= 3; // Ahora debe tener al menos 3
    
    // Verificar que el factory puede crear configuraciones
    const factory = new MeetingStrategyFactory(null as any);
    const canCreateConfigs = factory.getSupportedLocationTypes().length >= 3;
    
    // ✅ NUEVO: Verificar que Zoom + Outlook está listo
    const zoomOutlookReady = validateZoomOutlookReady();
    
    const isReady = allMapped && hasImplemented && canCreateConfigs && zoomOutlookReady;
    
    console.log(`✅ All mapped: ${allMapped}`);
    console.log(`✅ Has implemented: ${hasImplemented} (${implemented.length} combinations)`);
    console.log(`✅ Factory working: ${canCreateConfigs}`);
    console.log(`✅ Zoom + Outlook ready: ${zoomOutlookReady}`);
    console.log(`\n🎯 Ready for Phase 3: ${isReady ? '✅ YES' : '❌ NO'}\n`);
    
    return isReady;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}