const express = require("express");
const router = express.Router();

const {
  createGameSession,
  joinGameSession,
  getGameSession
} = require("../controllers/gameSessionController");

const {
  createRound,
  startRound
} = require("../controllers/roundController");

router.post("/create", createGameSession);
router.post("/join", joinGameSession);
router.get("/:roomCode", getGameSession);
router.post("/rounds/create", createRound);
router.post("/rounds/start", startRound);

module.exports = router;
