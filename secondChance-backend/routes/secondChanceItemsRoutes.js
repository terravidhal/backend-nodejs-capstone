const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const connectToDatabase = require('../models/db');
const logger = require('../logger');

// Define the upload directory path
const directoryPath = 'public/images';

// Ensure upload directory exists
if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, directoryPath); // Specify the upload directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use the original file name
  },
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});


// Get all secondChanceItems
router.get('/', async (req, res, next) => {
    logger.info('/ called');
    try {
        //Step 2: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 2: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 2: task 3 - insert code here
        const secondChanceItems = await collection.find({}).toArray();
        //Step 2: task 4 - insert code here
        res.json(secondChanceItems);
    } catch (e) {
        logger.error('oops something went wrong', e)
        next(e);
    }
});

// Add a new item
//router.post('/', {Step 3: Task 6 insert code here}, async(req, res,next) => {
router.post('/', upload.single('file'), async(req, res,next) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        //Step 3: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 3: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 3: task 3 - insert code here
        let secondChanceItem = req.body;
        
        // Add file information to the item
        secondChanceItem.imagePath = req.file.filename;
        
        //Step 3: task 4 - insert code here
        const lastItemQuery = await collection.find().sort({'id': -1}).limit(1);
        await lastItemQuery.forEach(item => {
           secondChanceItem.id = (parseInt(item.id) + 1).toString();
        });
        //Step 3: task 5 - insert code here
        const date_added = Math.floor(new Date().getTime() / 1000);
        secondChanceItem.date_added = date_added;
        //Step 3: task 6 - insert code here
        const result = await collection.insertOne(secondChanceItem);
        const insertedItem = await collection.findOne({ _id: result.insertedId });
        res.status(201).json(insertedItem);
    } catch (e) {
        logger.error('Error adding new item:', e);
        next(e);
    }
});

// Get a single secondChanceItem by ID
router.get('/:id', async (req, res, next) => {
    try {
        //Step 4: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 4: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 4: task 3 - insert code here
        const id = req.params.id;
        //Step 4: task 4 - insert code here
        const secondChanceItem = await collection.findOne({ id: id });
        if (secondChanceItem) {
            res.json(secondChanceItem);
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (e) {
        next(e);
    }
});

// Update and existing item
router.put('/:id', async(req, res,next) => {
    try {
        //Step 5: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 5: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 5: task 3 - insert code here
        const id = req.params.id;
        //Step 5: task 4 - insert code here
        const updateData = req.body;
        //Step 5: task 5 - insert code here
        const result = await collection.updateOne({ id: id }, { $set: updateData });
        if (result.matchedCount > 0) {
            const updatedItem = await collection.findOne({ id: id });
            res.json(updatedItem);
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (e) {
        next(e);
    }
});

// Delete an existing item
router.delete('/:id', async(req, res,next) => {
    try {
        //Step 6: task 1 - insert code here
        const db = await connectToDatabase();
        //Step 6: task 2 - insert code here
        const collection = db.collection("secondChanceItems");
        //Step 6: task 3 - insert code here
        const id = req.params.id;
        //Step 6: task 4 - insert code here
        const result = await collection.deleteOne({ id: id });
        if (result.deletedCount > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (e) {
        next(e);
    }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Only image files are allowed!') {
        return res.status(400).json({ error: 'Only image files are allowed!' });
    }
    next(error);
});

module.exports = router;
