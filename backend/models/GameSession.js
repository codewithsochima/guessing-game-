
const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true
    },

    gameMaster: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },

    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        score: {
          type: Number,
          default: 0
        },
        connected: {
          type: Boolean,
          default: true
        }
      }
    ],

    status: {
      type: String,
      enum: ["waiting", "active", "ended"],
      default: "waiting"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("GameSession", gameSessionSchema);
