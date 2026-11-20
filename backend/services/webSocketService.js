const { WebSocketServer, WebSocket } = require("ws");
const GameSession = require("../models/GameSession");

let wss;

const initializeWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", async (data) => {
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

          ws.roomCode = roomCode.trim().toUpperCase();
          ws.userId = userId.trim();

          const session = await GameSession.findOne({
            roomCode: ws.roomCode
          });

          if (!session) {
            ws.send(JSON.stringify({
              type: "ERROR",
              message: "Game session not found"
            }));
            return;
          }

          const player = session.players.find(
            (item) => item.user.toString() === ws.userId
          );

          const isGameMaster =
            session.gameMaster.toString() === ws.userId;

          if (!player && !isGameMaster) {
            ws.send(JSON.stringify({
              type: "ERROR",
              message: "You are not a member of this game session"
            }));
            return;
          }

          if (player && !player.connected) {
            player.connected = true;
            await session.save();

            broadcastToRoom(ws.roomCode, {
              type: "PLAYER_RECONNECTED",
              userId: ws.userId,
              message: "A player has reconnected"
            });
          }

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

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "ERROR",
            message: "Invalid message format"
          }));
        }
      }
    });

    ws.on("close", async () => {
      console.log("WebSocket connection closed");

      try {
        if (!ws.roomCode || !ws.userId) return;

        const anotherConnection = [...wss.clients].some(
          (client) =>
            client !== ws &&
            client.readyState === WebSocket.OPEN &&
            client.roomCode === ws.roomCode &&
            client.userId === ws.userId
        );

        if (anotherConnection) return;

        const session = await GameSession.findOne({
          roomCode: ws.roomCode
        });

        if (!session) return;

        const player = session.players.find(
          (item) => item.user.toString() === ws.userId
        );

        const isGameMaster =
          session.gameMaster.toString() === ws.userId;

        if (!player && !isGameMaster) return;

        if (player) {
          player.connected = false;
        }

        await session.save();

        broadcastToRoom(ws.roomCode, {
          type: "PLAYER_DISCONNECTED",
          userId: ws.userId,
          message: "A player has disconnected"
        });

        const connectedPlayers = session.players.some(
          (item) => item.connected
        );

        const gameMasterConnected = [...wss.clients].some(
          (client) =>
            client.readyState === WebSocket.OPEN &&
            client.roomCode === ws.roomCode &&
            client.userId === session.gameMaster.toString()
        );

        if (!connectedPlayers && !gameMasterConnected) {
          await GameSession.findByIdAndDelete(session._id);

          console.log(`Game session ${ws.roomCode} deleted`);

          broadcastToRoom(ws.roomCode, {
            type: "SESSION_DELETED",
            message: "The game session has ended because everyone left"
          });
        }

      } catch (error) {
        console.error("Disconnection error:", error.message);
      }
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

