
const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const connectDB = require("./config/db");
const gameSessionRoutes = require("./routes/gameSessionRoutes");
const { initializeWebSocket } = require("./services/webSocketService");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/game-sessions", gameSessionRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Guessing Game API is running!"
  });
});

const server = http.createServer(app);

initializeWebSocket(server);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
