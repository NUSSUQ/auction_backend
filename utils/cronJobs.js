const cron = require("node-cron");
const Product = require("../models/Product");

const BATCH_SIZE = 50;

// Ensure indexes are created
Product.collection.createIndex({ "auction.endTime": 1 });
Product.collection.createIndex({ "auction.startTime": 1 });
Product.collection.createIndex({ status: 1 });

const updateProductStatus = async () => {
  try {
    const now = new Date();
    let hasMore = true;

    while (hasMore) {
      // Find products in batches that need status update
      const products = await Product.find({
        $or: [
          { "auction.endTime": { $lte: now }, status: { $ne: "unavailable" } },
          { "auction.startTime": { $gt: now }, status: { $ne: "upcoming" } },
          {
            "auction.startTime": { $lte: now },
            "auction.endTime": { $gte: now },
            status: { $ne: "available" },
          },
        ],
      }).limit(BATCH_SIZE);

      // Update the found products
      if (products.length > 0) {
        for (let product of products) {
          if (product.auction.endTime <= now) {
            product.status = "unavailable";
          } else if (product.auction.startTime > now) {
            product.status = "upcoming";
          } else if (
            product.auction.startTime <= now &&
            product.auction.endTime >= now
          ) {
            product.status = "available";
          }

          await product.save();
        }
        console.log(`Updated ${products.length} products status.`);
      }

      // Check if there are more products to process
      hasMore = products.length >= BATCH_SIZE;
    }
  } catch (error) {
    console.error("Error updating product status: ", error);
  }
};

// Schedule the cron job to run every 5 minutes
cron.schedule("*/5 * * * *", updateProductStatus);
