const GameSession = require("../models/GameSession");
const Round = require("../models/Round");

exports.createRound = async (req, res) => {
  try {
    const { roomCode, userId, question, answer, duration } = req.body;

    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof question !== "string" ||
      !question.trim() ||
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      return res.status(400).json({
        message: "Room code, user ID, question and answer are required",
      });
    }

    const gameSession = await GameSession.findOne({
      roomCode: roomCode.trim().toUpperCase(),
    });

    if (!gameSession) {
      return res.status(404).json({
        message: "Game session not found",
      });
    }

    if (gameSession.gameMaster.toString() !== userId) {
      return res.status(403).json({
        message: "Only the game master can create a round",
      });
    }

    if (gameSession.status !== "waiting") {
      return res.status(400).json({
        message: "A round cannot be created while the session is active",
      });
    }

    const existingRound = await Round.findOne({
      gameSession: gameSession._id,
      status: "waiting",
    });

    if (existingRound) {
      return res.status(400).json({
        message: "A round is already waiting to start",
      });
    }

    const roundDuration = duration === undefined ? 60 : Number(duration);

    if (
      !Number.isInteger(roundDuration) ||
      roundDuration < 1 ||
      roundDuration > 3600
    ) {
      return res.status(400).json({
        message: "Duration must be between 1 and 3600 seconds",
      });
    }

    const round = await Round.create({
      gameSession: gameSession._id,
      question: question.trim(),
      answer: answer.trim(),
      duration: roundDuration,
      status: "waiting",
    });

    return res.status(201).json({
      message: "Round created successfully",
      round,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create round",
      error: error.message,
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
        message: "Room code and user ID are required",
      });
    }

    const gameSession = await GameSession.findOne({
      roomCode: roomCode.trim().toUpperCase(),
    });

    if (!gameSession) {
      return res.status(404).json({
        message: "Game session not found",
      });
    }

    if (gameSession.gameMaster.toString() !== userId) {
      return res.status(403).json({
        message: "Only the game master can start the round",
      });
    }

    if (gameSession.status !== "waiting") {
      return res.status(400).json({
        message: "Game session is not waiting",
      });
    }

    const connectedPlayers = gameSession.players.filter(
      (player) => player.connected,
    );

    if (connectedPlayers.length <= 2) {
      return res.status(400).json({
        message: "More than two connected players are required to start",
      });
    }

    const round = await Round.findOne({
      gameSession: gameSession._id,
      status: "waiting",
    });

    if (!round) {
      return res.status(404).json({
        message: "No waiting round found",
      });
    }

   round.status = "active";
round.startedAt = new Date();

gameSession.status = "active";

await round.save();
await gameSession.save();

setTimeout(async () => {
  try {
    const currentRound = await Round.findById(round._id);

    if (currentRound && currentRound.status === "active") {
      currentRound.status = "expired";
      currentRound.endedAt = new Date();

      await currentRound.save();

      await GameSession.findByIdAndUpdate(gameSession._id, {
        status: "waiting"
      });
    }
  } catch (error) {
    console.error("Round timer failed:", error.message);
  }
}, round.duration * 1000);

    return res.status(200).json({
      message: "Round started successfully",
      round,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to start round",
      error: error.message,
    });
  }
};

exports.submitGuess = async (req, res) => {
  try {
    const { roomCode, userId, guess } = req.body;

    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof guess !== "string" ||
      !guess.trim()
    ) {
      return res.status(400).json({
        message: "Room code, user ID and guess are required",
      });
    }

    const session = await GameSession.findOne({
      roomCode: roomCode.trim().toUpperCase(),
    });

    if (!session) {
      return res.status(404).json({
        message: "Game session not found",
      });
    }

    if (session.status !== "active") {
      return res.status(400).json({
        message: "There is no active game",
      });
    }

    if (session.gameMaster.toString() === userId) {
      return res.status(403).json({
        message: "The game master cannot submit guesses",
      });
    }

    const player = session.players.find(
      (p) => p.user.toString() === userId && p.connected,
    );

    if (!player) {
      return res.status(403).json({
        message: "You are not a connected player in this session",
      });
    }

    const round = await Round.findOne({
      gameSession: session._id,
      status: "active",
    });

    if (!round) {
      return res.status(404).json({
        message: "No active round found",
      });
    }

    let playerAttempts = round.attempts.find(
      (attempt) => attempt.player.toString() === userId,
    );

    if (!playerAttempts) {
      round.attempts.push({
        player: userId,
        guesses: [],
      });

      playerAttempts = round.attempts[round.attempts.length - 1];
    }

    if (playerAttempts.guesses.length >= 3) {
      return res.status(400).json({
        message: "You have used all 3 attempts",
      });
    }

    const isCorrect =
      guess.trim().toLowerCase() === round.answer.trim().toLowerCase();

    playerAttempts.guesses.push({
      value: guess.trim(),
      isCorrect,
    });

    if (isCorrect) {
      round.status = "won";
      round.winner = userId;
      round.endedAt = new Date();

      session.status = "waiting";

      player.score += 10;
      await session.save();
      await round.save();

      return res.status(200).json({
        message: "You have won!",
        winner: userId,
        answer: round.answer,
        pointsAwarded: 10,
      });
    }

    await round.save();

    return res.status(200).json({
      message: "Incorrect guess",
      attemptsUsed: playerAttempts.guesses.length,
      attemptsRemaining: 3 - playerAttempts.guesses.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to submit guess",
      error: error.message,
    });
  }
};
