import express from 'express';
const app = express();

console.log('Starting route debugging...');

try {
  console.log('Testing basic routes...');
  app.get('/', (req, res) => res.json({ message: 'Root working' }));
  app.get('/test', (req, res) => res.json({ message: 'Test working' }));
  console.log('✅ Basic routes OK');

  console.log('Testing parameterized routes...');
  app.get('/api/test/:id', (req, res) => res.json({ id: req.params.id }));
  console.log('✅ Basic parameterized routes OK');

  console.log('Testing POS routes import...');
  const posRoutes = await import('./src/modules/pos/routes/pos-routes.ts');
  console.log('✅ POS routes imported');
  
  console.log('Testing POS route registration...');
  app.use('/api/pos', posRoutes.default);
  console.log('✅ POS routes registered');

} catch (error) {
  console.error('❌ Error during route setup:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

const PORT = 9002;
app.listen(PORT, () => {
  console.log(`✅ Debug server running on port ${PORT}`);
});