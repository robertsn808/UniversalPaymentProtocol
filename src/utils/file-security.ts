import * as path from 'path';
import * as fs from 'fs';
import { secureLogger } from '../shared/logger.js';

/**
 * Secure file operations with path traversal protection
 */
export class SecureFileHandler {
  private static readonly ALLOWED_EXTENSIONS = ['.html', '.css', '.js', '.json', '.md', '.txt'];
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  
  /**
   * Validates file path to prevent path traversal attacks
   */
  static validateFilePath(filePath: string, allowedDirectory: string): string {
    if (!filePath || !allowedDirectory) {
      throw new Error('File path and allowed directory are required');
    }

    // Resolve absolute paths
    const resolvedPath = path.resolve(filePath);
    const resolvedAllowedDir = path.resolve(allowedDirectory);
    
    // Check if the resolved path is within the allowed directory
    if (!resolvedPath.startsWith(resolvedAllowedDir)) {
      secureLogger.security('Path traversal attempt detected', {
        requestedPath: filePath,
        resolvedPath: resolvedPath,
        allowedDirectory: resolvedAllowedDir,
      });
      throw new Error('Access denied: Path traversal detected');
    }
    
    // Check file extension
    const extension = path.extname(resolvedPath).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      secureLogger.security('Invalid file extension accessed', {
        filePath: resolvedPath,
        extension: extension,
        allowedExtensions: this.ALLOWED_EXTENSIONS,
      });
      throw new Error(`Access denied: File extension '${extension}' not allowed`);
    }
    
    return resolvedPath;
  }

  /**
   * Safely reads a file with security checks
   */
  static async readFileSecurely(filePath: string, allowedDirectory: string): Promise<string> {
    const validatedPath = this.validateFilePath(filePath, allowedDirectory);
    
    // Check if file exists
    if (!fs.existsSync(validatedPath)) {
      throw new Error('File not found');
    }
    
    // Check file size
    const stats = fs.statSync(validatedPath);
    if (stats.size > this.MAX_FILE_SIZE) {
      secureLogger.security('Large file access attempt', {
        filePath: validatedPath,
        fileSize: stats.size,
        maxSize: this.MAX_FILE_SIZE,
      });
      throw new Error('File too large to read');
    }
    
    // Check if it's actually a file (not a directory or symlink)
    if (!stats.isFile()) {
      secureLogger.security('Non-file resource access attempt', {
        filePath: validatedPath,
        isDirectory: stats.isDirectory(),
        isSymbolicLink: stats.isSymbolicLink(),
      });
      throw new Error('Path is not a regular file');
    }
    
    try {
      const content = fs.readFileSync(validatedPath, 'utf8');
      
      secureLogger.info('File accessed securely', {
        filePath: path.relative(allowedDirectory, validatedPath),
        fileSize: stats.size,
      });
      
      return content;
    } catch (error) {
      secureLogger.error('File read error', {
        filePath: validatedPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to read file');
    }
  }

  /**
   * Checks if file exists within allowed directory
   */
  static fileExistsSecurely(filePath: string, allowedDirectory: string): boolean {
    try {
      const validatedPath = this.validateFilePath(filePath, allowedDirectory);
      return fs.existsSync(validatedPath) && fs.statSync(validatedPath).isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get safe file information
   */
  static getFileInfoSecurely(filePath: string, allowedDirectory: string): {
    exists: boolean;
    size?: number;
    extension?: string;
    lastModified?: Date;
  } {
    try {
      const validatedPath = this.validateFilePath(filePath, allowedDirectory);
      
      if (!fs.existsSync(validatedPath)) {
        return { exists: false };
      }
      
      const stats = fs.statSync(validatedPath);
      
      if (!stats.isFile()) {
        return { exists: false };
      }
      
      return {
        exists: true,
        size: stats.size,
        extension: path.extname(validatedPath),
        lastModified: stats.mtime,
      };
    } catch (error) {
      secureLogger.warn('File info check failed', {
        filePath: filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { exists: false };
    }
  }
}

/**
 * Sanitizes file content for safe display
 */
export function sanitizeFileContent(content: string, contentType: 'html' | 'text' | 'json' = 'text'): string {
  if (!content) return '';
  
  // Limit content size for display
  const MAX_DISPLAY_SIZE = 1024 * 100; // 100KB
  if (content.length > MAX_DISPLAY_SIZE) {
    content = content.substring(0, MAX_DISPLAY_SIZE) + '\n\n[Content truncated for security]';
  }
  
  switch (contentType) {
    case 'html':
      // For HTML, we should use a proper HTML sanitizer like DOMPurify
      // For now, we'll escape HTML entities as a basic measure
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    
    case 'json':
      try {
        // Validate and pretty-print JSON
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch (error) {
        return content; // Return as-is if not valid JSON
      }
    
    default:
      // For text content, just return as-is but ensure no null bytes
      return content.replace(/\0/g, '');
  }
}