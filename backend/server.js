
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();

const connectDB = require("./config/db");
const gameSessionRoutes = require("./routes/gameSessionRoutes");

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
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      message: "Connected to Guessing Game server"
    })
  );
});

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
