
const express = require("express");
const router = express.Router();

const {
  createGameSession
} = require("../controllers/gameSessionController");

router.post("/create", createGameSession);

module.exports = router;
