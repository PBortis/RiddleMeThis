import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data storage
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      riddles: [],
      leaderboard: [],
      currentRiddle: null,
      riddleCounter: 1
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return { riddles: [], leaderboard: [] };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data:', error);
  }
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Generate AI riddle using OpenAI
async function generateAIRiddle(riddleId) {
  try {
    const data = readData();
    const existingAnswers = data.riddles.map(r => r.answer.toLowerCase());
    
    const difficulty = process.env.RIDDLE_DIFFICULTY || 'medium';
    const theme = process.env.RIDDLE_THEME || 'general';
    
    const categories = ['animals', 'objects', 'nature', 'food', 'tools', 'concepts', 'activities'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    const avoidList = existingAnswers.length > 0 ? `\n\nIMPORTANT: Do NOT use any of these answers that have been used recently: ${existingAnswers.slice(-10).join(', ')}` : '';
    
    const prompt = `Generate a ${difficulty} difficulty riddle about ${randomCategory}. Theme: ${theme}.
    
    Requirements:
    - Create a completely original, clever riddle
    - The answer should be a single word or simple phrase
    - Include exactly 3 helpful but not obvious hints
    - Make it engaging, creative, and challenging
    - Use varied sentence structures and creative descriptions${avoidList}
    
    Return ONLY a JSON object in this exact format:
    {
      "question": "Your riddle question here",
      "answer": "single_word_answer",
      "hints": ["hint 1", "hint 2", "hint 3"]
    }`;


    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative riddle master. Generate original, clever riddles with single-word answers. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 300
    });

    let content = response.choices[0].message.content;
    
    // Remove markdown code blocks if present
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (content.includes('```')) {
      content = content.replace(/```\s*/g, '');
    }
    
    const riddleData = JSON.parse(content.trim());
    
    // Check for duplicate answers (retry once if duplicate)
    if (existingAnswers.includes(riddleData.answer.toLowerCase())) {
      console.log(`Duplicate answer detected: ${riddleData.answer}. Retrying once...`);
      // Try once more with stronger emphasis on avoiding duplicates
      const retryPrompt = prompt.replace('IMPORTANT:', 'CRITICAL - ABSOLUTELY REQUIRED:');
      const retryResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a creative riddle master. Generate completely unique, original riddles. NEVER repeat answers that have been used before. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: retryPrompt
          }
        ],
        temperature: 0.9,
        max_tokens: 300
      });
      
      let retryContent = retryResponse.choices[0].message.content;
      if (retryContent.includes('```json')) {
        retryContent = retryContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      } else if (retryContent.includes('```')) {
        retryContent = retryContent.replace(/```\s*/g, '');
      }
      
      const retryRiddleData = JSON.parse(retryContent.trim());
      if (!existingAnswers.includes(retryRiddleData.answer.toLowerCase())) {
        return {
          id: riddleId,
          createdAt: new Date().toISOString(),
          ...retryRiddleData
        };
      }
    }
    
    return {
      id: riddleId,
      createdAt: new Date().toISOString(),
      ...riddleData
    };
  } catch (error) {
    console.error('Error generating AI riddle:', error);
    throw error;
  }
}



// API Routes

// Get current riddle
app.get('/api/riddle/current', async (req, res) => {
  try {
    const data = readData();
    
    if (!data.currentRiddle) {
      // Generate first riddle
      const riddleId = data.riddleCounter || 1;
      try {
        const riddle = await generateAIRiddle(riddleId);
        data.currentRiddle = riddle;
        data.riddles.push(riddle);
        data.riddleCounter = riddleId + 1;
        writeData(data);
      } catch (aiError) {
        console.error('AI riddle generation failed:', aiError.message);
        if (aiError.status === 429) {
          return res.status(503).json({ 
            error: 'Riddle service temporarily unavailable',
            message: 'AI service rate limit exceeded. Please try again later.' 
          });
        }
        return res.status(503).json({ 
          error: 'Riddle generation failed',
          message: 'Unable to generate new riddle at this time. Please try again later.' 
        });
      }
    }
    
    // Don't send the answer to the client
    const { answer, ...riddleWithoutAnswer } = data.currentRiddle;
    res.json(riddleWithoutAnswer);
  } catch (error) {
    console.error('Error getting current riddle:', error);
    res.status(500).json({ error: 'Failed to get riddle' });
  }
});

// Submit answer
app.post('/api/riddle/answer', async (req, res) => {
  const { username, answer, riddleId, hintsUsed = 0, currentPoints } = req.body;
  
  if (!username || !answer || !riddleId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const data = readData();
  const riddle = data.riddles.find(r => r.id === riddleId);
  
  if (!riddle) {
    return res.status(404).json({ error: 'Riddle not found' });
  }
  
  const isCorrect = answer.toLowerCase().trim() === riddle.answer.toLowerCase().trim();
  
  if (isCorrect) {
    // Update leaderboard
    let user = data.leaderboard.find(u => u.username === username);
    
    if (!user) {
      user = {
        username,
        points: 0,
        history: []
      };
      data.leaderboard.push(user);
    }
    
    // Check if user already solved this riddle
    const historyEntry = user.history.find(h => h.riddleId === riddleId);
    
    if (!historyEntry) {
      // First time solving this riddle - award points from frontend calculation
      const points = Math.max(0, currentPoints || 0);
      
      user.points += points;
      user.history.push({
        riddleId,
        date: new Date().toISOString(),
        hintsUsed,
        points
      });
      
      // Generate new riddle for everyone
      try {
        const newRiddleId = data.riddleCounter || 1;
        const newRiddle = await generateAIRiddle(newRiddleId);
        data.currentRiddle = newRiddle;
        data.riddles.push(newRiddle);
        data.riddleCounter = newRiddleId + 1;
      } catch (error) {
        console.error('Error generating new riddle:', error);
      }
    } else if (!historyEntry.points) {
      // User had tried before but now solved it for first time
      const points = Math.max(0, currentPoints || 0);
      
      user.points += points;
      historyEntry.points = points;
      historyEntry.hintsUsed = hintsUsed;
    }
    // User has already solved this riddle (do nothing)
    
    writeData(data);
  } else {
    // Track incorrect attempt (no points awarded)
    let user = data.leaderboard.find(u => u.username === username);
    
    if (!user) {
      user = {
        username,
        points: 0,
        history: [{
          riddleId,
          date: new Date().toISOString(),
          attempts: 1
        }]
      };
      data.leaderboard.push(user);
    } else {
      // Update or create history entry for this riddle
      const historyEntry = user.history.find(h => h.riddleId === riddleId);
      if (historyEntry) {
        historyEntry.attempts = (historyEntry.attempts || 0) + 1;
      } else {
        user.history.push({
          riddleId,
          date: new Date().toISOString(),
          attempts: 1
        });
      }
    }
    
    writeData(data);
  }
  
  res.json({ 
    correct: isCorrect,
    message: isCorrect ? 'Correct! Well done!' : 'Incorrect, try again!'
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const data = readData();
  
  // Sort by points (descending)
  const sortedLeaderboard = [...data.leaderboard].sort((a, b) => {
    return b.points - a.points;
  });
  
  res.json(sortedLeaderboard);
});

// Skip riddle endpoint (when points reach 0)
app.post('/api/riddle/skip', async (req, res) => {
  const { username, riddleId } = req.body;
  
  if (!username || !riddleId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const data = readData();
    
    // Record the skip in user history (0 points)
    let user = data.leaderboard.find(u => u.username === username);
    if (!user) {
      user = {
        username,
        points: 0,
        history: []
      };
      data.leaderboard.push(user);
    }
    
    const historyEntry = user.history.find(h => h.riddleId === riddleId);
    if (!historyEntry) {
      user.history.push({
        riddleId,
        date: new Date().toISOString(),
        points: 0,
        skipped: true
      });
    }
    
    // Generate new riddle
    const newRiddleId = data.riddleCounter || 1;
    const newRiddle = await generateAIRiddle(newRiddleId);
    data.currentRiddle = newRiddle;
    data.riddles.push(newRiddle);
    data.riddleCounter = newRiddleId + 1;
    writeData(data);
    
    // Return new riddle without answer
    const { answer, ...riddleWithoutAnswer } = newRiddle;
    res.json({ 
      message: 'Riddle skipped, new riddle loaded!',
      riddle: riddleWithoutAnswer 
    });
  } catch (error) {
    console.error('Error skipping riddle:', error);
    res.status(500).json({ error: 'Failed to skip riddle' });
  }
});

// Admin endpoint to generate a new riddle (useful for testing)
app.post('/api/riddle/regenerate', async (req, res) => {
  try {
    const data = readData();
    
    // Generate new AI riddle
    const riddleId = data.riddleCounter || 1;
    const riddle = await generateAIRiddle(riddleId);
    data.currentRiddle = riddle;
    data.riddles.push(riddle);
    data.riddleCounter = riddleId + 1;
    writeData(data);
    
    // Return riddle without answer
    const { answer, ...riddleWithoutAnswer } = riddle;
    res.json({ 
      message: 'New riddle generated successfully!',
      riddle: riddleWithoutAnswer 
    });
  } catch (error) {
    console.error('Error regenerating riddle:', error);
    res.status(500).json({ error: 'Failed to regenerate riddle' });
  }
});

// Serve frontend for non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
initDataFile();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
