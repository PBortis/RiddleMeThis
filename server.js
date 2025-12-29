import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
      leaderboard: []
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

// Generate riddle from a predefined set based on date
function generateRiddle(date) {
  const riddles = [
    {
      question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
      answer: "echo",
      hints: ["I bounce back", "Sound related", "Mountains have me"]
    },
    {
      question: "The more you take, the more you leave behind. What am I?",
      answer: "footsteps",
      hints: ["Walking related", "You create me", "Found on paths"]
    },
    {
      question: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?",
      answer: "map",
      hints: ["Paper or digital", "Helps navigation", "Shows locations"]
    },
    {
      question: "What has keys but no locks, space but no room, and you can enter but can't go inside?",
      answer: "keyboard",
      hints: ["Computer related", "You type on me", "Has many buttons"]
    },
    {
      question: "I'm tall when I'm young, and I'm short when I'm old. What am I?",
      answer: "candle",
      hints: ["Fire related", "Gives light", "Made of wax"]
    },
    {
      question: "What has hands but cannot clap?",
      answer: "clock",
      hints: ["Tells something", "On the wall", "Has numbers"]
    },
    {
      question: "What gets wet while drying?",
      answer: "towel",
      hints: ["Bathroom item", "Made of cloth", "Absorbs water"]
    }
  ];
  
  // Use date as seed to select riddle
  const dateNum = parseInt(date.replace(/-/g, ''));
  const index = dateNum % riddles.length;
  
  return {
    id: date,
    date: date,
    ...riddles[index]
  };
}

// API Routes

// Get today's riddle
app.get('/api/riddle/today', (req, res) => {
  const today = getTodayDate();
  const data = readData();
  
  let riddle = data.riddles.find(r => r.date === today);
  
  if (!riddle) {
    riddle = generateRiddle(today);
    data.riddles.push(riddle);
    writeData(data);
  }
  
  // Don't send the answer to the client
  const { answer, ...riddleWithoutAnswer } = riddle;
  res.json(riddleWithoutAnswer);
});

// Submit answer
app.post('/api/riddle/answer', (req, res) => {
  const { username, answer, riddleId } = req.body;
  
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
        solved: 0,
        totalMistakes: 0,
        history: []
      };
      data.leaderboard.push(user);
    }
    
    // Check if user already solved today's riddle
    const historyEntry = user.history.find(h => h.riddleId === riddleId);
    
    if (!historyEntry) {
      // First time solving this riddle
      user.solved += 1;
      user.history.push({
        riddleId,
        date: new Date().toISOString(),
        mistakes: 0
      });
    } else if (historyEntry.mistakes > 0) {
      // User had mistakes but now solved it
      user.solved += 1;
    }
    // If historyEntry exists with 0 mistakes, user already solved it (do nothing)
    
    writeData(data);
  } else {
    // Track mistake
    let user = data.leaderboard.find(u => u.username === username);
    
    if (!user) {
      user = {
        username,
        solved: 0,
        totalMistakes: 1,
        history: [{
          riddleId,
          date: new Date().toISOString(),
          mistakes: 1
        }]
      };
      data.leaderboard.push(user);
    } else {
      user.totalMistakes += 1;
      
      // Update or create history entry for today's riddle
      const historyEntry = user.history.find(h => h.riddleId === riddleId);
      if (historyEntry) {
        historyEntry.mistakes += 1;
      } else {
        user.history.push({
          riddleId,
          date: new Date().toISOString(),
          mistakes: 1
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
  
  // Sort by solved (descending) then by mistakes (ascending)
  const sortedLeaderboard = [...data.leaderboard].sort((a, b) => {
    if (b.solved !== a.solved) {
      return b.solved - a.solved;
    }
    return a.totalMistakes - b.totalMistakes;
  });
  
  res.json(sortedLeaderboard);
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
