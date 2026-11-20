
const { WebSocketServer, WebSocket } = require("ws");

let wss;

const initializeWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        console.log("MESSAGE RECEIVED:", message);

        if (message.type === "JOIN_ROOM") {
          const { roomCode, userId } = message;

          if (
            typeof roomCode !== "string" ||
            !roomCode.trim() ||
            typeof userId !== "string" ||
            !userId.trim()
          ) {
            ws.send(JSON.stringify({
              type: "ERROR",
              message: "Room code and user ID are required"
            }));
            return;
          }

          ws.roomCode = roomCode.trim();
          ws.userId = userId.trim();

          ws.send(JSON.stringify({
            type: "ROOM_JOINED",
            roomCode: ws.roomCode
          }));

          console.log(`${ws.userId} joined room ${ws.roomCode}`);

          return;
        }

        if (message.type === "ROOM_MESSAGE") {
          if (
            !ws.roomCode ||
            typeof message.message !== "string" ||
            !message.message.trim()
          ) {
            ws.send(JSON.stringify({
              type: "ERROR",
              message: "Join a room and provide a valid message first"
            }));
            return;
          }

          console.log("ROOM MESSAGE RECEIVED:", message.message);

          broadcastToRoom(ws.roomCode, {
            type: "ROOM_MESSAGE",
            userId: ws.userId,
            message: message.message.trim()
          });

          return;
        }

        ws.send(JSON.stringify({
          type: "ERROR",
          message: "Unknown message type"
        }));

      } catch (error) {
        console.error("WebSocket message error:", error.message);

        ws.send(JSON.stringify({
          type: "ERROR",
          message: "Invalid message format"
        }));
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error.message);
    });
  });

  return wss;
};

const broadcastToRoom = (roomCode, message) => {
  if (!wss) return;

  console.log("Broadcasting to room:", roomCode);

  wss.clients.forEach((client) => {
    console.log(
      "CLIENT ROOM:",
      client.roomCode,
      "TARGET ROOM:",
      roomCode
    );

    if (
      client.readyState === WebSocket.OPEN &&
      client.roomCode === roomCode
    ) {
      client.send(JSON.stringify(message));
      console.log("Message sent to:", client.userId);
    }
  });
};

module.exports = {
  initializeWebSocket,
  broadcastToRoom
};
