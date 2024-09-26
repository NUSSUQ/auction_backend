const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { default: axios } = require('axios');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to send SMS using api.oursms.com
const sendSMS = async (to, message) => {
	try {
		const response = await axios.post(
			'https://api.oursms.com/msgs/sms',
			{
				src: process.env.OURS_SMS_SENDER_NAME,
				dests: [to],
				body: message,
			},
			{
				headers: {
					Authorization: `Bearer ${process.env.OURS_SMS_API_KEY}`,
					'Content-Type': 'application/json',
				},
			},
		);
		return response.data;
	} catch (error) {
		console.error('Error sending SMS:', error.response?.data || error.message);
		throw new Error('Failed to send SMS');
	}
};

// Function to delete files from Cloudinary
const deleteFiles = async files => {
	try {
		const deleteResponses = await Promise.all(
			files.map(async file => {
				const publicId = file.public_id;
				return await cloudinary.uploader.destroy(publicId);
			}),
		);
		console.log('Files deleted from Cloudinary:', deleteResponses);
	} catch (error) {
		console.error('Error deleting files from Cloudinary:', error);
	}
};

router.post('/admin/create-product', async (req, res) => {
	try {
		const {
			token,
			productName,
			productDescription,
			productPrice,
			auctionStartTime,
			auctionEndTime,
			productImages, // Assuming base64 strings array for images
			productVideos, // Assuming base64 strings array for videos
			allowedBidAmounts,
		} = req.body;

		// Verify token and find user
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id);

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Upload images and videos to Cloudinary
		let uploadedImages = [];
		let uploadedVideos = [];

		const uploadFiles = async (files, type) => {
			const uploaded = [];
			for (let file of files) {
				const uploadedFile = await cloudinary.uploader.upload(file, {
					resource_type: type === 'image' ? 'image' : 'video',
					folder: 'auction_products', // Optional folder in Cloudinary
				});
				uploaded.push({
					url: uploadedFile.secure_url,
					public_id: uploadedFile.public_id,
				});
			}
			return uploaded;
		};

		if (productImages && productImages.length > 0) {
			uploadedImages = await uploadFiles(productImages, 'image');
		}

		if (productVideos && productVideos.length > 0) {
			uploadedVideos = await uploadFiles(productVideos, 'video');
		}

		const newProduct = new Product({
			name: productName,
			description: productDescription,
			price: productPrice,
			images: uploadedImages,
			videos: uploadedVideos,
			user: user._id,
			auction: {
				startTime: auctionStartTime,
				endTime: auctionEndTime,
			},
			status: 'available',
			allowedBidAmounts: allowedBidAmounts || [500, 1000],
		});

		const now = new Date();
		if (auctionEndTime && new Date(auctionEndTime) < now) {
			newProduct.status = 'unavailable';
		} else if (auctionStartTime && new Date(auctionStartTime) > now) {
			newProduct.status = 'upcoming';
		} else if (
			auctionStartTime &&
			new Date(auctionStartTime) <= now &&
			auctionEndTime &&
			new Date(auctionEndTime) >= now
		) {
			newProduct.status = 'available';
		}

		await newProduct.save();

		res.status(201).json({
			status: 'success',
			data: {
				product: newProduct,
			},
		});
	} catch (error) {
		console.log(error);
		res.status(400).json({
			status: 'fail',
			message: error.message,
		});
	}
});

// all products
router.post('/admin/products', async (req, res) => {
	const { token } = req.body;
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Fetch all products from the database
		const products = await Product.find();

		res.status(200).json({ products: products });
	} catch (error) {
		console.log(error);
		res.status(500).json({
			status: 'error',
			message: 'Failed to fetch products',
		});
	}
});

// Route to edit a product
router.put('/admin/edit-product/:id', async (req, res) => {
	try {
		const { token } = req.body;
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}
		const productId = req.params.id;
		const {
			productName: name,
			productDescription: description,
			productPrice: price,
			auctionStartTime,
			auctionEndTime,
			productImages,
			productVideos,
			allowedBidAmounts,
		} = req.body;

		// Find the product by ID
		let product = await Product.findById(productId);

		if (!product) {
			return res.status(404).json({
				status: 'fail',
				message: 'Product not found',
			});
		}

		// Function to upload base64 files to Cloudinary and collect URLs
		const uploadBase64Files = async (files, type) => {
			const uploaded = [];

			for (let file of files) {
				const uploadedFile = await cloudinary.uploader.upload(file, {
					resource_type: type === 'image' ? 'image' : 'video',
					folder: 'products', // Optional folder in Cloudinary
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
			editedImages = await uploadBase64Files(productImages, 'image');
		}

		// Upload edited videos
		let editedVideos = [];
		if (productVideos && productVideos.length > 0) {
			editedVideos = await uploadBase64Files(productVideos, 'video');
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
			product.images = editedImages.map(img => {
				return { url: img.url, public_id: img.public_id };
			});
		}
		if (editedVideos.length > 0) {
			product.videos = editedVideos.map(vid => {
				return { url: vid.url, public_id: vid.public_id };
			});
		}

		product.auction = {
			startTime: auctionStartTime,
			endTime: auctionEndTime,
		};

		// Update allowed bid amounts if provided
		if (allowedBidAmounts && allowedBidAmounts.length > 0) {
			product.allowedBidAmounts = allowedBidAmounts;
		}

		// Get the current date and time
		const now = new Date();

		// Check the auction times and update the product status
		if (auctionEndTime && new Date(auctionEndTime) < now) {
			product.status = 'unavailable';
		} else if (auctionStartTime && new Date(auctionStartTime) > now) {
			product.status = 'upcoming';
		} else if (
			auctionStartTime &&
			new Date(auctionStartTime) <= now &&
			auctionEndTime &&
			new Date(auctionEndTime) >= now
		) {
			product.status = 'available';
		}

		// Delete old images if new images are uploaded
		if (editedImages.length > 0 && oldImages.length > 0) {
			await deleteFiles(oldImages); // Assuming a function to delete files
		}

		// Delete old videos if new videos are uploaded
		if (editedVideos.length > 0 && oldVideos.length > 0) {
			await deleteFiles(oldVideos); // Assuming a function to delete files
		}

		// Save the updated product
		await product.save();

		res.status(200).json({
			status: 'success',
			data: {
				product: product,
			},
		});
	} catch (error) {
		console.error('Error editing product:', error);
		res.status(400).json({
			status: 'fail',
			message: error.message,
		});
	}
});

// Route to delete a product
router.post('/admin/delete-product/:id', async (req, res) => {
	try {
		const { token } = req.body;
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const productId = req.params.id;

		// Find the product by ID
		const product = await Product.findById(productId);

		if (!product) {
			return res.status(404).json({
				status: 'fail',
				message: 'Product not found',
			});
		}

		// Delete product images from Cloudinary
		if (product.images && product.images.length > 0) {
			await Promise.all(
				product.images.map(async image => {
					// Delete image from Cloudinary
					await cloudinary.uploader.destroy(image.public_id);
				}),
			);
		}

		// Delete the product from the database
		const deletedProduct = await Product.findByIdAndDelete(productId);

		res.status(200).json({
			status: 'success',
			data: {
				product: deletedProduct,
			},
		});
	} catch (error) {
		res.status(400).json({
			status: 'fail',
			message: error.message,
		});
	}
});

// Route to get product by ID
router.get('/:id', async (req, res) => {
	try {
		const product = await Product.findById(req.params.id);
		if (!product) {
			return res
				.status(404)
				.json({ status: 'fail', message: 'Product not found' });
		}
		res.status(200).json(product);
	} catch (error) {
		res.status(500).json({ status: 'fail', message: error.message });
	}
});

// Function to handle new bid notification with SMS
router.post('/add-bid/:id', async (req, res) => {
	try {
		const productId = req.params.id;
		const { bidPrice: price, fullName, phoneNumber } = req.body;

		// Find the product by ID
		let product = await Product.findById(productId);

		if (!product) {
			return res.status(404).json({
				status: 'fail',
				message: 'Product not found',
			});
		}

		// Check if the bid amount is allowed
		if (!product.allowedBidAmounts.includes(price)) {
			return res.status(400).json({
				status: 'fail',
				message: `Bid amount must be one of the following: ${product.allowedBidAmounts.join(
					', ',
				)}`,
			});
		}

		const bidderInfo = {
			fullName,
			phoneNumber,
		};

		// Calculate the new current bid
		const newCurrentBid = product.auction.currentBid
			? parseInt(product.auction.currentBid) + parseInt(price)
			: parseInt(product.price) + parseInt(price);

		if (product.bidHistory.length >= 1) {
			// Collect previous bidders who placed bids lower than the new current bid
			const eligibleBidders = product.bidHistory
				.filter(
					bid =>
						bid.bidderInfo.phoneNumber &&
						bid.bidderInfo.phoneNumber !== phoneNumber,
				) // Filter valid phone numbers, excluding the new bidder
				.filter(bid => bid.price < newCurrentBid) // Filter only those who bid lower than the new bid
				.sort((a, b) => b.price - a.price); // Sort descending by bid price (highest bid first)

			// Get the last eligible bidder who placed the highest bid under the new bid
			if (eligibleBidders.length > 0) {
				const lastEligibleBidder = eligibleBidders[eligibleBidders.length - 1];
				const lastBidderPhone = lastEligibleBidder.bidderInfo.phoneNumber;

				const smsMessage = `عزيزي العميل لم تعد صاحب أعلي مبلغ في المزاد https://glner1.com/products/${product._id}`;

				// Send SMS to the last eligible bidder
				try {
					await sendSMS(lastBidderPhone, smsMessage);
					console.log(`SMS sent to ${lastBidderPhone}`);
				} catch (smsError) {
					console.error('Error sending SMS to last eligible bidder:', smsError);
				}
			}
		}

		// Add new bid to bidHistory
		product.bidHistory.push({ price, bidderInfo });

		// Update currentBid
		product.auction.currentBid = newCurrentBid;

		// Save the updated product
		await product.save();

		res.status(200).json({
			status: 'success',
			data: {
				product: product,
			},
		});
	} catch (error) {
		console.error('Error adding bid:', error);
		res.status(400).json({
			status: 'fail',
			message: error.message,
		});
	}
});

module.exports = router;
