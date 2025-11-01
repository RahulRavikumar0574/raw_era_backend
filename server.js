// Simple Express server for Vercel deployment
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept,Origin',
  credentials: true
}));

// Handle OPTIONS requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(204).end();
});

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Proxy all other requests to the NestJS application
app.all('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // For now, just return a 200 response to test CORS
  res.status(200).json({ 
    message: 'CORS is working!',
    path: req.path,
    method: req.method
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// For Vercel serverless deployment
module.exports = app;