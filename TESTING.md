# Universal Payment Protocol - Testing Guide

## 🚀 Quick Start Testing

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Setup
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## 🧪 Testing Methods

### 1. Automated Tests
```bash
# Run full test suite
npm test

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm test src/__tests__/server.test.ts
```

### 2. Manual API Testing
```bash
# Run comprehensive endpoint testing
./test-endpoints.sh

# Or test individual endpoints manually:
curl http://localhost:3000/health
```

### 3. TypeScript Validation
```bash
# Check for type errors
npm run type-check

# Lint code
npm run lint
```

## 📊 Test Coverage

### Current Test Status
- ✅ **Server API**: 9/9 endpoints tested
- ✅ **Validation**: Input sanitization and schema validation
- ✅ **UPP Translator**: Payment flow translation logic
- ✅ **Error Handling**: Custom error classes and middleware
- ⏳ **Database**: Not yet implemented (in-memory storage)
- ⏳ **Authentication**: Not yet implemented

### Test Files
- `src/__tests__/server.test.ts` - API endpoint testing
- `src/__tests__/validation.test.ts` - Input validation testing
- `src/__tests__/UPPTranslator.test.ts` - Core logic testing

## 🎯 Manual Testing Scenarios

### Basic Functionality
1. **Server Health**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Device Registration**
   ```bash
   curl -X POST http://localhost:3000/api/register-device \
     -H "Content-Type: application/json" \
     -d '{
       "deviceType": "smartphone",
       "capabilities": {
         "internet_connection": true,
         "display": "touchscreen",
         "nfc": true
       },
       "fingerprint": "test_device_123",
       "securityContext": {
         "encryption_level": "AES256"
       }
     }'
   ```

3. **Payment Processing**
   ```bash
   curl -X POST http://localhost:3000/api/process-payment \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 25.99,
       "deviceType": "smartphone",
       "deviceId": "test_device_123",
       "description": "Test payment"
     }'
   ```

### Advanced Testing

#### Device Types Supported
- `smartphone` - Mobile devices with touch, NFC, camera
- `smart_tv` - Large display devices with remote control
- `iot_device` - Internet-connected appliances
- `voice_assistant` - Voice-controlled devices
- `gaming_console` - Gaming systems with controllers

#### Payment Input Types
- `nfc_tap` - Near Field Communication payments
- `qr_scan` - QR code scanning
- `voice_command` - Natural language voice payments
- `manual_entry` - Traditional form input
- `sensor_trigger` - Automated IoT payments

## 🛡️ Security Testing

### Input Validation Tests
```bash
# Test invalid payment amounts
curl -X POST http://localhost:3000/api/process-payment \
  -H "Content-Type: application/json" \
  -d '{"amount": -100, "deviceType": "", "deviceId": ""}'

# Test XSS protection
curl -X POST http://localhost:3000/api/register-device \
  -H "Content-Type: application/json" \
  -d '{"deviceType": "<script>alert(\"xss\")</script>"}'
```

### Error Handling Tests
- Invalid JSON payloads
- Missing required fields
- SQL injection attempts (when database is added)
- Rate limiting (when implemented)

## 🔧 Development Testing

### Running the Demo
```bash
# Run the comprehensive UPP demo
npm run demo
```

### Development Server
```bash
# Start development server with hot reload
npm run dev
```

### Debugging
1. Set `LOG_LEVEL=debug` in your environment
2. Check console output for detailed request/response logging
3. Use browser dev tools for client-side debugging

## 📈 Performance Testing

### Basic Load Testing
```bash
# Test concurrent requests (requires apache bench)
ab -n 100 -c 10 http://localhost:3000/health

# Test payment endpoint
ab -n 50 -c 5 -p payment_data.json -T application/json http://localhost:3000/api/process-payment
```

### Memory Usage
```bash
# Monitor memory usage during testing
node --inspect dist/server/index.js
```

## 🎯 Testing Checklist

### Before Deployment
- [ ] All automated tests passing
- [ ] Manual endpoint testing completed
- [ ] No TypeScript errors
- [ ] All device types tested
- [ ] Error scenarios handled gracefully
- [ ] Security validation working
- [ ] Performance acceptable
- [ ] Environment variables configured

### Integration Testing
- [ ] Stripe integration (with real API keys)
- [ ] Database persistence (when implemented)
- [ ] Authentication flow (when implemented)
- [ ] Real device communication
- [ ] Production environment testing

## 🚨 Known Limitations

1. **Mock Payments**: Currently using mock Stripe responses
2. **In-Memory Storage**: Data lost on server restart
3. **No Authentication**: All endpoints are public
4. **Mock Device Discovery**: Simulated device scanning
5. **Basic Error Handling**: Could be more granular

## 🔜 Future Testing

### When Database is Added
- Transaction persistence testing
- Data integrity validation
- Backup and recovery testing
- Migration testing

### When Authentication is Added
- JWT token validation
- Role-based access testing
- Session management testing
- Security audit testing

### When Real Devices are Integrated
- Hardware compatibility testing
- Network protocol testing
- Device discovery validation
- Real-time communication testing

---

For more information, see the main README.md or check the GitHub issues for planned improvements.