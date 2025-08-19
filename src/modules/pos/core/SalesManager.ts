// POS Sales Transaction System
// Handles sales processing, receipts, and integrates with UPP payments

import { 
  Sale, 
  SaleItem, 
  Customer, 
  PaymentMethod, 
  Receipt, 
  ReceiptContent,
  CreateSaleRequest,
  ProcessPaymentRequest,
  POSValidationResult,
  Discount,
  Tax,
  POSSession
} from '../types.js';
import { InventoryManager } from './InventoryManager.js';
import { ValidationError, PaymentError } from '../../../utils/errors.js';
import secureLogger from '../../../shared/logger.js';
import { UPPStripeProcessor, createPaymentProcessor } from '../../../../server/stripe-integration.js';
import { UPPTranslator } from '../../universal-payment-protocol/core/UPPTranslator.js';

export class SalesManager {
  private sales: Map<string, Sale> = new Map();
  private customers: Map<string, Customer> = new Map();
  private receipts: Map<string, Receipt> = new Map();
  private discounts: Map<string, Discount> = new Map();
  private taxes: Map<string, Tax> = new Map();
  private sessions: Map<string, POSSession> = new Map();
  private inventoryManager: InventoryManager;
  private saleCounter: number = 1;
  private paymentProcessor: any;
  private uppTranslator: UPPTranslator;

  constructor(inventoryManager: InventoryManager) {
    this.inventoryManager = inventoryManager;
    this.paymentProcessor = createPaymentProcessor();
    this.uppTranslator = new UPPTranslator();
  }

  // Sale Creation and Management
  async createSale(saleData: CreateSaleRequest, merchantId: string, deviceId?: string): Promise<Sale> {
    this.validateSaleRequest(saleData);

    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const saleNumber = this.generateSaleNumber();

    // Calculate totals
    const { items, subtotal, taxAmount, totalAmount } = await this.calculateSaleTotals(saleData.items);

    const sale: Sale = {
      id: saleId,
      merchant_id: merchantId,
      customer_id: saleData.customer_id,
      sale_number: saleNumber,
      items,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: saleData.discount_amount || 0,
      total_amount: totalAmount - (saleData.discount_amount || 0),
      amount_paid: 0,
      change_amount: 0,
      payment_method: saleData.payment_method,
      payment_status: 'pending',
      sale_type: 'sale',
      notes: saleData.notes,
      receipt_email: saleData.receipt_email,
      receipt_phone: saleData.receipt_phone,
      receipt_printed: false,
      receipt_sent: false,
      device_id: deviceId,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Validate stock availability before creating sale
    await this.validateStockAvailability(items);

    this.sales.set(saleId, sale);

    secureLogger.info('Sale created', {
      saleId,
      saleNumber,
      merchantId,
      totalAmount: sale.total_amount,
      itemCount: items.length
    });

    return sale;
  }

  async processPayment(paymentRequest: ProcessPaymentRequest): Promise<Sale> {
    const sale = this.sales.get(paymentRequest.sale_id);
    if (!sale) {
      throw new ValidationError(`Sale not found: ${paymentRequest.sale_id}`);
    }

    if (sale.payment_status === 'completed') {
      throw new ValidationError('Sale has already been paid');
    }

    if (paymentRequest.amount < sale.total_amount) {
      throw new PaymentError(`Insufficient payment amount. Required: ${sale.total_amount}, Provided: ${paymentRequest.amount}`);
    }

    try {
      // Reserve inventory before processing payment
      await this.reserveInventory(sale);

      // Process payment through UPP system if it's a device payment
      let paymentResult = { success: true, transaction_id: undefined };
      
      if (paymentRequest.upp_payment_data) {
        paymentResult = await this.processUPPPayment(paymentRequest, sale);
      }

      if (!paymentResult.success) {
        throw new PaymentError('Payment processing failed');
      }

      // Update sale with payment information
      const updatedSale: Sale = {
        ...sale,
        amount_paid: paymentRequest.amount,
        change_amount: Math.max(0, paymentRequest.amount - sale.total_amount),
        payment_status: 'completed',
        transaction_id: paymentResult.transaction_id,
        updated_at: new Date()
      };

      this.sales.set(sale.id, updatedSale);

      // Commit inventory changes
      await this.commitInventoryChanges(sale);

      // Generate receipt
      await this.generateReceipt(updatedSale);

      secureLogger.payment('Sale payment completed', {
        saleId: sale.id,
        saleNumber: sale.sale_number,
        totalAmount: sale.total_amount,
        amountPaid: paymentRequest.amount,
        changeAmount: updatedSale.change_amount,
        transactionId: paymentResult.transaction_id
      });

      return updatedSale;

    } catch (error) {
      // Release reserved inventory on payment failure
      await this.releaseInventoryReservation(sale);
      
      const updatedSale: Sale = {
        ...sale,
        payment_status: 'failed',
        updated_at: new Date()
      };
      this.sales.set(sale.id, updatedSale);

      throw error;
    }
  }

  private async processUPPPayment(paymentRequest: ProcessPaymentRequest, sale: Sale): Promise<{ success: boolean; transaction_id?: string }> {
    secureLogger.info('Processing UPP payment', {
      saleId: sale.id,
      amount: paymentRequest.amount,
      deviceType: paymentRequest.upp_payment_data?.deviceType,
      paymentMethod: paymentRequest.payment_method.type
    });

    try {
      // Create UPP payment data for the device
      const devicePaymentData = {
        amount: paymentRequest.amount,
        deviceType: paymentRequest.upp_payment_data?.deviceType || 'pos_terminal',
        deviceId: paymentRequest.device_id || `pos_${Date.now()}`,
        description: `POS Sale ${sale.sale_number} - ${sale.items.length} items`,
        customerEmail: sale.receipt_email,
        metadata: {
          ...paymentRequest.upp_payment_data?.metadata,
          pos_sale_id: sale.id,
          pos_sale_number: sale.sale_number,
          merchant_id: sale.merchant_id,
          item_count: sale.items.length,
          payment_method: paymentRequest.payment_method.type,
          receipt_email: sale.receipt_email,
          receipt_phone: sale.receipt_phone
        }
      };

      // Process payment through UPP Stripe processor
      const paymentResult = await this.paymentProcessor.processDevicePayment(devicePaymentData);

      secureLogger.payment('UPP payment processed', {
        saleId: sale.id,
        success: paymentResult.success,
        transactionId: paymentResult.transaction_id?.substring(0, 10) + '...',
        amount: paymentResult.success ? paymentRequest.amount : undefined
      });

      return {
        success: paymentResult.success,
        transaction_id: paymentResult.transaction_id
      };

    } catch (error) {
      secureLogger.error('UPP payment processing failed', {
        saleId: sale.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        transaction_id: undefined
      };
    }
  }

  // Sale Operations
  async voidSale(saleId: string, reason: string): Promise<Sale> {
    const sale = this.sales.get(saleId);
    if (!sale) {
      throw new ValidationError(`Sale not found: ${saleId}`);
    }

    if (sale.payment_status === 'completed') {
      throw new ValidationError('Cannot void a completed sale. Use return instead.');
    }

    const voidedSale: Sale = {
      ...sale,
      sale_type: 'void',
      payment_status: 'failed',
      notes: `${sale.notes || ''} [VOIDED: ${reason}]`,
      updated_at: new Date()
    };

    this.sales.set(saleId, voidedSale);

    // Release any reserved inventory
    await this.releaseInventoryReservation(sale);

    secureLogger.info('Sale voided', {
      saleId,
      reason,
      totalAmount: sale.total_amount
    });

    return voidedSale;
  }

  async returnSale(originalSaleId: string, itemsToReturn: SaleItem[], reason: string): Promise<Sale> {
    const originalSale = this.sales.get(originalSaleId);
    if (!originalSale) {
      throw new ValidationError(`Original sale not found: ${originalSaleId}`);
    }

    if (originalSale.payment_status !== 'completed') {
      throw new ValidationError('Cannot return items from an incomplete sale');
    }

    // Validate return items
    this.validateReturnItems(originalSale, itemsToReturn);

    const returnSaleId = `return_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const returnSaleNumber = this.generateSaleNumber('RET');

    const subtotal = itemsToReturn.reduce((sum, item) => sum + item.total_amount, 0);
    const taxAmount = itemsToReturn.reduce((sum, item) => sum + item.tax_amount, 0);

    const returnSale: Sale = {
      id: returnSaleId,
      merchant_id: originalSale.merchant_id,
      customer_id: originalSale.customer_id,
      sale_number: returnSaleNumber,
      items: itemsToReturn,
      subtotal: -subtotal,
      tax_amount: -taxAmount,
      discount_amount: 0,
      total_amount: -(subtotal + taxAmount),
      amount_paid: -(subtotal + taxAmount),
      change_amount: 0,
      payment_method: { type: 'cash' }, // Returns typically processed as cash
      payment_status: 'completed',
      sale_type: 'return',
      notes: `Return for sale ${originalSale.sale_number}: ${reason}`,
      receipt_printed: false,
      receipt_sent: false,
      metadata: {
        original_sale_id: originalSaleId,
        return_reason: reason
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    this.sales.set(returnSaleId, returnSale);

    // Process inventory returns
    for (const item of itemsToReturn) {
      await this.inventoryManager.processReturn(
        item.product_id,
        item.quantity,
        returnSaleId
      );
    }

    // Generate return receipt
    await this.generateReceipt(returnSale);

    secureLogger.info('Sale return processed', {
      returnSaleId,
      originalSaleId,
      returnAmount: Math.abs(returnSale.total_amount),
      itemCount: itemsToReturn.length
    });

    return returnSale;
  }

  // Customer Management
  async createCustomer(customerData: Omit<Customer, 'id' | 'total_spent' | 'visit_count' | 'created_at' | 'updated_at'>): Promise<Customer> {
    const customer: Customer = {
      ...customerData,
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      total_spent: 0,
      visit_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.customers.set(customer.id, customer);

    secureLogger.info('Customer created', {
      customerId: customer.id,
      name: customer.name,
      email: customer.email
    });

    return customer;
  }

  getCustomer(customerId: string): Customer | undefined {
    return this.customers.get(customerId);
  }

  searchCustomers(query: string): Customer[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.customers.values()).filter(customer =>
      customer.name.toLowerCase().includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm) ||
      customer.phone?.includes(query)
    );
  }

  // Receipt Management
  private async generateReceipt(sale: Sale): Promise<Receipt> {
    const merchant = await this.getMerchantInfo(sale.merchant_id);
    
    const receiptContent: ReceiptContent = {
      header: {
        business_name: merchant?.business_name || 'Unknown Business',
        address: merchant?.address || {
          street: '',
          city: '',
          country: ''
        },
        phone: merchant?.phone || '',
        tax_id: merchant?.tax_id
      },
      transaction: {
        sale_number: sale.sale_number,
        date: sale.created_at,
        cashier: sale.cashier_id,
        terminal: sale.device_id
      },
      items: sale.items.map(item => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total_amount
      })),
      totals: {
        subtotal: sale.subtotal,
        tax: sale.tax_amount,
        discount: sale.discount_amount,
        total: sale.total_amount,
        amount_paid: sale.amount_paid,
        change: sale.change_amount
      },
      footer: merchant?.pos_settings?.receipt_footer_text,
      barcode: sale.sale_number
    };

    const receipt: Receipt = {
      id: `receipt_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      sale_id: sale.id,
      type: sale.sale_type === 'return' ? 'return' : 'sale',
      format: 'thermal',
      content: receiptContent,
      created_at: new Date()
    };

    this.receipts.set(receipt.id, receipt);

    // Auto-send receipt if configured
    if (sale.receipt_email && merchant?.pos_settings?.ask_for_email_receipt) {
      await this.sendEmailReceipt(receipt, sale.receipt_email);
    }

    return receipt;
  }

  private async sendEmailReceipt(receipt: Receipt, email: string): Promise<void> {
    // TODO: Implement email receipt sending
    secureLogger.info('Email receipt sent', {
      receiptId: receipt.id,
      email
    });
  }

  // Helper Methods
  private async calculateSaleTotals(itemRequests: CreateSaleRequest['items']): Promise<{
    items: SaleItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  }> {
    const items: SaleItem[] = [];
    let subtotal = 0;
    let taxAmount = 0;

    for (const itemRequest of itemRequests) {
      const product = this.inventoryManager.getProduct(itemRequest.product_id);
      if (!product) {
        throw new ValidationError(`Product not found: ${itemRequest.product_id}`);
      }

      const unitPrice = itemRequest.unit_price || product.price;
      const discountAmount = itemRequest.discount_amount || 0;
      const lineSubtotal = (unitPrice * itemRequest.quantity) - discountAmount;
      const lineTaxAmount = product.is_taxable ? (lineSubtotal * (product.tax_rate || 0)) : 0;
      const lineTotal = lineSubtotal + lineTaxAmount;

      const saleItem: SaleItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        sale_id: '', // Will be set when sale is created
        product_id: itemRequest.product_id,
        variant_id: itemRequest.variant_id,
        quantity: itemRequest.quantity,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        tax_amount: lineTaxAmount,
        total_amount: lineTotal,
        product_name: product.name,
        product_sku: product.sku
      };

      items.push(saleItem);
      subtotal += lineSubtotal;
      taxAmount += lineTaxAmount;
    }

    return {
      items,
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount
    };
  }

  private async validateStockAvailability(items: SaleItem[]): Promise<void> {
    for (const item of items) {
      const product = this.inventoryManager.getProduct(item.product_id);
      if (!product) {
        throw new ValidationError(`Product not found: ${item.product_id}`);
      }

      if (product.inventory_quantity < item.quantity) {
        throw new ValidationError(`Insufficient stock for ${product.name}. Available: ${product.inventory_quantity}, Required: ${item.quantity}`);
      }
    }
  }

  private async reserveInventory(sale: Sale): Promise<void> {
    // In a real implementation, this would mark inventory as reserved
    // For now, we'll just validate availability again
    await this.validateStockAvailability(sale.items);
  }

  private async releaseInventoryReservation(sale: Sale): Promise<void> {
    // In a real implementation, this would release reserved inventory
    secureLogger.info('Inventory reservation released', {
      saleId: sale.id
    });
  }

  private async commitInventoryChanges(sale: Sale): Promise<void> {
    for (const item of sale.items) {
      await this.inventoryManager.processSale(
        item.product_id,
        item.quantity,
        sale.id
      );
    }
  }

  private validateSaleRequest(saleData: CreateSaleRequest): POSValidationResult {
    const errors: string[] = [];

    if (!saleData.items || saleData.items.length === 0) {
      errors.push('Sale must contain at least one item');
    }

    for (const item of saleData.items) {
      if (!item.product_id) {
        errors.push('Item product_id is required');
      }
      if (item.quantity <= 0) {
        errors.push('Item quantity must be greater than 0');
      }
    }

    if (!saleData.payment_method?.type) {
      errors.push('Payment method is required');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Sale validation failed: ${errors.join(', ')}`);
    }

    return { valid: true, errors: [] };
  }

  private validateReturnItems(originalSale: Sale, itemsToReturn: SaleItem[]): void {
    for (const returnItem of itemsToReturn) {
      const originalItem = originalSale.items.find(item => 
        item.product_id === returnItem.product_id && 
        item.variant_id === returnItem.variant_id
      );

      if (!originalItem) {
        throw new ValidationError(`Item ${returnItem.product_id} was not in the original sale`);
      }

      if (returnItem.quantity > originalItem.quantity) {
        throw new ValidationError(`Cannot return more items than originally sold for ${returnItem.product_name}`);
      }
    }
  }

  private generateSaleNumber(prefix: string = 'S'): string {
    const number = this.saleCounter.toString().padStart(6, '0');
    this.saleCounter++;
    return `${prefix}${number}`;
  }

  private async getMerchantInfo(merchantId: string): Promise<any> {
    // TODO: Implement merchant data retrieval
    return {
      business_name: 'Sample Business',
      address: {
        street: '123 Main St',
        city: 'Sample City',
        country: 'USA'
      },
      phone: '(555) 123-4567',
      pos_settings: {
        ask_for_email_receipt: true,
        receipt_footer_text: 'Thank you for your business!'
      }
    };
  }

  // Getters
  getSale(saleId: string): Sale | undefined {
    return this.sales.get(saleId);
  }

  getSales(filters?: {
    merchantId?: string;
    customerId?: string;
    status?: Sale['payment_status'];
    saleType?: Sale['sale_type'];
    dateFrom?: Date;
    dateTo?: Date;
  }): Sale[] {
    let sales = Array.from(this.sales.values());

    if (filters) {
      if (filters.merchantId) {
        sales = sales.filter(s => s.merchant_id === filters.merchantId);
      }
      if (filters.customerId) {
        sales = sales.filter(s => s.customer_id === filters.customerId);
      }
      if (filters.status) {
        sales = sales.filter(s => s.payment_status === filters.status);
      }
      if (filters.saleType) {
        sales = sales.filter(s => s.sale_type === filters.saleType);
      }
      if (filters.dateFrom) {
        sales = sales.filter(s => s.created_at >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        sales = sales.filter(s => s.created_at <= filters.dateTo!);
      }
    }

    return sales.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // Analytics
  getDailySalesReport(date: Date, merchantId: string): any {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = this.getSales({
      merchantId,
      dateFrom: startOfDay,
      dateTo: endOfDay
    }).filter(sale => sale.payment_status === 'completed');

    const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const transactionCount = sales.length;
    const averageTransaction = transactionCount > 0 ? totalSales / transactionCount : 0;

    return {
      date: date.toDateString(),
      totalSales,
      transactionCount,
      averageTransaction,
      sales
    };
  }
}