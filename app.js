require("dotenv").config();
const cors = require("cors");
const { v2: cloudinary } = require("cloudinary");

const express = require("express");
const connectDB = require("./config/database");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/product");
const bodyParser = require("body-parser");
const Product = require("./models/Product");

const app = express();

app.use(cors());

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Middleware for parsing request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const getProductsData = async () => {
  try {
    // Fetch all products sorted by creation date descending
    const products = await Product.find().sort({ createdAt: -1 });

    // Determine the last added product
    const lastAddedProduct = products.length > 0 ? products[0] : null;

    return {
      products,
      lastAddedProduct,
    };
  } catch (error) {
    throw new Error(`Error fetching products: ${error.message}`);
  }
};

app.use("/api", authRoutes);
app.use("/api/products", productRoutes);
app.post("/api/admin-info", async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user: user });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.get("/api/home", async (req, res) => {
  try {
    const { products, lastAddedProduct } = await getProductsData();
    res.status(200).json({ products, lastAddedProduct });
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
});

// Test route
app.get("/test", (req, res) => {
  res.send({ user: req.user });
});

require("./utils/cronJobs");
// cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY,
  secure: true,
});

const createAdminUser = async () => {
  try {
    // Check if admin user already exists
    const existingUser = await User.findOne({ email: "admin@gmail.com" });
    if (existingUser) {
      console.log("Admin user already exists.");
      return;
    }

    // Create admin user
    const newUser = new User({
      username: "admin",
      email: "admin@gmail.com",
      password: "12345678",
      storeName: "Admin Store",
      storeUrl: "http://adminstore.com",
    });

    await newUser.save();
    console.log("Admin user created successfully.");
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
};

// Start the server
const PORT = 8000;
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
  // Connect to the database
  connectDB();

  // await createAdminUser();
});

module.exports = app;
