import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/riddleme');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    points: { type: Number, default: 0 },
    lastPlayed: { type: Date, default: Date.now }
});

// Riddle Schema  
const riddleSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    hints: [String],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Riddle = mongoose.model('Riddle', riddleSchema);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database connection
connectDB();

let riddleCounter = 1;

// Initialize riddle counter from database
const initRiddleCounter = async () => {
    try {
        const lastRiddle = await Riddle.findOne().sort({ id: -1 });
        if (lastRiddle) {
            riddleCounter = lastRiddle.id + 1;
        }
    } catch (error) {
        console.error('Error initializing riddle counter:', error);
    }
};

initRiddleCounter();

// Helper function to generate AI riddle
async function generateAIRiddle() {
    try {
        // Get existing riddles to avoid duplicates
        const existingRiddles = await Riddle.find({}, 'question answer').lean();
        const existingQuestions = existingRiddles.map(r => r.question).join('\n');
        const existingAnswers = existingRiddles.map(r => r.answer).join('\n');

        const prompt = `Generate a challenging riddle that is different from these existing ones:
        
EXISTING QUESTIONS:
${existingQuestions}

EXISTING ANSWERS: 
${existingAnswers}

Create a completely NEW riddle with:
1. An engaging, clever question
2. A specific, unambiguous answer (single word or short phrase)
3. Three progressive hints (easy, medium, hard)

Format your response as JSON:
{
  "question": "Your riddle question here",
  "answer": "exact answer",
  "hints": ["hint 1", "hint 2", "hint 3"]
}

Make it creative and different from the existing riddles above.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0.9
        });

        const riddleData = JSON.parse(completion.choices[0].message.content);
        
        // Save to database
        const newRiddle = new Riddle({
            id: riddleCounter,
            question: riddleData.question,
            answer: riddleData.answer.toLowerCase().trim(),
            hints: riddleData.hints
        });

        await newRiddle.save();
        riddleCounter++;

        return newRiddle;
    } catch (error) {
        console.error('Error generating AI riddle:', error);
        throw new Error('Failed to generate riddle');
    }
}

// Get current riddle
app.get('/api/riddle/current', async (req, res) => {
    try {
        // Try to get the most recent riddle
        let riddle = await Riddle.findOne().sort({ createdAt: -1 });
        
        // If no riddle exists, generate one
        if (!riddle) {
            riddle = await generateAIRiddle();
        }

        res.json({
            id: riddle.id,
            question: riddle.question,
            hints: riddle.hints
        });
    } catch (error) {
        console.error('Error getting current riddle:', error);
        res.status(500).json({ error: 'Failed to load riddle' });
    }
});

// Submit answer
app.post('/api/riddle/answer', async (req, res) => {
    try {
        const { username, answer, riddleId, hintsUsed, currentPoints } = req.body;

        if (!username || !answer) {
            return res.status(400).json({ error: 'Username and answer are required' });
        }

        // Get the riddle
        const riddle = await Riddle.findOne({ id: riddleId });
        if (!riddle) {
            return res.status(404).json({ error: 'Riddle not found' });
        }

        const userAnswer = answer.toLowerCase().trim();
        const correctAnswer = riddle.answer.toLowerCase().trim();
        const isCorrect = userAnswer === correctAnswer;

        if (isCorrect) {
            // Update or create user
            const user = await User.findOneAndUpdate(
                { username },
                { 
                    $inc: { points: currentPoints },
                    $set: { lastPlayed: new Date() }
                },
                { upsert: true, new: true }
            );

            // Generate new riddle for next question
            const newRiddle = await generateAIRiddle();

            res.json({
                correct: true,
                points: currentPoints,
                totalPoints: user.points,
                message: `Correct! You earned ${currentPoints} points!`
            });
        } else {
            res.json({
                correct: false,
                correctAnswer: riddle.answer,
                message: 'Wrong answer, try again!'
            });
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({ error: 'Failed to submit answer' });
    }
});

// Skip riddle (when points reach 0)
app.post('/api/riddle/skip', async (req, res) => {
    try {
        const { username, riddleId } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Generate new riddle
        const newRiddle = await generateAIRiddle();

        res.json({
            success: true,
            riddle: {
                id: newRiddle.id,
                question: newRiddle.question,
                hints: newRiddle.hints
            }
        });
    } catch (error) {
        console.error('Error skipping riddle:', error);
        res.status(500).json({ error: 'Failed to skip riddle' });
    }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await User.find()
            .sort({ points: -1, lastPlayed: -1 })
            .limit(10)
            .select('username points')
            .lean();

        res.json(leaderboard);
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});