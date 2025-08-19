// HTML Sanitization Utility for XSS Prevention
// Provides safe methods for rendering user content in HTML

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param text - The text to escape
 * @returns Escaped text safe for HTML insertion
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
}

/**
 * Creates a safe text node that can be inserted into the DOM
 * @param text - The text content
 * @returns Text node safe for DOM insertion
 */
export function createSafeTextNode(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Safely sets text content of an element (prevents XSS)
 * @param element - The DOM element
 * @param text - The text content to set
 */
export function setSafeTextContent(element: HTMLElement, text: string): void {
  element.textContent = text;
}

/**
 * Creates a safe HTML element with escaped text content
 * @param tagName - The HTML tag name
 * @param textContent - The text content (will be escaped)
 * @param attributes - Optional attributes to set
 * @returns Safe HTML element
 */
export function createSafeElement(
  tagName: string, 
  textContent?: string, 
  attributes?: { [key: string]: string }
): HTMLElement {
  const element = document.createElement(tagName);
  
  if (textContent) {
    element.textContent = textContent; // textContent automatically escapes
  }
  
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      // Sanitize attribute values
      element.setAttribute(key, escapeHtml(value));
    });
  }
  
  return element;
}

/**
 * Safe innerHTML replacement that only allows specific safe HTML
 * This is a simplified version - for production use a library like DOMPurify
 * @param element - The DOM element
 * @param htmlString - The HTML string (will be sanitized)
 */
export function setSafeInnerHTML(element: HTMLElement, htmlString: string): void {
  // For security, we'll only allow basic text formatting
  const allowedTags = ['strong', 'em', 'span', 'div', 'p', 'br'];
  
  // Simple sanitization (in production, use DOMPurify)
  let sanitized = htmlString;
  
  // Remove all script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove dangerous attributes
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*javascript\s*:/gi, '');
  
  // For maximum security, escape everything
  element.textContent = htmlString;
}

/**
 * Validates that a URL is safe (prevents javascript: URLs)
 * @param url - The URL to validate
 * @returns True if the URL is safe
 */
export function isSafeUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase().trim();
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:'];
  
  return !dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol));
}

/**
 * Safely sets a URL attribute (like href or src)
 * @param element - The DOM element
 * @param attribute - The attribute name
 * @param url - The URL value
 */
export function setSafeUrl(element: HTMLElement, attribute: string, url: string): void {
  if (isSafeUrl(url)) {
    element.setAttribute(attribute, url);
  } else {
    console.warn('Blocked potentially dangerous URL:', url);
  }
}

// Common patterns for safe DOM manipulation
export const SafeDOM = {
  escapeHtml,
  createSafeTextNode,
  setSafeTextContent,
  createSafeElement,
  setSafeInnerHTML,
  isSafeUrl,
  setSafeUrl
};

export default SafeDOM;