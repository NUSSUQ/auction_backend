const mongoose = require("mongoose");
const dbUrl = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    await mongoose
      .connect(dbUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
      })
      .then((data) => {
        console.log(`Database connected with ${data.connection.host}`);
      });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    console.log("Retrying in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
