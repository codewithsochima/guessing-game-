const GameSession = require("../models/GameSession");
const Round = require("../models/Round");
const { broadcastToRoom } = require("../services/webSocketService");

const assignNextGameMaster = async (session, preferredPlayerId = null) => {
  const eligiblePlayers = session.players.filter(
    (player) =>
      player.connected &&
      player.user.toString() !== session.gameMaster.toString()
  );

  if (eligiblePlayers.length === 0) {
    return;
  }

  let nextGameMaster;

  if (preferredPlayerId) {
    nextGameMaster = eligiblePlayers.find(
      (player) => player.user.toString() === preferredPlayerId.toString()
    );
  }

  if (!nextGameMaster) {
    nextGameMaster =
      eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
  }

  const previousGameMaster = session.gameMaster;

  const previousMasterExists = session.players.some(
    (player) => player.user.toString() === previousGameMaster.toString()
  );

  if (!previousMasterExists) {
    session.players.push({
      user: previousGameMaster,
      score: 0,
      connected: true
    });
  }

  session.gameMaster = nextGameMaster.user;

  await session.save();
};

const createRound = async (req, res) => {
  try {
    const { roomCode, userId, question, answer, duration } = req.body;

    if (!roomCode || !userId || !question || !answer) {
      return res.status(400).json({
        message: "Room code, user ID, question and answer are required"
      });
    }

    const gameSession = await GameSession.findOne({ roomCode });

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
        message: "Game session is not waiting"
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

    const roundDuration = duration || 60;

    if (
      !Number.isInteger(Number(roundDuration)) ||
      Number(roundDuration) < 1 ||
      Number(roundDuration) > 3600
    ) {
      return res.status(400).json({
        message: "Duration must be between 1 and 3600 seconds"
      });
    }

    const round = await Round.create({
      gameSession: gameSession._id,
      question,
      answer,
      duration: Number(roundDuration)
    });

    return res.status(201).json({
      message: "Round created successfully",
      round
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const startRound = async (req, res) => {
  try {
    const { roomCode, userId } = req.body;

    if (!roomCode || !userId) {
      return res.status(400).json({
        message: "Room code and user ID are required"
      });
    }

    const gameSession = await GameSession.findOne({ roomCode });

    if (!gameSession) {
      return res.status(404).json({
        message: "Game session not found"
      });
    }

    if (gameSession.gameMaster.toString() !== userId) {
      return res.status(403).json({
        message: "Only the game master can start a round"
      });
    }

    if (gameSession.status !== "waiting") {
      return res.status(400).json({
        message: "Game session is not waiting"
      });
    }

    const connectedPlayers = gameSession.players.filter(
      (player) =>
        player.connected &&
        player.user.toString() !== gameSession.gameMaster.toString()
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

    broadcastToRoom(roomCode, {
      type: "ROUND_STARTED",
      question: round.question,
      duration: round.duration,
      startedAt: round.startedAt
    });

    setTimeout(async () => {
      try {
        const currentRound = await Round.findById(round._id);

        if (!currentRound || currentRound.status !== "active") {
          return;
        }

        currentRound.status = "expired";
        currentRound.endedAt = new Date();

        await currentRound.save();

        const currentSession = await GameSession.findById(
          gameSession._id
        );

        if (currentSession) {
          currentSession.status = "waiting";
          await assignNextGameMaster(currentSession);
        }
      } catch (error) {
        console.error("Round timer error:", error.message);
      }
    }, round.duration * 1000);

    return res.status(200).json({
      message: "Round started successfully",
      round
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const submitGuess = async (req, res) => {
  try {
    const { roomCode, userId, guess } = req.body;

    if (!roomCode || !userId || !guess) {
      return res.status(400).json({
        message: "Room code, user ID and guess are required"
      });
    }

    const session = await GameSession.findOne({ roomCode });

    if (!session) {
      return res.status(404).json({
        message: "Game session not found"
      });
    }

    if (session.status !== "active") {
      return res.status(400).json({
        message: "There is no active round"
      });
    }

    if (session.gameMaster.toString() === userId) {
      return res.status(403).json({
        message: "The game master cannot submit guesses"
      });
    }

    const player = session.players.find(
      (item) => item.user.toString() === userId && item.connected
    );

    if (!player) {
      return res.status(403).json({
        message: "You are not a connected player in this session"
      });
    }

    const round = await Round.findOne({
      gameSession: session._id,
      status: "active"
    });

    if (!round) {
      return res.status(404).json({
        message: "No active round found"
      });
    }

    let playerAttempts = round.attempts.find(
      (item) => item.player.toString() === userId
    );

    if (!playerAttempts) {
      round.attempts.push({
        player: userId,
        guesses: []
      });

      playerAttempts = round.attempts[round.attempts.length - 1];
    }

    if (playerAttempts.guesses.length >= 3) {
      return res.status(400).json({
        message: "You have used all your attempts"
      });
    }

    const isCorrect =
      guess.trim().toLowerCase() === round.answer.trim().toLowerCase();

    playerAttempts.guesses.push({
      value: guess.trim(),
      isCorrect
    });

    if (isCorrect) {
      round.status = "won";
      round.winner = userId;
      round.endedAt = new Date();

      session.status = "waiting";
      player.score += 10;

      await round.save();
      await assignNextGameMaster(session, userId);

      return res.status(200).json({
        message: "You have won!",
        winner: userId,
        answer: round.answer,
        pointsAwarded: 10,
        nextGameMaster: session.gameMaster
      });
    }

    await round.save();

    return res.status(200).json({
      message: "Wrong guess",
      attemptsUsed: playerAttempts.guesses.length,
      attemptsRemaining: 3 - playerAttempts.guesses.length
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

module.exports = {
  createRound,
  startRound,
  submitGuess
};
