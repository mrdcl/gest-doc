import { reprocessAllDocuments } from './ocrService';

export async function runReprocessing() {
  console.log('🚀 Iniciando reprocesamiento de todos los documentos...');
  console.log('⏳ Este proceso puede tardar varios minutos...');

  const startTime = Date.now();

  try {
    const result = await reprocessAllDocuments((current, total) => {
      const progress = ((current / total) * 100).toFixed(1);
      console.log(`📄 Procesando ${current}/${total} (${progress}%)`);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n✅ Reprocesamiento completado!');
    console.log(`✓ Documentos procesados exitosamente: ${result.success}`);
    console.log(`✗ Documentos con errores: ${result.failed}`);
    console.log(`⏱ Tiempo total: ${duration} segundos`);

    return result;
  } catch (error) {
    console.error('❌ Error durante el reprocesamiento:', error);
    throw error;
  }
}

if (typeof window !== 'undefined') {
  (window as any).reprocessAllDocuments = runReprocessing;
  console.log('💡 Función disponible: window.reprocessAllDocuments()');
}
