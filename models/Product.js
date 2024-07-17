const mongoose = require("mongoose");
const validator = require("validator");

const bidSchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true,
  },
  bidderInfo: {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
    },
    email: {
      type: String,
      // required: [true, "Email is required"],
      validate: {
        validator: validator.isEmail,
        message: (props) => `${props.value} is not a valid email!`,
      },
    },
    depositReceipt: {
      url: {
        // required: [true, "depositReceipt url is required"],
        type: String,
      },
      public_id: {
        // required: [true, "depositReceipt public_id is required"],
        type: String,
      },
    },
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
      },
    ],
    videos: [
      {
        url: {
          type: String,
          required: false,
        },
        public_id: {
          type: String,
          required: false,
        },
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    auction: {
      startTime: {
        type: Date,
        required: [true, "Auction start time is required"],
        index: true,
      },
      endTime: {
        type: Date,
        required: [true, "Auction end time is required"],
        index: true,
      },
      startingBid: {
        type: Number,
        required: [true, "Starting bid is required"],
        min: [0, "Starting bid must be a positive number"],
      },
      currentBid: {
        type: Number,
        default: 0,
        min: [0, "Current bid must be a positive number"],
      },
    },
    bidHistory: [bidSchema],
    status: {
      type: String,
      require: true,
      default: "available",
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
