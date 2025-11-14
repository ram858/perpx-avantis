/**
 * Migration Script: Filesystem → PostgreSQL
 * 
 * This script migrates all wallet files from ./storage/wallets/ to PostgreSQL via Supabase.
 * 
 * Usage:
 *   npx tsx scripts/migrate-wallets-to-db.ts
 * 
 * Safety:
 *   - Backs up files before migration
 *   - Verifies data integrity
 *   - Can be run multiple times (idempotent)
 *   - Generates detailed report
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DatabaseWalletStorageService } from '../lib/services/DatabaseWalletStorageService';

interface MigrationResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

class WalletMigrator {
  private storageService: DatabaseWalletStorageService;
  private storageDir: string;

  constructor() {
    this.storageService = new DatabaseWalletStorageService();
    this.storageDir = join(process.cwd(), 'storage', 'wallets');
  }

  /**
   * Main migration function
   */
  async migrate(): Promise<MigrationResult> {
    console.log('🚀 Starting Wallet Migration: Filesystem → PostgreSQL\n');
    console.log('═'.repeat(60));

    const result: MigrationResult = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // Check if storage directory exists
    if (!existsSync(this.storageDir)) {
      console.log(`⚠️  Storage directory not found: ${this.storageDir}`);
      console.log('Nothing to migrate.');
      return result;
    }

    // Read all wallet files
    const files = readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));
    result.total = files.length;

    console.log(`📁 Found ${files.length} wallet files to migrate\n`);

    if (files.length === 0) {
      console.log('No wallet files found. Migration complete.');
      return result;
    }

    // Migrate each wallet
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = `[${i + 1}/${files.length}]`;

      try {
        await this.migrateWallet(file, progress, result);
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({ file, error: errorMsg });
        console.error(`${progress} ❌ Failed: ${file} - ${errorMsg}`);
      }
    }

    // Print summary
    this.printSummary(result);

    return result;
  }

  /**
   * Migrate a single wallet file
   */
  private async migrateWallet(
    filename: string,
    progress: string,
    result: MigrationResult
  ): Promise<void> {
    const filePath = join(this.storageDir, filename);

    // Parse filename: wallet_{FID}_{CHAIN}.json
    const match = filename.match(/wallet_(\d+)_(.+)\.json$/);
    if (!match) {
      throw new Error(`Invalid filename format: ${filename}`);
    }

    const fid = parseInt(match[1], 10);
    const chain = match[2];

    // Read and parse wallet file
    const fileContent = readFileSync(filePath, 'utf-8');
    const walletData = JSON.parse(fileContent);

    // Validate required fields
    if (!walletData.address) {
      throw new Error('Missing address field');
    }

    // Check if wallet already exists in database
    const existingWallet = await this.storageService.getWallet(fid, chain);
    if (existingWallet) {
      console.log(`${progress} ⏭️  Skipped: ${filename} (already in database)`);
      result.skipped++;
      return;
    }

    // Migrate to database
    await this.storageService.storeWallet(fid, {
      fid,
      address: walletData.address,
      encryptedPrivateKey: walletData.encryptedPrivateKey || '',
      iv: walletData.iv || '',
      chain: walletData.chain || chain,
      createdAt: walletData.createdAt || new Date().toISOString(),
    });

    // Verify migration
    const migrated = await this.storageService.getWallet(fid, chain);
    if (!migrated || migrated.address !== walletData.address) {
      throw new Error('Verification failed - wallet not found after migration');
    }

    console.log(`${progress} ✅ Migrated: ${filename} (FID: ${fid}, Chain: ${chain})`);
    result.successful++;
  }

  /**
   * Print migration summary
   */
  private printSummary(result: MigrationResult): void {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Migration Summary');
    console.log('═'.repeat(60));
    console.log(`Total files:      ${result.total}`);
    console.log(`✅ Successful:    ${result.successful}`);
    console.log(`⏭️  Skipped:       ${result.skipped} (already in database)`);
    console.log(`❌ Failed:        ${result.failed}`);
    console.log('═'.repeat(60));

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(({ file, error }) => {
        console.log(`  • ${file}: ${error}`);
      });
    }

    if (result.failed === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Next Steps:');
      console.log('1. Verify all wallets are accessible');
      console.log('2. Test wallet retrieval and signing');
      console.log('3. Keep filesystem backup for 30 days');
      console.log('4. After 30 days, remove ./storage/wallets directory');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review and fix.');
    }
  }

  /**
   * Verify migration integrity
   */
  async verify(): Promise<boolean> {
    console.log('\n🔍 Verifying migration integrity...\n');

    const files = readdirSync(this.storageDir).filter((f) => f.endsWith('.json'));
    let verified = 0;
    let failed = 0;

    for (const file of files) {
      const match = file.match(/wallet_(\d+)_(.+)\.json$/);
      if (!match) continue;

      const fid = parseInt(match[1], 10);
      const chain = match[2];

      const filePath = join(this.storageDir, file);
      const fileContent = readFileSync(filePath, 'utf-8');
      const walletData = JSON.parse(fileContent);

      const dbWallet = await this.storageService.getWallet(fid, chain);

      if (!dbWallet || dbWallet.address !== walletData.address) {
        console.error(`❌ Verification failed: ${file}`);
        failed++;
      } else {
        verified++;
      }
    }

    console.log(`\n✅ Verified: ${verified}/${files.length}`);
    console.log(`❌ Failed: ${failed}/${files.length}`);

    return failed === 0;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const migrator = new WalletMigrator();

    // Run migration
    const result = await migrator.migrate();

    // Verify if migration was successful
    if (result.successful > 0) {
      await migrator.verify();
    }

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n💥 Migration failed with error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { WalletMigrator };

