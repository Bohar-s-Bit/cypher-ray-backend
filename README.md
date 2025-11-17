# Cypher-Ray Backend

Backend API server for the Cypher-Ray firmware analysis platform.

## Features

- User authentication and authorization
- Credit-based payment system with Razorpay integration
- Email notifications (welcome emails, payment confirmations)
- Job queue system for firmware analysis
- Admin dashboard with user management
- SDK API endpoints for firmware scanning

## Tech Stack

- **Runtime**: Node.js + Express
- **Database**: MongoDB (standalone mode)
- **Payment Gateway**: Razorpay
- **Email Service**: Resend API
- **Queue**: Bull with Redis
- **Authentication**: JWT

## Setup

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Redis (for job queue)
- Resend account (for emails)
- Razorpay account (for payments)

### Installation

1. Clone the repository and navigate to backend:

```bash
cd cypher-ray-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

4. Configure environment variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/cypher-ray

# JWT
JWT_SECRET=your_secure_jwt_secret
JWT_ADMIN_SECRET=your_admin_jwt_secret

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=onboarding@yourdomain.com
EMAIL_FROM_NAME=Cypher-Ray

# Razorpay
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# ML Service
ML_SERVICE_URL=http://localhost:8000
```

### Email Setup (Resend)

1. Create a free account at [Resend.com](https://resend.com)
2. Verify your domain (or use their dev domain for testing)
3. Generate an API key from the dashboard
4. Add to `.env`:
   ```
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_FROM=onboarding@yourdomain.com
   ```

**Why Resend?**

- Works in production environments (Render, Heroku, etc.)
- Uses HTTPS API (no SMTP port blocking issues)
- 3,000 free emails/month
- Better deliverability than Gmail SMTP
- Simple API integration

### Razorpay Setup

1. Create account at [Razorpay](https://razorpay.com)
2. Get test mode credentials from dashboard
3. Add to `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_secret_key
   ```

### Database Setup

Start MongoDB:

```bash
# Local MongoDB
mongod --dbpath /path/to/data

# Or use MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/cypher-ray
```

### Redis Setup

Start Redis server:

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Or use Redis Cloud connection
```

## Running the Server

### Development Mode

```bash
npm run dev
```

Server will start on `http://localhost:5000`

### Production Mode

```bash
npm start
```

### Seed Admin User

Create initial admin account:

```bash
npm run seed:admin
```

Default credentials:

- Username: `admin`
- Password: `admin123`

**⚠️ Change these immediately in production!**

## API Endpoints

### User Routes (`/api/user`)

- `POST /register` - Register new user
- `POST /login` - User login
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `GET /credits` - Check credit balance

### Admin Routes (`/api/admin`)

- `POST /login` - Admin login
- `GET /users` - List all users
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `GET /stats` - Dashboard statistics

### SDK Routes (`/api/sdk`)

- `POST /scan` - Submit firmware for analysis
- `GET /scan/:id` - Get scan results
- `GET /scans` - List user scans

### Payment Routes (`/api/payments`)

- `POST /create-order` - Create Razorpay order
- `POST /verify-payment` - Verify payment and add credits

## Project Structure

```
cypher-ray-backend/
├── config/           # Configuration files
│   ├── queue.js      # Bull queue config
│   └── redis.js      # Redis connection
├── controllers/      # Route controllers
│   ├── admin.controllers.js
│   ├── sdk.controller.js
│   └── user.controllers.js
├── middleware/       # Express middleware
│   ├── auth.js       # JWT authentication
│   ├── admin.auth.js # Admin authentication
│   └── validator.js  # Request validation
├── models/           # Mongoose models
│   ├── user.model.js
│   ├── api.key.model.js
│   ├── analysis.job.model.js
│   └── credit.transaction.model.js
├── routes/           # API routes
│   ├── user.routes.js
│   ├── admin.routes.js
│   └── sdk.routes.js
├── services/         # Business logic
│   ├── user.service.js
│   ├── analysis.service.js
│   ├── credit.service.js
│   ├── payment.email.service.js
│   └── queue.worker.js
├── utils/            # Utility functions
│   ├── send.email.js
│   ├── jwt.js
│   ├── logger.js
│   └── file.handler.js
├── uploads/          # File uploads
└── server.js         # Entry point
```

## Deployment

### Render.com

1. Create new Web Service
2. Connect your GitHub repository
3. Configure build command:
   ```
   npm install
   ```
4. Configure start command:
   ```
   npm start
   ```
5. Add environment variables from `.env.example`
6. **Important**: Use Resend for emails (SMTP ports are blocked on Render)

### Environment Variables on Render

Add all variables from `.env.example` in the Render dashboard:

- `RESEND_API_KEY` - Your Resend API key
- `EMAIL_FROM` - Verified sender email
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Generate secure secret
- `RAZORPAY_KEY_ID` - Razorpay credentials
- `RAZORPAY_KEY_SECRET`
- `FRONTEND_URL` - Your frontend URL

**⚠️ Do NOT use Gmail SMTP on Render** - ports 25, 465, 587 are blocked

## Email System

### Migration from Gmail SMTP to Resend

Previous setup used Gmail SMTP which fails on Render/Heroku due to SMTP port blocking. New setup uses Resend API.

**Old (Gmail SMTP - Blocked in Production)**:

```javascript
nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // Blocked on Render!
  auth: { user, pass },
});
```

**New (Resend API - Works Everywhere)**:

```javascript
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({
  from: "onboarding@yourdomain.com",
  to: "user@example.com",
  subject: "Welcome",
  html: "<h1>Email content</h1>",
});
```

### Email Templates

1. **Welcome Email** (`utils/send.email.js`)

   - Sent when admin creates new user
   - Contains credentials and login instructions

2. **Payment Success Email** (`services/payment.email.service.js`)
   - Sent after successful payment
   - Shows payment details and credits added

## Troubleshooting

### Emails not sending in production

**Problem**: Connection timeout error with Gmail SMTP

```
Error: Connection timeout, code: 'ETIMEDOUT', command: 'CONN'
```

**Solution**: Use Resend API instead of SMTP

1. Get Resend API key
2. Update `.env`: `RESEND_API_KEY=re_your_key`
3. Code already uses Resend (no changes needed)

### MongoDB transaction errors

**Problem**: "Transaction numbers only allowed on replica set"

**Solution**: This is already handled - transactions are disabled for standalone MongoDB

### Payment webhook failures

Check:

- Razorpay webhook secret is correct
- Frontend URL is correct in `.env`
- CORS is configured properly

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run seed:admin` - Create admin user
- `npm test` - Run tests (if configured)

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

## License

MIT

## Support

For issues or questions, contact: aadipatel1911@gmail.com
