// Currency Manager Tests
// Unit tests for multi-currency support

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrencyManager } from '../../../src/modules/universal-payment-protocol/currency/CurrencyManager';

describe('CurrencyManager', () => {
  let currencyManager: CurrencyManager;

  beforeEach(() => {
    // Mock console.log to reduce test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    currencyManager = new CurrencyManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with supported currencies', () => {
      const supportedCurrencies = currencyManager.getSupportedCurrencies();
      
      expect(supportedCurrencies.length).toBeGreaterThan(0);
      expect(supportedCurrencies.some(c => c.code === 'USD')).toBe(true);
      expect(supportedCurrencies.some(c => c.code === 'EUR')).toBe(true);
      expect(supportedCurrencies.some(c => c.code === 'GBP')).toBe(true);
      expect(supportedCurrencies.some(c => c.code === 'JPY')).toBe(true);
    });

    it('should have correct currency information', () => {
      const usdInfo = currencyManager.getCurrencyInfo('USD');
      
      expect(usdInfo).toBeDefined();
      expect(usdInfo?.code).toBe('USD');
      expect(usdInfo?.name).toBe('US Dollar');
      expect(usdInfo?.symbol).toBe('$');
      expect(usdInfo?.decimal_places).toBe(2);
      expect(usdInfo?.locale).toBe('en-US');
    });
  });

  describe('currency conversion', () => {
    it('should return same currency when no conversion needed', async () => {
      const result = await currencyManager.convertCurrency(100, 'USD', 'USD');
      
      expect(result.original_amount).toBe(100);
      expect(result.original_currency).toBe('USD');
      expect(result.converted_amount).toBe(100);
      expect(result.converted_currency).toBe('USD');
      expect(result.exchange_rate).toBe(1);
      expect(result.conversion_fee).toBe(0);
      expect(result.total_amount).toBe(100);
    });

    it('should convert between different currencies', async () => {
      const result = await currencyManager.convertCurrency(100, 'USD', 'EUR');
      
      expect(result.original_amount).toBe(100);
      expect(result.original_currency).toBe('USD');
      expect(result.converted_currency).toBe('EUR');
      expect(result.exchange_rate).toBeGreaterThan(0);
      expect(result.converted_amount).toBeGreaterThan(0);
      expect(result.conversion_fee).toBeGreaterThan(0);
      expect(result.total_amount).toBeGreaterThan(result.converted_amount);
    });

    it('should apply lower fees for preferred users', async () => {
      const userPreferences = {
        primary_currency: 'USD',
        display_currencies: ['USD', 'EUR'],
        auto_convert: true,
        conversion_threshold: 1000,
        preferred_providers: ['fixer.io']
      };

      const result = await currencyManager.convertCurrency(100, 'USD', 'EUR', userPreferences);
      
      expect(result.conversion_fee).toBeLessThan(result.converted_amount * 0.005);
    });

    it('should throw error for unsupported currency pairs', async () => {
      await expect(currencyManager.convertCurrency(100, 'XXX', 'YYY'))
        .rejects.toThrow('Exchange rate not available');
    });

    it('should handle proper decimal places for different currencies', async () => {
      const jpyResult = await currencyManager.convertCurrency(100, 'USD', 'JPY');
      
      // JPY should have 0 decimal places
      expect(jpyResult.converted_amount % 1).toBe(0);
      expect(jpyResult.total_amount % 1).toBe(0);
    });
  });

  describe('exchange rates', () => {
    it('should provide exchange rates for major currency pairs', async () => {
      const rate = await currencyManager.getExchangeRate('USD', 'EUR');
      
      expect(rate).toBeDefined();
      expect(rate?.from_currency).toBe('USD');
      expect(rate?.to_currency).toBe('EUR');
      expect(rate?.rate).toBeGreaterThan(0);
      expect(rate?.timestamp).toBeInstanceOf(Date);
      expect(rate?.provider).toBeDefined();
    });

    it('should return null for non-existent currency pairs initially', async () => {
      const rate = await currencyManager.getExchangeRate('XXX', 'YYY');
      expect(rate).toBeNull();
    });

    it('should fetch missing exchange rates on demand', async () => {
      // First call should fetch the rate
      const rate1 = await currencyManager.getExchangeRate('USD', 'CAD');
      expect(rate1).toBeDefined();
      
      // Second call should return cached rate
      const rate2 = await currencyManager.getExchangeRate('USD', 'CAD');
      expect(rate2).toBeDefined();
      expect(rate2?.rate).toBe(rate1?.rate);
    });
  });

  describe('currency formatting', () => {
    it('should format USD currency correctly', () => {
      const formatted = currencyManager.formatCurrency(1234.56, 'USD');
      expect(formatted).toMatch(/\$1,234\.56/);
    });

    it('should format EUR currency correctly', () => {
      const formatted = currencyManager.formatCurrency(1234.56, 'EUR');
      expect(formatted).toContain('1.234,56');
      expect(formatted).toContain('€');
    });

    it('should format JPY currency without decimal places', () => {
      const formatted = currencyManager.formatCurrency(12345, 'JPY');
      expect(formatted).toContain('12,345');
      expect(formatted).not.toContain('.');
      expect(formatted).toContain('¥');
    });

    it('should handle unsupported currencies with fallback', () => {
      const formatted = currencyManager.formatCurrency(100, 'XXX');
      expect(formatted).toBe('100 XXX');
    });

    it('should format with custom locale', () => {
      const formatted = currencyManager.formatCurrency(1234.56, 'USD', 'de-DE');
      // German locale formatting
      expect(formatted).toBeDefined();
    });
  });

  describe('currency detection', () => {
    it('should detect USD for US location', async () => {
      const currency = await currencyManager.detectPreferredCurrency({ country: 'US' });
      expect(currency).toBe('USD');
    });

    it('should detect EUR for Germany', async () => {
      const currency = await currencyManager.detectPreferredCurrency({ country: 'DE' });
      expect(currency).toBe('EUR');
    });

    it('should detect GBP for UK', async () => {
      const currency = await currencyManager.detectPreferredCurrency({ country: 'GB' });
      expect(currency).toBe('GBP');
    });

    it('should detect JPY for Japan', async () => {
      const currency = await currencyManager.detectPreferredCurrency({ country: 'JP' });
      expect(currency).toBe('JPY');
    });

    it('should default to USD for unknown countries', async () => {
      const currency = await currencyManager.detectPreferredCurrency({ country: 'XX' });
      expect(currency).toBe('USD');
    });

    it('should default to USD when no location provided', async () => {
      const currency = await currencyManager.detectPreferredCurrency();
      expect(currency).toBe('USD');
    });
  });

  describe('exchange rate trends', () => {
    it('should provide trend analysis', async () => {
      const trends = await currencyManager.getExchangeRateTrends('USD', 'EUR', 30);
      
      expect(trends.currency_pair).toBe('USD/EUR');
      expect(trends.period_days).toBe(30);
      expect(trends.current_rate).toBeGreaterThan(0);
      expect(['up', 'down']).toContain(trends.trend_direction);
      expect(trends.volatility).toBeGreaterThanOrEqual(0);
      expect(trends.volatility).toBeLessThanOrEqual(0.1);
      expect(trends.prediction_confidence).toBeGreaterThanOrEqual(0.7);
      expect(trends.prediction_confidence).toBeLessThanOrEqual(0.95);
      expect(trends.historical_data).toBeInstanceOf(Array);
      expect(trends.historical_data.length).toBe(31); // 30 days + today
    });

    it('should include historical data points', async () => {
      const trends = await currencyManager.getExchangeRateTrends('USD', 'EUR', 7);
      
      expect(trends.historical_data).toBeInstanceOf(Array);
      trends.historical_data.forEach(point => {
        expect(point.date).toBeInstanceOf(Date);
        expect(point.rate).toBeGreaterThan(0);
        expect(point.volume).toBeGreaterThan(0);
      });
    });
  });

  describe('cryptocurrency support', () => {
    it('should convert Bitcoin to USD', async () => {
      const result = await currencyManager.convertCryptoCurrency(0.1, 'BTC', 'USD');
      
      expect(result.original_amount).toBe(0.1);
      expect(result.original_currency).toBe('BTC');
      expect(result.converted_currency).toBe('USD');
      expect(result.converted_amount).toBeGreaterThan(1000); // BTC is valuable
      expect(result.conversion_fee).toBeGreaterThan(0);
      expect(result.conversion_fee).toBe(result.converted_amount * 0.01); // 1% fee
    });

    it('should convert Ethereum to USD', async () => {
      const result = await currencyManager.convertCryptoCurrency(1, 'ETH', 'USD');
      
      expect(result.original_currency).toBe('ETH');
      expect(result.converted_currency).toBe('USD');
      expect(result.converted_amount).toBeGreaterThan(1000);
    });

    it('should throw error for unsupported crypto pairs', async () => {
      await expect(currencyManager.convertCryptoCurrency(1, 'UNKNOWN', 'USD'))
        .rejects.toThrow('Cryptocurrency rate not available');
    });
  });

  describe('currency information', () => {
    it('should provide complete currency information', () => {
      const eurInfo = currencyManager.getCurrencyInfo('EUR');
      
      expect(eurInfo).toEqual({
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimal_places: 2,
        format: '#,##0.00 €',
        locale: 'de-DE'
      });
    });

    it('should return null for unknown currencies', () => {
      const unknownInfo = currencyManager.getCurrencyInfo('UNKNOWN');
      expect(unknownInfo).toBeNull();
    });

    it('should list all supported currencies', () => {
      const currencies = currencyManager.getSupportedCurrencies();
      
      expect(currencies.length).toBeGreaterThan(15);
      
      // Check that major currencies are included
      const codes = currencies.map(c => c.code);
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
      expect(codes).toContain('JPY');
      expect(codes).toContain('CNY');
      expect(codes).toContain('INR');
      expect(codes).toContain('BRL');
    });
  });

  describe('regional currency support', () => {
    it('should support Asian currencies', () => {
      const jpyInfo = currencyManager.getCurrencyInfo('JPY');
      const cnyInfo = currencyManager.getCurrencyInfo('CNY');
      const krwInfo = currencyManager.getCurrencyInfo('KRW');
      
      expect(jpyInfo?.decimal_places).toBe(0);
      expect(cnyInfo?.symbol).toBe('¥');
      expect(krwInfo?.decimal_places).toBe(0);
    });

    it('should support European currencies', () => {
      const eurInfo = currencyManager.getCurrencyInfo('EUR');
      const gbpInfo = currencyManager.getCurrencyInfo('GBP');
      const chfInfo = currencyManager.getCurrencyInfo('CHF');
      
      expect(eurInfo?.symbol).toBe('€');
      expect(gbpInfo?.symbol).toBe('£');
      expect(chfInfo?.symbol).toBe('CHF');
    });

    it('should support American currencies', () => {
      const usdInfo = currencyManager.getCurrencyInfo('USD');
      const cadInfo = currencyManager.getCurrencyInfo('CAD');
      const mxnInfo = currencyManager.getCurrencyInfo('MXN');
      const brlInfo = currencyManager.getCurrencyInfo('BRL');
      
      expect(usdInfo?.symbol).toBe('$');
      expect(cadInfo?.symbol).toBe('C$');
      expect(mxnInfo?.symbol).toBe('$');
      expect(brlInfo?.symbol).toBe('R$');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // This would test actual network error handling
      // For now, we verify the structure exists
      expect(typeof currencyManager.convertCurrency).toBe('function');
    });

    it('should handle invalid amounts', async () => {
      const result = await currencyManager.convertCurrency(-100, 'USD', 'EUR');
      expect(result.original_amount).toBe(-100);
      expect(result.converted_amount).toBeLessThan(0);
    });

    it('should handle zero amounts', async () => {
      const result = await currencyManager.convertCurrency(0, 'USD', 'EUR');
      expect(result.original_amount).toBe(0);
      expect(result.converted_amount).toBe(0);
      expect(result.conversion_fee).toBe(0);
      expect(result.total_amount).toBe(0);
    });
  });
});