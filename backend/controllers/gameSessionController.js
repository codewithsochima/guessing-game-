
const User = require("../models/User");
const GameSession = require("../models/GameSession");

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

exports.createGameSession = async (req, res) => {
  try {
    const { username } = req.body;

    if (typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        message: "Username is required"
      });
    }

    const user = await User.create({
      username: username.trim()
    });

    let roomCode;
    let existingSession;

    do {
      roomCode = generateRoomCode();
      existingSession = await GameSession.findOne({ roomCode });
    } while (existingSession);

    const gameSession = await GameSession.create({
      roomCode,
      gameMaster: user._id,
      players: [],
      status: "waiting"
    });

    return res.status(201).json({
      message: "Game session created successfully",
      user,
      gameSession
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create game session",
      error: error.message
    });
  }
};

exports.joinGameSession = async (req, res) => {
  try {
    const { username, roomCode } = req.body;

    if (
      typeof username !== "string" ||
      !username.trim() ||
      typeof roomCode !== "string" ||
      !roomCode.trim()
    ) {
      return res.status(400).json({
        message: "Username and room code are required"
      });
    }

    const gameSession = await GameSession.findOne({
      roomCode: roomCode.trim().toUpperCase()
    }).populate("players.user").populate("gameMaster");

    if (!gameSession) {
      return res.status(404).json({
        message: "Game session not found"
      });
    }

    if (gameSession.status !== "waiting") {
      return res.status(400).json({
        message: "This game session is not accepting players"
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const existingUsernames = [
      gameSession.gameMaster.username,
      ...gameSession.players.map(player => player.user.username)
    ];

    if (
      existingUsernames.some(
        name => name.toLowerCase() === normalizedUsername
      )
    ) {
      return res.status(409).json({
        message: "Username is already taken in this session"
      });
    }

    const user = await User.create({
      username: username.trim()
    });

    gameSession.players.push({
      user: user._id,
      score: 0,
      connected: true
    });

    await gameSession.save();

    return res.status(200).json({
      message: "Joined game session successfully",
      user,
      gameSession
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to join game session",
      error: error.message
    });
  }
};
