# 🌊 UPP Demo Authentication Guide

## Overview

The UPP demo system now requires user authentication before accessing the demo dashboard. This ensures that only registered users can access the payment processing demo and provides better security and user management.

## How It Works

### 1. **Public Access**
- **Landing Page**: `/demo-landing` - Public page explaining the UPP system
- **Login Page**: `/demo-login` - Public login/registration page

### 2. **Protected Access**
- **Demo Dashboard**: `/demo` - Requires valid authentication token
- **All API Endpoints**: Payment processing, device registration, etc. require authentication

## User Flow

### New Users
1. Visit `/demo-landing` to learn about UPP
2. Click "Launch Live Demo" → redirected to `/demo-login`
3. Click "Switch to Register" to create account
4. Fill in name, email, password, and accept terms
5. Account created → automatically logged in → redirected to `/demo`

### Existing Users
1. Visit `/demo-login` directly
2. Enter email and password
3. Login successful → redirected to `/demo`

### Demo Dashboard
- Shows user email in top-right corner
- Logout button available
- All payment processing features work with user context
- Session persists until logout or token expiration

## Technical Implementation

### Authentication Middleware
- `authenticateToken` middleware protects all demo routes
- JWT tokens stored in localStorage
- Automatic token validation on page load
- Redirect to login if token invalid/expired

### Protected Routes
```typescript
// Demo dashboard (requires auth)
app.get('/demo', authenticateToken, generalRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, '../src/demo/DemoDashboard.html'));
});

// Payment processing (requires auth)
app.post('/api/process-payment', paymentRateLimit, authenticateToken, asyncHandler(async (req, res) => {
  // ... payment processing logic
}));
```

### Frontend Authentication
- Token stored in localStorage
- Automatic auth check on dashboard load
- Logout functionality clears tokens and redirects
- Error handling for expired/invalid tokens

## Security Features

### Password Requirements
- Minimum 8 characters
- Stored as hashed values in database
- Password strength validation

### Session Management
- JWT tokens with expiration
- Refresh token support
- Automatic logout on token expiration
- Secure token storage

### Rate Limiting
- Authentication endpoints have rate limiting
- Prevents brute force attacks
- IP-based rate limiting

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR,
  role VARCHAR DEFAULT 'user',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

### Audit Trail
- All authentication events logged
- User actions tracked with correlation IDs
- IP address and user agent logging

## Testing the System

### 1. Start the Server
```bash
npm run dev
# or
node server/index.ts
```

### 2. Access Demo
- Visit `http://localhost:3000/demo-landing`
- Click "Launch Live Demo"
- Create account or login
- Access demo dashboard

### 3. Test Authentication
- Try accessing `/demo` without login → should redirect to login
- Test payment processing → should work with valid token
- Test logout → should clear session and redirect

## Troubleshooting

### Common Issues

1. **"Token invalid" errors**
   - Clear localStorage and re-login
   - Check server logs for token validation errors

2. **"User not found" errors**
   - Verify user exists in database
   - Check user ID format in JWT token

3. **CORS issues**
   - Ensure CORS configuration includes your domain
   - Check browser console for CORS errors

4. **Database connection issues**
   - Verify database is running
   - Check connection string in environment variables

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=auth:* npm run dev
```

## Future Enhancements

### Planned Features
- Email verification for new accounts
- Password reset functionality
- Two-factor authentication
- User profile management
- Admin dashboard for user management
- Social login integration

### Security Improvements
- CSRF protection
- Session timeout configuration
- Device fingerprinting
- Suspicious activity detection

## Support

For issues or questions about the authentication system:
1. Check server logs for error details
2. Verify database connectivity
3. Test with a fresh user account
4. Review browser console for JavaScript errors

---

**🌊 UPP Demo Authentication System - Secure, Scalable, User-Friendly!**
