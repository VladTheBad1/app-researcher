import { appConfig, validateConfig } from './config/index.js';
import logger from './utils/logger.js';

export class AppRadar {
  private initialized = false;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      logger.info('Initializing AppRadar Personal...');
      
      // Validate configuration
      const configValidation = validateConfig();
      if (!configValidation.valid) {
        throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
      }
      
      this.initialized = true;
      logger.info('AppRadar Personal initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize AppRadar', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down AppRadar Personal...');
      this.initialized = false;
      logger.info('AppRadar Personal shutdown complete');
      
    } catch (error) {
      logger.error('Error during shutdown', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export main components
export { appConfig } from './config/index.js';
export * from './types/index.js';

// Default instance
export const appRadar = new AppRadar();