const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

// Function to delete files from Cloudinary
const deleteFiles = async (files) => {
  try {
    const deleteResponses = await Promise.all(
      files.map(async (file) => {
        const publicId = file.public_id;
        return await cloudinary.uploader.destroy(publicId);
      })
    );
    console.log("Files deleted from Cloudinary:", deleteResponses);
  } catch (error) {
    console.error("Error deleting files from Cloudinary:", error);
  }
};

router.post("/admin/create-product", async (req, res) => {
  try {
    const {
      token,
      productName,
      productDescription,
      productPrice,
      auctionStartingBid,
      auctionStartTime,
      auctionEndTime,
      productImages, // Assuming base64 strings array for images
      productVideos, // Assuming base64 strings array for videos
    } = req.body;

    // Verify token and find user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Upload images and videos to Cloudinary
    let uploadedImages = [];
    let uploadedVideos = [];

    // Function to upload files to Cloudinary and collect URLs
    const uploadFiles = async (files, type) => {
      const uploaded = [];

      for (let file of files) {
        const uploadedFile = await cloudinary.uploader.upload(file, {
          resource_type: type === "image" ? "image" : "video",
          folder: "auction_products", // Optional folder in Cloudinary
        });
        uploaded.push({
          url: uploadedFile.secure_url,
          public_id: uploadedFile.public_id,
        });
      }
      console.log(uploaded);
      return uploaded;
    };

    // Upload images
    if (productImages && productImages.length > 0) {
      uploadedImages = await uploadFiles(productImages, "image");
    }

    // Upload videos
    if (productVideos && productVideos.length > 0) {
      uploadedVideos = await uploadFiles(productVideos, "video");
    }

    // Create new product object with Cloudinary URLs
    const newProduct = new Product({
      name: productName,
      description: productDescription,
      price: productPrice,
      images: uploadedImages,
      videos: uploadedVideos,
      user: user._id, // Assuming user._id is ObjectId
      auction: {
        startingBid: auctionStartingBid,
        startTime: auctionStartTime,
        endTime: auctionEndTime,
      },
      status: "available",
    });

    await newProduct.save();

    res.status(201).json({
      status: "success",
      data: {
        product: newProduct,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

// all products
router.post("/admin/products", async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch all products from the database
    const products = await Product.find();

    res.status(200).json({ products: products });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch products",
    });
  }
});

// Route to edit a product
router.put("/admin/edit-product/:id", async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const productId = req.params.id;
    const {
      productName: name,
      productDescription: description,
      productPrice: price,
      auctionStartingBid,
      auctionStartTime,
      auctionEndTime,
      productImages,
      productVideos,
    } = req.body;

    console.log("req.body:", req.body);

    // Find the product by ID
    let product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    // Function to upload base64 files to Cloudinary and collect URLs
    const uploadBase64Files = async (files, type) => {
      const uploaded = [];

      for (let file of files) {
        const uploadedFile = await cloudinary.uploader.upload(file, {
          resource_type: type === "image" ? "image" : "video",
          folder: "products", // Optional folder in Cloudinary
        });
        uploaded.push({
          url: uploadedFile.secure_url,
          public_id: uploadedFile.public_id,
        });
      }
      return uploaded;
    };

    // Upload edited images
    let editedImages = [];
    if (productImages && productImages.length > 0) {
      editedImages = await uploadBase64Files(productImages, "image");
    }

    // Upload edited videos
    let editedVideos = [];
    if (productVideos && productVideos.length > 0) {
      editedVideos = await uploadBase64Files(productVideos, "video");
    }

    // Store the old images and videos for deletion if new files are uploaded
    const oldImages = product.images;
    const oldVideos = product.videos;

    // Update product fields
    product.name = name;
    product.description = description;
    product.price = price;

    // Update images and videos with Cloudinary URLs
    if (editedImages.length > 0) {
      product.images = editedImages.map((img) => {
        return { url: img.url, public_id: img.public_id };
      });
    }
    if (editedVideos.length > 0) {
      product.videos = editedVideos.map((vid) => vid.url);
    }

    product.auction = {
      startingBid: auctionStartingBid,
      startTime: auctionStartTime,
      endTime: auctionEndTime,
    };

    // Get the current date and time
    const now = new Date();

    // Check the auction times and update the product status
    if (auctionEndTime && new Date(auctionEndTime) < now) {
      product.status = "unavailable";
    } else if (auctionStartTime && new Date(auctionStartTime) > now) {
      product.status = "upcoming";
    } else if (
      auctionStartTime &&
      new Date(auctionStartTime) <= now &&
      auctionEndTime &&
      new Date(auctionEndTime) >= now
    ) {
      product.status = "available";
    }

    // Save the updated product
    await product.save();

    // Delete old images if new images are uploaded
    if (editedImages.length > 0 && oldImages.length > 0) {
      deleteFiles(oldImages); // Assuming a function to delete files
    }

    // Delete old videos if new videos are uploaded
    if (editedVideos.length > 0 && oldVideos.length > 0) {
      deleteFiles(oldVideos); // Assuming a function to delete files
    }

    res.status(200).json({
      status: "success",
      data: {
        product: product,
      },
    });
  } catch (error) {
    console.error("Error editing product:", error);
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

// Route to delete a product
router.post("/admin/delete-product/:id", async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const productId = req.params.id;

    // Find the product by ID
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    // Delete product images from Cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(
        product.images.map(async (image) => {
          // Delete image from Cloudinary
          await cloudinary.uploader.destroy(image.public_id);
        })
      );
    }

    // Delete the product from the database
    const deletedProduct = await Product.findByIdAndDelete(productId);

    res.status(200).json({
      status: "success",
      data: {
        product: deletedProduct,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

// Route to get product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ status: "fail", message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
});

router.post("/add-bid/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { bidPrice: price, fullName, email, phoneNumber, image } = req.body;

    // Find the product by ID
    let product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: "fail",
        message: "Product not found",
      });
    }

    let depositReceiptImage = {};
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: "bidder_receipts",
      });
      depositReceiptImage = {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id,
      };
    }

    const bidderInfo = {
      fullName,
      phoneNumber,
      email,
      depositReceipt: depositReceiptImage,
    };

    if (product.bidHistory.length >= 1) {
      // Send email to previous bidders
      const previousBidders = product.bidHistory.map(
        (bid) => bid.bidderInfo.email
      );
      const emailSubject = `New Bid Added for ${product.name}`;
      const emailHTML = `
      <p>Hello,</p>
      <p>A new bid has been added for ${product.name}.</p>
      <p>Details:</p>
      <ul>
        <li>Bidder Name: ${fullName}</li>
        <li>Bid Price: ${price}</li>
        <li>Link Price: ${process.env.FRONTEND_LINK}/products/${product._id}</li>
      </ul>
      <p>Thank you!</p>
    `;

      // Send emails to previous bidders
      const mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: previousBidders.join(", "),
        subject: emailSubject,
        html: emailHTML,
      };

      // Send email using the transporter
      await transporter.sendMail(mailOptions);
    }
    
    // Add new bid to bidHistory
    product.bidHistory.push({ price, bidderInfo });

    // Update currentBid with the largest price in bidHistory
    const highestBid = Math.max(...product.bidHistory.map((bid) => bid.price));
    product.auction.currentBid = highestBid;

    // Save the updated product
    await product.save();

    res.status(200).json({
      status: "success",
      data: {
        product: product,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

module.exports = router;
