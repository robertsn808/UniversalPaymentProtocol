import express from 'express';
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Test server working' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 9001; // Use different port to avoid conflicts
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});