const User = require("../models/User");
const GameSession = require("../models/GameSession");

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

exports.createGameSession = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
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
