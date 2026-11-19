const express = require("express");
const router = express.Router();

const {
  createGameSession,
  joinGameSession,
  getGameSession
} = require("../controllers/gameSessionController");

router.post("/create", createGameSession);
router.post("/join", joinGameSession);
router.get("/:roomCode", getGameSession);

module.exports = router;
