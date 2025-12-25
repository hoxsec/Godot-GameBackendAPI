<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.0+-f9f1e1?logo=bun&logoColor=black" alt="Bun">
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License">
</p>

<h1 align="center">🖥️ GameBackendAPI</h1>

<p align="center">
  <strong>Reference backend implementation for GameBackendSDK</strong><br>
  Fast Bun runtime + SQLite + Admin Dashboard
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-endpoints">API Endpoints</a> •
  <a href="#-admin-panel">Admin Panel</a> •
  <a href="#-deployment">Deployment</a>
</p>

> ⚠️ **This is the backend server.** You need both repositories to build a complete solution:
> - **Backend API**: [Godot-GameBackendAPI](https://github.com/hoxsec/Godot-GameBackendAPI) (server-side - this repo)
> - **Godot SDK**: [Godot-GameBackendSDK](https://github.com/hoxsec/Godot-GameBackendSDK) (client-side)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **Bun Runtime** | Lightning-fast JavaScript runtime |
| 🗃️ **SQLite Database** | Persistent storage, zero configuration |
| 🔑 **JWT Authentication** | Secure access & refresh token system |
| 📊 **Admin Dashboard** | Real-time stats, user management, live console |
| 🔌 **WebSocket** | Live request streaming to admin panel |
| 🛡️ **Security** | Helmet.js, CORS, request logging |
| ✅ **Guest Auth** | Guest authentication support |
| 💾 **Cloud Storage** | Key-value storage with versioning |
| 🏆 **Leaderboards** | Automatic ranking system |
| ⚙️ **Remote Config** | Platform-specific configuration |

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [Godot-GameBackendSDK](https://github.com/hoxsec/Godot-GameBackendSDK) (for testing with Godot)

### Installation

```bash
git clone https://github.com/hoxsec/Godot-GameBackendAPI.git
cd Godot-GameBackendAPI
bun install
```

### Development

```bash
bun dev
```

The server starts at `http://localhost:3000`

### Testing with Godot

1. Make sure this backend server is running
2. Install the [Godot-GameBackendSDK](https://github.com/hoxsec/Godot-GameBackendSDK) in your Godot project
3. Initialize the SDK with `http://localhost:3000` as the base URL
4. Test all features using the demo scene included in the SDK

### Production

```bash
bun start
```

---

## 📊 Admin Panel

The backend includes a modern admin panel with real-time features:

| Page | Description |
|------|-------------|
| 📈 **Dashboard** | Live RPS chart, stats overview, recent requests |
| 📡 **Console** | Real-time request streaming via WebSocket |
| 👥 **Users** | User management, ban/unban functionality |
| 💾 **KV Store** | Browse and manage key-value data |
| 🏆 **Leaderboards** | View and manage leaderboard entries |
| 🔧 **Endpoints** | Interactive API tester |

**Access:** http://localhost:3000/dashboard  
**Default Credentials:** `admin` / `admin123`

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/auth/guest` | Create guest session |
| `POST` | `/v1/auth/register` | Register new user |
| `POST` | `/v1/auth/login` | Login existing user |
| `POST` | `/v1/auth/refresh` | Refresh access token |
| `POST` | `/v1/auth/logout` | Logout (invalidate tokens) |

### Cloud Storage

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/kv/:key` | Get stored value |
| `PUT` | `/v1/kv/:key` | Set value |
| `DELETE` | `/v1/kv/:key` | Delete value |

### Leaderboards

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/leaderboards/:board/submit` | Submit score |
| `GET` | `/v1/leaderboards/:board/top` | Get top entries |
| `GET` | `/v1/leaderboards/:board/me` | Get user's rank |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/config` | Get remote config |
| `GET` | `/health` | Health check |

---

## 💻 Example Requests

### Create Guest Session

```bash
curl -X POST http://localhost:3000/v1/auth/guest
```

Response:
```json
{
  "user_id": "guest_1234567890_abc123",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

### Register User

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "player@example.com", "password": "secure123"}'
```

### Save Cloud Data

```bash
curl -X PUT http://localhost:3000/v1/kv/player_data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": {"level": 10, "coins": 5000}}'
```

### Submit Score

```bash
curl -X POST http://localhost:3000/v1/leaderboards/global/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 9999}'
```

### Get Top Scores

```bash
curl "http://localhost:3000/v1/leaderboards/global/top?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=production
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `dev-secret` | JWT signing secret (⚠️ change in production!) |
| `NODE_ENV` | `development` | Environment mode |

---

## 🗃️ Database

This backend uses **SQLite** for persistent storage via Bun's built-in SQLite support.

### Database Schema

- **users**: Stores user accounts (guest & registered)
- **kv_store**: Key-value storage per user with versioning
- **leaderboards**: Score submissions with automatic ranking
- **refresh_tokens**: Token tracking and revocation

### Database Location

The database file is created at `game.db` on first run.

### Database Management

The backend includes database management tools:

```bash
bun run db:stats   # Show database statistics
bun run db:export  # Export to JSON
bun run db:clear   # Clear all data (keeps schema)
bun run db:reset   # Full reset (WARNING: deletes everything!)
```

To reset manually, delete `game.db` and restart the server.

### Viewing Database Contents

Use any SQLite viewer or the `sqlite3` CLI:

```bash
sqlite3 game.db
sqlite> SELECT * FROM users;
sqlite> SELECT * FROM leaderboards;
sqlite> .quit
```

---

## 🚢 Deployment

### Option 1: Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/)

1. Create a new project on [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Add environment variables:
   ```
   PORT=3000
   JWT_SECRET=your-super-secret-key-change-this
   NODE_ENV=production
   ```
4. Deploy!

### Option 2: Render

1. Create a new Web Service on [Render](https://render.com/)
2. Connect your repository
3. Configure:
   - **Build Command**: `bun install`
   - **Start Command**: `bun start`
4. Add environment variables
5. Deploy!

### Option 3: Docker

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production

COPY . .

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "start"]
```

Build and run:
```bash
docker build -t gamebackend .
docker run -d -p 3000:3000 -e JWT_SECRET=your-secret gamebackend
```

### Option 4: VPS / Self-Hosted

```bash
# Install dependencies
bun install

# Create environment file
cat > .env << EOF
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=production
EOF

# Start with PM2 (recommended for production)
npm install -g pm2
pm2 start "bun start" --name gamebackend

# Or run directly
bun start
```

---

## 📁 Project Structure

```
GameBackendAPI/
├── server.js              # Main Express server
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── kv.js             # Cloud storage endpoints
│   ├── leaderboards.js   # Leaderboard endpoints
│   ├── config.js         # Remote config endpoint
│   └── admin.js          # Admin API endpoints
├── utils/
│   ├── auth.js           # JWT helpers & middleware
│   ├── database.js       # SQLite setup & queries
│   ├── websocket.js      # WebSocket server
│   └── requestLogger.js  # Request logging
├── public/               # Admin panel HTML/CSS/JS
│   ├── dashboard.html
│   ├── console.html
│   ├── users.html
│   ├── kv.html
│   ├── leaderboards.html
│   └── endpoints.html
├── package.json
├── db-tools.js           # Database management utilities
└── README.md
```

---

## ⚠️ Production Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong, unique value
- [ ] Enable HTTPS (use a reverse proxy like nginx/caddy)
- [ ] Implement password hashing (bcrypt)
- [ ] Add rate limiting
- [ ] Set up database backups
- [ ] Configure proper logging
- [ ] Change default admin credentials
- [ ] Review CORS settings
- [ ] Add input validation
- [ ] Set up monitoring (Sentry, etc.)

---

## 🧪 Testing

```bash
bun run test:db    # Test database operations
```

---

## 🔍 Troubleshooting

Having issues? Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) for common problems:

- **SQLITE_CONSTRAINT_FOREIGNKEY** - Invalid session after database reset
- **Database locked** - Multiple processes accessing database  
- **Token expired** - Need to refresh access token

## 📚 Resources

- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [SQLite Implementation Details](./SQLITE_IMPLEMENTATION.md) - Full database documentation
- [Bun SQLite Documentation](https://bun.sh/docs/api/sqlite)
- [SQLite Official Documentation](https://www.sqlite.org/docs.html)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](../LICENSE) file for details.

---

## 💬 Support

- 🔗 [Godot SDK Repository](https://github.com/hoxsec/Godot-GameBackendSDK)
- 🐛 [Report Issues](https://github.com/hoxsec/Godot-GameBackendAPI/issues)
- 💡 [Request Features](https://github.com/hoxsec/Godot-GameBackendAPI/issues)

---

<p align="center">
  Made with ❤️ for game developers
</p>
