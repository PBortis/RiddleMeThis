# AI Riddle Generation Setup

## How to Enable AI-Generated Riddles

Your RiddleMeThis app is now configured to use OpenAI's GPT to generate daily riddles! Here's how to set it up:

### 1. Get an OpenAI API Key

1. Go to [OpenAI's website](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to the API section
4. Create a new API key
5. Copy the key (it starts with `sk-`)

### 2. Configure Your Environment

1. Open the `.env` file in your project
2. Replace `your_openai_api_key_here` with your actual API key:
   ```
   OPENAI_API_KEY=sk-your_actual_key_here
   ```

### 3. Customize AI Behavior (Optional)

You can adjust how the AI generates riddles by modifying these variables in `.env`:

```env
# Riddle difficulty: easy, medium, hard, expert
RIDDLE_DIFFICULTY=medium

# Theme: general, science, nature, technology, history, etc.
RIDDLE_THEME=general
```

### 4. Start Your Server

```bash
npm start
```

## How It Works

- **Daily Generation**: Each day gets a unique AI-generated riddle
- **Smart Caching**: Riddles are saved to avoid regenerating the same day's riddle
- **Fallback System**: If AI fails, it falls back to predefined riddles
- **Customizable**: Adjust difficulty and themes via environment variables

## API Endpoints

### Get Today's Riddle
```
GET /api/riddle/today
```

### Regenerate Today's Riddle (for testing)
```
POST /api/riddle/regenerate
```

This endpoint allows you to generate a new riddle for today (useful for testing different prompts or if you don't like the current riddle).

## Features

✅ **AI-Generated**: Fresh, original riddles every day  
✅ **Customizable**: Control difficulty and themes  
✅ **Reliable**: Fallback system ensures the app always works  
✅ **Cached**: Saves API costs by not regenerating the same riddle  
✅ **Secure**: API key stored in environment variables  

## Costs

OpenAI API costs are very low for this use case:
- GPT-3.5-turbo: ~$0.001 per riddle generated
- With caching, you'll generate maximum 1 riddle per day
- Monthly cost: ~$0.03 for daily riddles

## Troubleshooting

If riddles aren't generating:
1. Check your API key in the `.env` file
2. Ensure you have credits in your OpenAI account
3. Check the server logs for errors
4. The app will use fallback riddles if AI generation fails