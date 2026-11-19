
const express = require("express");
const router = express.Router();

const {
  createGameSession,
  joinGameSession
} = require("../controllers/gameSessionController");

router.post("/create", createGameSession);
router.post("/join", joinGameSession);

module.exports = router;
