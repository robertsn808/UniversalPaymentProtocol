import express from 'express';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

const app = express();

console.log('🔍 Starting systematic route debugging...');

// Test each route registration step by step
try {
  console.log('Step 1: Basic middleware...');
  app.use(express.json());
  console.log('✅ Express JSON middleware OK');

  console.log('Step 2: Testing basic routes...');
  app.get('/', (req, res) => res.json({ message: 'Root working' }));
  app.get('/health', (req, res) => res.json({ status: 'healthy' }));
  console.log('✅ Basic routes OK');

  console.log('Step 3: Testing parameterized routes...');
  app.get('/test/:id', (req, res) => res.json({ id: req.params.id }));
  console.log('✅ Basic parameterized routes OK');

  // Test each import one by one
  console.log('Step 4: Testing auth routes import...');
  const { default: authRoutes } = await import('./src/auth/routes.ts');
  console.log('✅ Auth routes imported');
  
  console.log('Step 5: Testing auth routes registration...');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes registered');

  console.log('Step 6: Testing API key routes...');
  const { default: apiKeyRoutes } = await import('./src/auth/api-key-routes.ts');
  app.use('/api/keys', apiKeyRoutes);
  console.log('✅ API key routes registered');

} catch (error) {
  console.error('❌ ERROR at step:', error.message);
  console.error('Full error:', error);
  
  // Append to log file
  const fs = await import('fs');
  fs.appendFileSync('./to-kepa.txt', `\n\nERROR FOUND: ${error.message}\nStep: Route registration debugging\nStack: ${error.stack}\n`);
  
  process.exit(1);
}

const PORT = 9003;
app.listen(PORT, () => {
  console.log(`✅ Debug server successfully running on port ${PORT}`);
  console.log('All route registrations completed without path-to-regexp errors');
});