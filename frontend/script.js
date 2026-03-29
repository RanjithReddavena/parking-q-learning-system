// ===== SIMPLE CONFIGURATION WITH MORE OBSTACLES =====
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000',
    MAX_HISTORY: 50,
    // 🚧 8 OBSTACLES - Much more challenging! 🚧
    OBSTACLES: [
        [12, 18],  // Top left - Obstacle 1
        [22, 28],  // Middle left - Obstacle 2
        [32, 15],  // Bottom left - Obstacle 3
        [28, 32],  // Upper middle - Obstacle 4
        [38, 22],  // Right middle - Obstacle 5
        [18, 35],  // Near spot - Obstacle 6
        [42, 12],  // Bottom right - Obstacle 7
        [48, 25]   // Near parking spot - Obstacle 8
    ],
    PARKING_SPOT: [45, 30],
    SUCCESS_DISTANCE: 2.0
};

// ===== STATE MANAGER (Tracks everything simply) =====
const state = {
    trainingActive: false,
    eventSource: null,
    currentData: {
        x: 10, 
        y: 10,
        reward: 0,
        episode: 0,
        epsilon: 0.5,
        steps: 0,
        distance: 0,
        success: false,
        collision: false
    },
    history: {
        episodes: [],
        rewards: [],
        epsilons: []
    },
    stats: {
        successes: 0,
        totalEpisodes: 0
    }
};

// ===== GET ALL DOM ELEMENTS (HTML parts) =====
const elements = {
    // Canvas
    canvas: document.getElementById('parkingCanvas'),
    
    // Buttons
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    resetBtn: document.getElementById('resetBtn'),
    saveBtn: document.getElementById('saveBtn'),
    showQTableBtn: document.getElementById('showQTableBtn'),
    
    // Status displays
    connectionStatus: document.getElementById('connectionStatus'),
    statusText: document.getElementById('statusText'),
    liveStatus: document.getElementById('liveStatus'),
    happeningMessage: document.getElementById('happeningMessage'),
    
    // Stats displays
    episode: document.getElementById('episode'),
    reward: document.getElementById('reward'),
    distance: document.getElementById('distance'),
    epsilon: document.getElementById('epsilon'),
    steps: document.getElementById('steps'),
    successRate: document.getElementById('successRate')
};

// ===== CHECK IF ALL ELEMENTS WERE FOUND =====
console.log('Elements found:', {
    canvas: !!elements.canvas,
    startBtn: !!elements.startBtn,
    stopBtn: !!elements.stopBtn,
    resetBtn: !!elements.resetBtn,
    saveBtn: !!elements.saveBtn,
    showQTableBtn: !!elements.showQTableBtn,
    episode: !!elements.episode,
    reward: !!elements.reward,
    distance: !!elements.distance,
    epsilon: !!elements.epsilon,
    steps: !!elements.steps,
    successRate: !!elements.successRate
});

// ===== CANVAS SETUP =====
if (!elements.canvas) {
    console.error('Canvas element not found! Check if id="parkingCanvas" exists in HTML');
}
const ctx = elements.canvas ? elements.canvas.getContext('2d') : null;
const width = 700, height = 450;

// ===== HELPER FUNCTIONS FOR MESSAGES =====
function updateStatusMessage(message) {
    if (elements.liveStatus) {
        elements.liveStatus.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    }
}

function updateHappeningNow(message) {
    if (elements.happeningMessage) {
        elements.happeningMessage.textContent = message;
    }
}

// ===== DRAW THE PARKING LOT (with 8 obstacles) =====
function drawCar(x, y, isSuccess) {
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background grid (helps see movement)
    ctx.strokeStyle = '#2a3a55';
    ctx.lineWidth = 0.5;
    for(let i = 0; i <= width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
    }
    for(let i = 0; i <= height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
    }
    
    // ===== DRAW PARKING SPOT (GREEN - The GOAL) =====
    const spotX = (CONFIG.PARKING_SPOT[0] / 60) * width;
    const spotY = height - (CONFIG.PARKING_SPOT[1] / 40) * height;
    
    // Glowing effect for the goal
    ctx.shadowColor = '#4ecdc4';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#4ecdc4';
    ctx.globalAlpha = 0.2;
    ctx.fillRect(spotX - 35, spotY - 25, 70, 50);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    
    // Border
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 4;
    ctx.strokeRect(spotX - 35, spotY - 25, 70, 50);
    
    // "PARK HERE" text
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('🎯 GOAL', spotX - 30, spotY - 30);
    
    // ===== DRAW ALL 8 OBSTACLES (RED - Danger!) =====
    CONFIG.OBSTACLES.forEach(([ox, oy]) => {
        const obsX = (ox / 60) * width;
        const obsY = height - (oy / 40) * height;
        
        // Glowing danger effect
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 15;
        
        // Main obstacle circle
        ctx.beginPath();
        ctx.arc(obsX, obsY, 18, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
        
        // White X mark (danger sign)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(obsX - 8, obsY - 8);
        ctx.lineTo(obsX + 8, obsY + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obsX + 8, obsY - 8);
        ctx.lineTo(obsX - 8, obsY + 8);
        ctx.stroke();
        
        // Obstacle number (small)
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = 'white';
        // Finding index for display - simplified
        const index = CONFIG.OBSTACLES.findIndex(obs => obs[0] === ox && obs[1] === oy) + 1;
        ctx.fillText(index, obsX - 3, obsY - 15);
    });
    
    // ===== DRAW THE CAR (BLUE - The Learner) =====
    const carX = (x / 60) * width;
    const carY = height - (y / 40) * height;
    
    // Car shadow
    ctx.shadowColor = '#4a6fa5';
    ctx.shadowBlur = 20;
    
    // Car body (blue normally, yellow when successful)
    ctx.fillStyle = isSuccess ? '#ffd166' : '#4a6fa5';
    ctx.fillRect(carX - 20, carY - 15, 40, 30);
    
    // Windows
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(carX - 12, carY - 10, 24, 6);
    
    // Wheels
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(carX - 25, carY - 20, 8, 6);  // Front left
    ctx.fillRect(carX + 17, carY - 20, 8, 6);  // Front right
    ctx.fillRect(carX - 25, carY + 14, 8, 6);  // Rear left
    ctx.fillRect(carX + 17, carY + 14, 8, 6);  // Rear right
    
    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Car label
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('🚗', carX - 8, carY - 18);
    
    // Draw distance text if far from goal
    const distance = Math.sqrt((x - CONFIG.PARKING_SPOT[0])**2 + (y - CONFIG.PARKING_SPOT[1])**2);
    if (distance > 5) {
        ctx.font = '12px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Distance: ${distance.toFixed(1)}m`, 10, 30);
    }
}

// ===== REWARD CHART SETUP =====
let rewardChart = null;
try {
    const chartElement = document.getElementById('rewardChart');
    if (chartElement) {
        const chartCtx = chartElement.getContext('2d');
        rewardChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Reward',
                    data: [],
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#4ecdc4'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        backgroundColor: '#1e2b45',
                        titleColor: '#fff',
                        bodyColor: '#ddd'
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: false,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: { 
                            display: true, 
                            text: 'Reward',
                            color: '#666'
                        }
                    },
                    x: { 
                        title: { 
                            display: true, 
                            text: 'Attempt Number',
                            color: '#666'
                        },
                        grid: { display: false }
                    }
                }
            }
        });
        console.log('Chart initialized successfully');
    } else {
        console.warn('Chart element not found');
    }
} catch (e) {
    console.error('Chart error:', e);
}

// ===== CONNECT TO BACKEND (Server-Sent Events) =====
function connectToStream() {
    // Close existing connection if any
    if (state.eventSource) {
        state.eventSource.close();
    }
    
    // Create new connection
    state.eventSource = new EventSource(`${CONFIG.API_URL}/stream`);
    
    // When connection opens
    state.eventSource.onopen = () => {
        const dot = document.querySelector('.status-dot');
        if (dot) {
            dot.className = 'status-dot connected';
        }
        if (elements.statusText) {
            elements.statusText.textContent = 'Connected';
        }
        updateHappeningNow('✅ Connected to AI. Click START to begin learning.');
        console.log('Connected to backend');
    };
    
    // When data arrives
    state.eventSource.onmessage = (e) => {
        // Only process if training is active
        if (!state.trainingActive) return;
        
        try {
            const data = JSON.parse(e.data);
            state.currentData = data;
            
            // Update canvas with new position
            drawCar(data.x, data.y, data.success);
            
            // Update stats display
            if (elements.episode) elements.episode.textContent = data.episode;
            if (elements.reward) elements.reward.textContent = data.reward.toFixed(1);
            if (elements.distance) elements.distance.textContent = data.distance.toFixed(1) + 'm';
            if (elements.epsilon) elements.epsilon.textContent = data.epsilon.toFixed(3);
            if (elements.steps) elements.steps.textContent = data.steps;
            
            // Track successes
            if (data.success) {
                state.stats.successes++;
                updateHappeningNow('🎉 SUCCESS! Car parked perfectly! 🎉');
                updateStatusMessage('🎉 Success! The AI learned to park!');
            } 
            // Track collisions
            else if (data.collision) {
                updateHappeningNow('💥 OOPS! Hit obstacle ' + getObstacleNumber(data.x, data.y) + '. Learning from mistake...');
            } 
            // Track progress
            else {
                if (data.distance < 5) {
                    updateHappeningNow('🟢 Getting VERY close to the spot! Almost there!');
                } else if (data.distance < 10) {
                    updateHappeningNow('🟡 Moving closer to the goal... Keep going!');
                } else if (data.episode > 0 && data.episode % 10 === 0) {
                    updateHappeningNow('📊 Episode ' + data.episode + ' - AI is learning patterns');
                } else {
                    updateHappeningNow('🔵 Exploring the parking lot...');
                }
            }
            
            // Update total episodes count
            if (data.episode > state.stats.totalEpisodes) {
                state.stats.totalEpisodes = data.episode;
            }
            
            // Calculate and display success rate
            const rate = state.stats.totalEpisodes > 0 
                ? Math.round((state.stats.successes / state.stats.totalEpisodes) * 100) 
                : 0;
            if (elements.successRate) {
                elements.successRate.textContent = rate + '%';
            }
            
            // Add to history for graph
            state.history.episodes.push(data.episode);
            state.history.rewards.push(data.reward);
            state.history.epsilons.push(data.epsilon);
            
            // Keep only last 50 points
            if (state.history.episodes.length > CONFIG.MAX_HISTORY) {
                state.history.episodes.shift();
                state.history.rewards.shift();
                state.history.epsilons.shift();
            }
            
            // Update chart if it exists
            if (rewardChart) {
                rewardChart.data.labels = [...state.history.episodes];
                rewardChart.data.datasets[0].data = [...state.history.rewards];
                rewardChart.update();
            }
            
        } catch (error) {
            console.error('Error processing data:', error);
        }
    };
    
    // Handle connection errors
    state.eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        const dot = document.querySelector('.status-dot');
        if (dot) {
            dot.className = 'status-dot disconnected';
        }
        if (elements.statusText) {
            elements.statusText.textContent = 'Disconnected';
        }
        updateHappeningNow('❌ Connection lost. Make sure backend is running!');
    };
}

// Helper function to find which obstacle was hit
function getObstacleNumber(x, y) {
    let minDist = 999;
    let idx = -1;
    CONFIG.OBSTACLES.forEach((obs, index) => {
        const dist = Math.sqrt((x - obs[0])**2 + (y - obs[1])**2);
        if (dist < minDist) {
            minDist = dist;
            idx = index + 1;
        }
    });
    return idx;
}

// ===== SHOW Q-TABLE FUNCTION =====
async function showQTable() {
    console.log('Show Q-Table button clicked');
    try {
        // Show loading message
        updateHappeningNow('📊 Loading Q-table data...');
        
        // Fetch Q-table from backend
        const response = await fetch(`${CONFIG.API_URL}/get-qtable`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Q-Table data received:', data);
        
        // Create a new window for Q-table display
        const tableWindow = window.open('', 'QTableWindow', 
            'width=1000,height=700,scrollbars=yes,resizable=yes');
        
        if (!tableWindow) {
            alert('Popup blocked! Please allow popups for this site.');
            return;
        }
        
        // Write HTML to the new window
        tableWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Q-Table Viewer - Parking AI</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        font-family: 'Segoe UI', monospace;
                    }
                    body {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 30px;
                        min-height: 100vh;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        padding: 25px;
                        max-width: 1200px;
                        margin: 0 auto;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    }
                    h1 {
                        color: #1e2b45;
                        font-size: 28px;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border-bottom: 3px solid #9b59b6;
                        padding-bottom: 15px;
                    }
                    h1 i {
                        color: #9b59b6;
                        font-size: 32px;
                    }
                    .info-bar {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 20px;
                        border-radius: 15px;
                        margin-bottom: 25px;
                        display: flex;
                        gap: 40px;
                        flex-wrap: wrap;
                        color: white;
                        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
                    }
                    .info-item {
                        display: flex;
                        flex-direction: column;
                    }
                    .info-label {
                        font-size: 12px;
                        text-transform: uppercase;
                        opacity: 0.8;
                        letter-spacing: 1px;
                    }
                    .info-value {
                        font-size: 28px;
                        font-weight: bold;
                    }
                    .legend {
                        background: #f0f4ff;
                        padding: 15px 20px;
                        border-radius: 12px;
                        margin-bottom: 20px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 25px;
                        border: 1px solid #e0e7ff;
                    }
                    .legend-item {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 14px;
                    }
                    .color-box {
                        width: 24px;
                        height: 24px;
                        border-radius: 6px;
                    }
                    .color-box.best { 
                        background: #4ecdc4;
                        box-shadow: 0 0 10px #4ecdc4;
                    }
                    .color-box.good { background: #a8e6cf; }
                    .color-box.bad { background: #ff8a80; }
                    .color-box.neutral { background: #f5f5f5; border: 1px solid #ddd; }
                    
                    .action-bar {
                        background: #f8f9fc;
                        padding: 15px;
                        border-radius: 12px;
                        margin-bottom: 20px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 15px;
                        justify-content: space-around;
                        border: 1px solid #e0e7ff;
                    }
                    .action-tag {
                        padding: 8px 16px;
                        border-radius: 30px;
                        font-size: 13px;
                        font-weight: bold;
                        color: white;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    }
                    .action-0 { background: #95a5a6; }  /* NO-OP */
                    .action-1 { background: #3498db; }  /* LEFT */
                    .action-2 { background: #e67e22; }  /* RIGHT */
                    .action-3 { background: #f1c40f; color: #1e2b45; }  /* UP */
                    .action-4 { background: #9b59b6; }  /* DOWN */
                    .action-5 { background: #2ecc71; }  /* PARK */
                    
                    .table-container {
                        overflow-x: auto;
                        max-height: 400px;
                        overflow-y: auto;
                        border: 2px solid #e0e7ff;
                        border-radius: 15px;
                        margin-top: 20px;
                        box-shadow: 0 10px 20px rgba(0,0,0,0.05);
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        font-size: 13px;
                        background: white;
                    }
                    th {
                        background: #1e2b45;
                        color: white;
                        padding: 15px 8px;
                        position: sticky;
                        top: 0;
                        font-weight: 600;
                        font-size: 14px;
                        z-index: 10;
                    }
                    td {
                        border: 1px solid #e0e7ff;
                        padding: 10px 8px;
                        text-align: center;
                    }
                    tr:nth-child(even) {
                        background: #f8faff;
                    }
                    tr:hover {
                        background: #eef2ff;
                    }
                    .state-col {
                        background: #f0f4ff;
                        font-weight: bold;
                        color: #1e2b45;
                        position: sticky;
                        left: 0;
                        z-index: 5;
                    }
                    .best-action {
                        background: #4ecdc4 !important;
                        color: white;
                        font-weight: bold;
                        position: relative;
                    }
                    .best-action::after {
                        content: "👑";
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        font-size: 12px;
                    }
                    .good-value {
                        background: #a8e6cf;
                    }
                    .bad-value {
                        background: #ff8a80;
                    }
                    .footer {
                        margin-top: 25px;
                        text-align: center;
                        color: #6c7a8e;
                        font-size: 13px;
                        padding: 15px;
                        background: #f8f9fc;
                        border-radius: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>
                        <i class="fas fa-brain"></i> 
                       Q-Table(Learned State–Action Values of the Agent)
                    </h1>
                    
                    <div class="info-bar">
                        <div class="info-item">
                            <span class="info-label">Current Episode</span>
                            <span class="info-value">${data.episode || 0}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Randomness (ε)</span>
                            <span class="info-value">${(data.epsilon || 0.5).toFixed(3)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Q-Table Size</span>
                            <span class="info-value">${data.shape ? data.shape[0] : 60} × ${data.shape ? data.shape[1] : 6}</span>
                        </div>
                    </div>
                    
                    <div class="legend">
                        <div class="legend-item">
                            <span class="color-box best"></span>
                            <span><strong>👑 Best Action</strong> -Action Selected Based on Maximum Q-Value</span>
                        </div>
                        <div class="legend-item">
                            <span class="color-box good"></span>
                            <span><strong>Good Values</strong> (positive) -High-Reward Actions</span>
                        </div>
                        <div class="legend-item">
                            <span class="color-box bad"></span>
                            <span><strong>Bad Values</strong> (negative) - Low-Reward Actions</span>
                        </div>
                    </div>
                    
                    <div class="action-bar">
                        <span class="action-tag action-0">Action 0: NO-OP</span>
                        <span class="action-tag action-1">Action 1: LEFT</span>
                        <span class="action-tag action-2">Action 2: RIGHT</span>
                        <span class="action-tag action-3">Action 3: UP</span>
                        <span class="action-tag action-4">Action 4: DOWN</span>
                        <span class="action-tag action-5">Action 5: PARK</span>
                    </div>
                    
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>State</th>
                                    <th>NO-OP (0)</th>
                                    <th>LEFT (1)</th>
                                    <th>RIGHT (2)</th>
                                    <th>UP (3)</th>
                                    <th>DOWN (4)</th>
                                    <th>PARK (5)</th>
                                </tr>
                            </thead>
                            <tbody>
        `);
        
        // Add table rows
        const qTable = data.q_table || [];
        for (let state = 0; state < Math.min(60, qTable.length); state++) {
            const row = qTable[state];
            if (!row) continue;
            
            // Find best action for this state
            const bestAction = row.indexOf(Math.max(...row));
            
            tableWindow.document.write('<tr>');
            tableWindow.document.write(`<td class="state-col">State ${state}</td>`);
            
            row.forEach((value, action) => {
                let cssClass = '';
                if (action === bestAction) {
                    cssClass = 'best-action';
                } else if (value > 5) {
                    cssClass = 'good-value';
                } else if (value < -20) {
                    cssClass = 'bad-value';
                }
                
                tableWindow.document.write(
                    `<td class="${cssClass}">${value.toFixed(2)}</td>`
                );
            });
            
            tableWindow.document.write('</tr>');
        }
        
        tableWindow.document.write(`
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="footer">
                        <p>📈 <strong>Higher numbers = Better actions</strong> | 👑 Crown = Best choice</p>
                        <p>💡 As the AI learns, you'll see the numbers change!</p>
                    </div>
                </div>
            </body>
            </html>
        `);
        
        updateHappeningNow('📊 Q-table displayed in new window');
        
    } catch (error) {
        console.error('Error fetching Q-table:', error);
        alert('❌ Could not fetch Q-table. Make sure backend is running!\n\nError: ' + error.message);
        updateHappeningNow('❌ Failed to load Q-table');
    }
}

// ===== BUTTON ACTION FUNCTIONS =====
async function startTraining() {
    console.log('Start button clicked');
    try {
        const response = await fetch(`${CONFIG.API_URL}/start-training`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error('Server error');
        }
        
        state.trainingActive = true;
        if (elements.startBtn) elements.startBtn.disabled = true;
        if (elements.stopBtn) elements.stopBtn.disabled = false;
        
        updateStatusMessage('🧠 AI is learning... Watch it improve over time!');
        updateHappeningNow('🚀 Training started! AI is trying to park...');
        
        // Connect to stream
        connectToStream();
        
    } catch (error) {
        console.error('Connection error:', error);
        alert('❌ Cannot connect to backend!\n\nMake sure to:\n1. Open terminal\n2. cd backend\n3. Run: uvicorn main:app --reload');
    }
}

async function stopTraining() {
    console.log('Stop button clicked');
    try {
        await fetch(`${CONFIG.API_URL}/stop-training`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        state.trainingActive = false;
        if (elements.startBtn) elements.startBtn.disabled = false;
        if (elements.stopBtn) elements.stopBtn.disabled = true;
        
        // Close event source
        if (state.eventSource) {
            state.eventSource.close();
            state.eventSource = null;
        }
        
        updateStatusMessage('⏸️ Training paused. Click START to continue.');
        updateHappeningNow('⏸️ Training paused. AI is waiting for your command.');
        
    } catch (error) {
        console.error('Stop error:', error);
    }
}

async function resetEnvironment() {
    console.log('Reset button clicked');
    try {
        await fetch(`${CONFIG.API_URL}/reset`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        // Reset state
        state.currentData = { 
            x: 10, y: 10, 
            reward: 0, 
            episode: 0, 
            epsilon: 0.5, 
            steps: 0, 
            distance: 0, 
            success: false, 
            collision: false 
        };
        state.stats = { successes: 0, totalEpisodes: 0 };
        state.history = { episodes: [], rewards: [], epsilons: [] };
        
        // Update UI
        drawCar(10, 10, false);
        
        if (elements.episode) elements.episode.textContent = '0';
        if (elements.reward) elements.reward.textContent = '0';
        if (elements.distance) elements.distance.textContent = '0m';
        if (elements.epsilon) elements.epsilon.textContent = '0.5';
        if (elements.steps) elements.steps.textContent = '0';
        if (elements.successRate) elements.successRate.textContent = '0%';
        
        // Reset chart
        if (rewardChart) {
            rewardChart.data.labels = [];
            rewardChart.data.datasets[0].data = [];
            rewardChart.update();
        }
        
        updateStatusMessage('🔄 System reset. Ready to start fresh!');
        updateHappeningNow('🔄 Reset complete. Click START to begin learning.');
        
    } catch (error) {
        console.error('Reset error:', error);
    }
}

async function saveModel() {
    console.log('Save button clicked');
    try {
        await fetch(`${CONFIG.API_URL}/save-model`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        alert('💾 AI brain saved! The learning progress is stored in models/q_table_v1.npy');
    } catch (error) {
        console.error('Save error:', error);
        alert('❌ Could not save model. Make sure backend is running.');
    }
}

// ===== ADD EVENT LISTENERS TO BUTTONS =====
if (elements.startBtn) {
    elements.startBtn.addEventListener('click', startTraining);
    console.log('Start button listener added');
} else {
    console.error('Start button not found!');
}

if (elements.stopBtn) {
    elements.stopBtn.addEventListener('click', stopTraining);
    console.log('Stop button listener added');
}

if (elements.resetBtn) {
    elements.resetBtn.addEventListener('click', resetEnvironment);
    console.log('Reset button listener added');
}

if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', saveModel);
    console.log('Save button listener added');
}

if (elements.showQTableBtn) {
    elements.showQTableBtn.addEventListener('click', showQTable);
    console.log('Show Q-Table button listener added');
} else {
    console.error('Show Q-Table button not found! Check if id="showQTableBtn" exists in HTML');
}

// ===== INITIAL SETUP =====
function initialize() {
    console.log('Initializing application...');
    // Draw initial car position
    drawCar(10, 10, false);
    
    // Set initial messages
    updateStatusMessage('👋Click START to observe the reinforcement learning agent performing autonomous vehicle parking.');
    updateHappeningNow('⏸️ System ready. Click START to begin!');
    
    // Check connection on load
    setTimeout(() => {
        fetch(`${CONFIG.API_URL}/`)
            .then(() => {
                const dot = document.querySelector('.status-dot');
                if (dot) {
                    dot.className = 'status-dot connected';
                }
                if (elements.statusText) {
                    elements.statusText.textContent = 'Connected';
                }
                console.log('Backend connection verified');
            })
            .catch(() => {
                const dot = document.querySelector('.status-dot');
                if (dot) {
                    dot.className = 'status-dot disconnected';
                }
                if (elements.statusText) {
                    elements.statusText.textContent = 'Disconnected';
                }
                updateHappeningNow('⚠️ Backend not running. Run: uvicorn main:app --reload');
                console.warn('Backend not reachable');
            });
    }, 500);
}

// Start everything when page loads
window.addEventListener('load', initialize);