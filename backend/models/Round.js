
const mongoose = require("mongoose");

const roundSchema = new mongoose.Schema(
  {
    gameSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameSession",
      required: true
    },

    question: {
      type: String,
      required: true,
      trim: true
    },

    answer: {
      type: String,
      required: true,
      trim: true
    },

    duration: {
      type: Number,
      default: 60
    },

    status: {
      type: String,
      enum: ["waiting", "active", "won", "expired"],
      default: "waiting"
    },

    attempts: [
      {
        player: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },

        guesses: [
          {
            value: {
              type: String,
              required: true
            },

            isCorrect: {
              type: Boolean,
              default: false
            },

            submittedAt: {
              type: Date,
              default: Date.now
            }
          }
        ]
      }
    ],

    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    startedAt: {
      type: Date,
      default: null
    },

    endedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Round", roundSchema);
