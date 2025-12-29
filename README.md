# 🎭 Riddle Me This

A daily riddle web application where AI creates a new riddle every day, and users compete on a leaderboard based on how many mistakes they make.

## Features

- 🧩 **Daily Riddles**: A new riddle is generated each day
- 💡 **Helpful Hints**: Each riddle comes with hints to help you solve it
- 🏆 **Leaderboard**: Compete with other users based on riddles solved and mistakes made
- 📊 **Score Tracking**: Your performance is tracked, including total riddles solved and mistakes
- 🎨 **Beautiful UI**: Modern, responsive design that works on all devices

## How to Play

1. Visit the website each day to see a new riddle
2. Enter your name and your answer
3. Submit your answer to see if you're correct
4. Check the leaderboard to see how you rank against other players
5. The leaderboard ranks players by:
   - Number of riddles solved (higher is better)
   - Total mistakes made (lower is better)

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/PBortis/RiddleMeThis.git
cd RiddleMeThis
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Development

To run the server in development mode:
```bash
npm run dev
```

## Project Structure

```
RiddleMeThis/
├── server.js           # Backend API server
├── public/
│   └── index.html     # Frontend interface
├── package.json       # Dependencies and scripts
├── data.json         # Data storage (auto-generated)
└── README.md         # This file
```

## API Endpoints

- `GET /api/riddle/today` - Get today's riddle
- `POST /api/riddle/answer` - Submit an answer
- `GET /api/leaderboard` - Get the leaderboard

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Data Storage**: JSON file-based storage

## Future Enhancements

- Integration with OpenAI API for truly AI-generated riddles
- User authentication and profiles
- Daily streak tracking
- Difficulty levels
- Social sharing features
- Mobile app version

## License

ISC