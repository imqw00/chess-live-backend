const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let currentFen = 'start';
let moveHistory = [];
let loggedIn = false;
let page;

async function initBrowser() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  page = await browser.newPage();
  await page.goto('https://www.chess.com/login');
  console.log('Browser ready, waiting for login...');
}

async function startWatching() {
  setInterval(async () => {
    try {
      const fen = await page.evaluate(() => {
        const board = document.querySelector('chess-board');
        return board ? board.fen : null;
      });

      if (fen && fen !== currentFen) {
        currentFen = fen;
        moveHistory.push(fen);
        console.log('New FEN:', fen);
      }
    } catch (e) {
      console.error('Error reading FEN:', e);
    }
  }, 1000);
}

// You hit this endpoint with your username and password to log in
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    await page.type('#username', username);
    await page.type('#password', password);
    await page.click('.login-button');
    await page.waitForNavigation();

    loggedIn = true;
    startWatching();
    console.log('Logged in as', username);
    res.json({ success: true, message: 'Logged in, watching for games' });
  } catch (e) {
    res.status(500).json({ error: 'Login failed', details: e.message });
  }
});

app.get('/fen', (req, res) => {
  if (!loggedIn) return res.status(401).json({ error: 'Not logged in yet' });
  res.json({ fen: currentFen, history: moveHistory });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => {
  console.log('Server running on port 3000');
  initBrowser();
});
