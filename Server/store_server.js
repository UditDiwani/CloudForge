const express = require('express')
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const dns = require('dns');

dotenv.config();

dns.setServers(['8.8.8.8', '1.1.1.1']);

const JobRoutes = require("./StorageNode/JobRoutes");



const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());

const allowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5500', // live server
  'http://localhost:5500',
  'https://uditdiwani.github.io',
  null,
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/Storage',JobRoutes);

const startServer = async () => {
  try {
    // await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server due to DB error');
    process.exit(1);
  }
};

startServer();