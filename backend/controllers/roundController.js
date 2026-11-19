
const GameSession = require("../models/GameSession");
const Round = require("../models/Round");

exports.createRound = async (req, res) => {
  try {
    const { roomCode, userId, question, answer, duration } = req.body;

    if (
      !roomCode ||
      !userId ||
      typeof question !== "string" ||
      !question.trim() ||
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      return res.status(400).json({
        message: "Room code, user ID, question and answer are required"
      });
    }

    const gameSession = await GameSession.findOne({
      roomCode: roomCode.trim().toUpperCase()
    });

    if (!gameSession) {
      return res.status(404).json({
        message: "Game session not found"
      });
    }

    if (gameSession.gameMaster.toString() !== userId) {
      return res.status(403).json({
        message: "Only the game master can create a round"
      });
    }

    if (gameSession.status !== "waiting") {
      return res.status(400).json({
        message: "A round cannot be created while the session is active"
      });
    }

    const existingRound = await Round.findOne({
      gameSession: gameSession._id,
      status: "waiting"
    });

    if (existingRound) {
      return res.status(400).json({
        message: "A round is already waiting to start"
      });
    }

    const roundDuration = duration === undefined ? 60 : Number(duration);

    if (
      !Number.isInteger(roundDuration) ||
      roundDuration < 1 ||
      roundDuration > 3600
    ) {
      return res.status(400).json({
        message: "Duration must be between 1 and 3600 seconds"
      });
    }

    const round = await Round.create({
      gameSession: gameSession._id,
      question: question.trim(),
      answer: answer.trim(),
      duration: roundDuration,
      status: "waiting"
    });

    return res.status(201).json({
      message: "Round created successfully",
      round
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create round",
      error: error.message
    });
  }
};

exports.startRound = async (req, res) => {
  try {
    const { roomCode, userId } = req.body;

    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof userId !== "string" ||
      !userId.trim()
    ) {
      return res.status(400).json({
        message: "Room code and user ID are required"
      });
    }

    const gameSession = await GameSession.findOne({
      roomCode: roomCode.trim().toUpperCase()
    });

    if (!gameSession) {
      return res.status(404).json({
        message: "Game session not found"
      });
    }

    if (gameSession.gameMaster.toString() !== userId) {
      return res.status(403).json({
        message: "Only the game master can start the round"
      });
    }

    if (gameSession.status !== "waiting") {
      return res.status(400).json({
        message: "Game session is not waiting"
      });
    }

    const connectedPlayers = gameSession.players.filter(
      player => player.connected
    );

    if (connectedPlayers.length <= 2) {
      return res.status(400).json({
        message: "More than two connected players are required to start"
      });
    }

    const round = await Round.findOne({
      gameSession: gameSession._id,
      status: "waiting"
    });

    if (!round) {
      return res.status(404).json({
        message: "No waiting round found"
      });
    }

    round.status = "active";
    round.startedAt = new Date();

    gameSession.status = "active";

    await round.save();
    await gameSession.save();

    return res.status(200).json({
      message: "Round started successfully",
      round
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to start round",
      error: error.message
    });
  }
};

