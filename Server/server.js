const express = require('express')
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const dns = require('dns');
const driveRoutes = require('./routes/driveRoutes');

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

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
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

const PORT = process.env.MAIN_PORT;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use('/api/drive',driveRoutes);

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