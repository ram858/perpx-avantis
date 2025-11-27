/**
 * Web Authentication Service
 * 
 * Handles authentication for web users (non-Farcaster)
 * Creates users in web_users table and generates JWT tokens
 */

import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '@/lib/db/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WebJwtPayload {
  userId: string;
  webUserId: number;
  email?: string;
  username?: string;
  iat?: number;
  exp?: number;
}

export interface WebUser {
  id: number;
  email?: string;
  username?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export class WebAuthService {
  private readonly jwtExpirationTime: string;
  private readonly jwtSecret: string;

  constructor() {
    this.jwtExpirationTime = process.env.JWT_EXPIRATION_TIME || '7d';
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.jwtSecret = secret;
  }

  /**
   * Create or get a web user by phone number
   */
  async createOrGetWebUserByPhone(phoneNumber: string): Promise<WebUser> {
    try {
      console.log(`[WebAuthService] Getting Supabase client...`);
      const supabase = getSupabaseClient();
      console.log(`[WebAuthService] Supabase client obtained`);

      // Check if user exists by phone number
      console.log(`[WebAuthService] Checking for existing user with phone: ${phoneNumber}`);
      const { data: existingUser, error: queryError } = await (supabase
        .from('web_users') as any)
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (queryError && queryError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine
        console.error('[WebAuthService] Error querying user:', queryError);
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      if (existingUser) {
        console.log(`[WebAuthService] Found existing user: ID ${existingUser.id}`);
        // Update last login
        const { data: updatedUser, error: updateError } = await (supabase
          .from('web_users') as any)
          .update({
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('[WebAuthService] Error updating user:', updateError);
          throw new Error(`Failed to update user: ${updateError.message}`);
        }

        return updatedUser as WebUser;
      }

      // Create new user with phone number
      console.log(`[WebAuthService] Creating new user with phone: ${phoneNumber}`);
      const { data: newUser, error } = await (supabase
        .from('web_users') as any)
        .insert({
          phone_number: phoneNumber,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[WebAuthService] Error creating user:', error);
        // Provide more detailed error message
        if (error.message.includes('fetch') || error.message.includes('network')) {
          throw new Error(`Database connection failed: ${error.message}. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.`);
        }
        throw new Error(`Failed to create web user: ${error.message}`);
      }

      if (!newUser) {
        throw new Error('User creation returned null data');
      }

      console.log(`[WebAuthService] Created new web user: ID ${newUser.id}, Phone: ${phoneNumber}`);
      return newUser as WebUser;
    } catch (error) {
      console.error('[WebAuthService] Unexpected error creating/getting user:', error);
      // Re-throw with more context if it's not already an Error
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unexpected error: ${String(error)}`);
    }
  }

  /**
   * Create or get a web user
   * If email/username provided, uses that; otherwise creates anonymous user
   */
  async createOrGetWebUser(options?: {
    email?: string;
    username?: string;
    phoneNumber?: string;
  }): Promise<WebUser> {
    try {
      const supabase = getSupabaseClient();

      // If email provided, check for existing user
      if (options?.email) {
        const { data: existingUser } = await (supabase
          .from('web_users') as any)
          .select('*')
          .eq('email', options.email)
          .single();

        if (existingUser) {
          // Update last login
          const { data: updatedUser } = await (supabase
            .from('web_users') as any)
            .update({
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id)
            .select()
            .single();

          return updatedUser as WebUser;
        }
      }

      // If username provided, check for existing user
      if (options?.username) {
        const { data: existingUser } = await (supabase
          .from('web_users') as any)
          .select('*')
          .eq('username', options.username)
          .single();

        if (existingUser) {
          // Update last login
          const { data: updatedUser } = await (supabase
            .from('web_users') as any)
            .update({
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id)
            .select()
            .single();

          return updatedUser as WebUser;
        }
      }

      // Create new user
      const { data: newUser, error } = await (supabase
        .from('web_users') as any)
        .insert({
          email: options?.email || null,
          username: options?.username || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[WebAuthService] Error creating user:', error);
        throw new Error(`Failed to create web user: ${error.message}`);
      }

      console.log(`[WebAuthService] Created new web user: ID ${newUser.id}`);
      return newUser as WebUser;
    } catch (error) {
      console.error('[WebAuthService] Unexpected error creating/getting user:', error);
      throw error;
    }
  }

  /**
   * Get web user by ID
   */
  async getWebUserById(userId: number): Promise<WebUser | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('web_users') as any)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('[WebAuthService] Error getting user:', error);
        throw new Error(`Failed to get web user: ${error.message}`);
      }

      return data as WebUser;
    } catch (error) {
      console.error('[WebAuthService] Unexpected error getting user:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for web user
   */
  async generateJwtToken(webUser: WebUser): Promise<string> {
    try {
      const payload: Omit<WebJwtPayload, 'iat' | 'exp'> = {
        userId: `web_${webUser.id}`,
        webUserId: webUser.id,
        email: webUser.email || undefined,
        username: webUser.username || undefined,
      };

      // @ts-ignore - JWT type issue with expiresIn
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpirationTime,
        issuer: 'prepx',
        audience: 'prepx-web',
      });

      return token;
    } catch (error) {
      console.error('[WebAuthService] Error generating JWT:', error);
      throw new Error('Failed to generate JWT token');
    }
  }

  /**
   * Verify JWT token and extract web user info
   */
  async verifyToken(token: string): Promise<WebJwtPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'prepx',
        audience: 'prepx-web',
      }) as WebJwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  /**
   * Create anonymous web user (for quick testing)
   */
  async createAnonymousUser(): Promise<{ user: WebUser; token: string }> {
    const user = await this.createOrGetWebUser();
    const token = await this.generateJwtToken(user);
    return { user, token };
  }
}

