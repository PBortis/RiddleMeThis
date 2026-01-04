let currentRiddle = null;
let playerName = '';
let hintsUsed = 0;
let currentPoints = 25;
let wrongAttempts = 0;
let sessionRiddleCount = 0;

function startGame() {
    var nameInput = document.getElementById('playerName');
    var name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter your name!');
        return;
    }
    
    playerName = name;
    sessionRiddleCount = 0; // Reset riddle counter for new game
    localStorage.setItem('riddlePlayerName', playerName);
    
    // Hide welcome screen and show game
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameContent').style.display = 'block';
    
    // Load riddle and leaderboard
    loadCurrentRiddle();
    loadLeaderboard();
}

async function loadCurrentRiddle() {
    try {
        const response = await fetch('/api/riddle/current');
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load riddle');
        }
        
        const riddle = await response.json();
        currentRiddle = riddle;

        sessionRiddleCount++; // Increment session riddle counter
        document.getElementById('dateDisplay').textContent = `🧩 Riddle #${sessionRiddleCount}`;
        document.getElementById('riddleQuestion').textContent = riddle.question;
        
        // Create hints
        const hintsList = document.getElementById('hintsList');
        hintsList.innerHTML = '';
        
        riddle.hints.forEach((hint, index) => {
            const li = document.createElement('li');
            li.id = `hint${index + 1}`;
            li.style.cssText = 'padding: 5px 0; color: #666; display: none;';
            li.innerHTML = `💡 ${hint}`;
            hintsList.appendChild(li);
        });
        
        // Reset game state
        hintsUsed = 0;
        currentPoints = 25;
        wrongAttempts = 0;
        updatePointsDisplay();
        
        // Create hint buttons
        const hintButtons = document.getElementById('hintButtons');
        hintButtons.innerHTML = `
            <button onclick="showHint(1)" id="hintBtn1" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; margin: 5px; border-radius: 5px; cursor: pointer; font-size: 14px;">Show Hint 1 (15 pts)</button>
            <button onclick="showHint(2)" id="hintBtn2" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; margin: 5px; border-radius: 5px; cursor: pointer; font-size: 14px; display: none;">Show Hint 2 (10 pts)</button>
            <button onclick="showHint(3)" id="hintBtn3" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; margin: 5px; border-radius: 5px; cursor: pointer; font-size: 14px; display: none;">Show Hint 3 (5 pts)</button>
        `;

        document.getElementById('riddleContent').style.display = 'none';
        document.getElementById('riddleInteraction').style.display = 'block';
    } catch (error) {
        console.error('Error loading riddle:', error);
        document.getElementById('riddleContent').textContent = 'Error loading riddle. Please refresh the page.';
    }
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const leaderboard = await response.json();

        const leaderboardElement = document.getElementById('leaderboard');
        leaderboardElement.innerHTML = '';

        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li style="text-align: center; color: #999;">No players yet. Be the first!</li>';
            return;
        }

        leaderboard.slice(0, 10).forEach((player, index) => {
            const li = document.createElement('li');
            li.style.cssText = 'padding: 15px; margin-bottom: 10px; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
            
            if (index === 0) li.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)';
            else if (index === 1) li.style.background = 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)';
            else if (index === 2) li.style.background = 'linear-gradient(135deg, #cd7f32 0%, #e8a87c 100%)';
            
            let emoji = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
            li.innerHTML = `
                <div style="font-size: 1.1em; font-weight: 600;">${emoji} ${player.username}</div>
                <div style="text-align: right;"><span style="font-size: 1.1em; font-weight: bold;">${player.points}</span> pts</div>
            `;
            
            leaderboardElement.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        document.getElementById('leaderboard').innerHTML = '<li style="color: #999;">Error loading leaderboard</li>';
    }
}

function updatePointsDisplay() {
    const pointsElement = document.getElementById('currentPoints');
    if (pointsElement) {
        pointsElement.textContent = Math.max(0, currentPoints);
        
        if (currentPoints <= 0) {
            pointsElement.style.color = '#ff4444';
        } else if (currentPoints <= 10) {
            pointsElement.style.color = '#ff8800';
        } else {
            pointsElement.style.color = '#667eea';
        }
    }
}

function showHint(hintNumber) {
    if (hintNumber <= 3 && hintNumber > hintsUsed) {
        const hintElement = document.getElementById(`hint${hintNumber}`);
        if (hintElement) {
            hintElement.style.display = 'block';
        }
        
        const button = document.getElementById(`hintBtn${hintNumber}`);
        if (button) {
            button.style.display = 'none';
        }
        
        hintsUsed = hintNumber;
        
        // Update points based on hints
        if (hintsUsed === 1) currentPoints = 15;
        else if (hintsUsed === 2) currentPoints = 10;
        else if (hintsUsed >= 3) currentPoints = 5;
        
        // Account for wrong attempts
        currentPoints -= (wrongAttempts * 5);
        currentPoints = Math.max(0, currentPoints);
        
        updatePointsDisplay();
        
        // Show next hint button
        if (hintNumber < 3) {
            const nextButton = document.getElementById(`hintBtn${hintNumber + 1}`);
            if (nextButton) {
                nextButton.style.display = 'inline-block';
            }
        }
    }
}

async function submitAnswer() {
    const answer = document.getElementById('answer').value.trim();
    const messageDiv = document.getElementById('message');

    if (!answer) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Please enter an answer!';
        return;
    }

    try {
        const response = await fetch('/api/riddle/answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: playerName,
                answer,
                riddleId: currentRiddle.id,
                hintsUsed: hintsUsed,
                currentPoints: currentPoints
            })
        });

        const result = await response.json();

        if (result.correct) {
            messageDiv.className = 'message success';
            messageDiv.textContent = `🎉 Correct! You earned ${currentPoints} points! Loading new riddle...`;
            document.getElementById('answer').value = '';
            
            setTimeout(() => {
                loadCurrentRiddle();
                loadLeaderboard();
            }, 1500);
        } else {
            wrongAttempts += 1;
            currentPoints -= 5;
            currentPoints = Math.max(0, currentPoints);
            updatePointsDisplay();
            
            if (currentPoints <= 0) {
                messageDiv.className = 'message error';
                messageDiv.textContent = '❌ Points reached 0! Moving to next riddle...';
                document.getElementById('answer').value = '';
                
                setTimeout(async () => {
                    try {
                        const skipResponse = await fetch('/api/riddle/skip', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                username: playerName,
                                riddleId: currentRiddle.id
                            })
                        });
                        
                        if (skipResponse.ok) {
                            loadCurrentRiddle();
                            loadLeaderboard();
                        }
                    } catch (error) {
                        console.error('Error skipping riddle:', error);
                        loadCurrentRiddle();
                    }
                }, 2000);
            } else {
                messageDiv.className = 'message error';
                messageDiv.textContent = `❌ Wrong answer! -5 points. Current points: ${currentPoints}`;
            }
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Error submitting answer. Please try again.';
    }
}

// Allow Enter key to submit answer
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const answerField = document.getElementById('answer');
        if (answerField && document.activeElement === answerField) {
            submitAnswer();
        }
    }
});

// Check for stored name on page load
window.addEventListener('load', () => {
    const storedName = localStorage.getItem('riddlePlayerName');
    if (storedName) {
        playerName = storedName;
        sessionRiddleCount = 0; // Reset counter for returning user too
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('gameContent').style.display = 'block';
        loadCurrentRiddle();
        loadLeaderboard();
    }
});