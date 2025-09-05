import fs from 'fs';
import path from 'path';

// File-based stop controller for cross-process communication
export class StopController {
  private stopFilePath: string;

  constructor() {
    this.stopFilePath = path.join(process.cwd(), 'stop_requested.txt');
  }

  /**
   * Request a stop by creating a stop file
   */
  requestStop(): void {
    try {
      fs.writeFileSync(this.stopFilePath, new Date().toISOString());
      console.log('🛑 Stop requested via file');
    } catch (error) {
      console.error('Failed to create stop file:', error);
    }
  }

  /**
   * Check if stop was requested
   */
  isStopRequested(): boolean {
    try {
      return fs.existsSync(this.stopFilePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear the stop request
   */
  clearStopRequest(): void {
    try {
      if (fs.existsSync(this.stopFilePath)) {
        fs.unlinkSync(this.stopFilePath);
        console.log('✅ Stop request cleared');
      }
    } catch (error) {
      console.error('Failed to clear stop file:', error);
    }
  }

  /**
   * Get stop request timestamp
   */
  getStopRequestTime(): string | null {
    try {
      if (fs.existsSync(this.stopFilePath)) {
        return fs.readFileSync(this.stopFilePath, 'utf8').trim();
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const stopController = new StopController();
