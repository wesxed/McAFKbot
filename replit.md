# ZeySense Hub

## Overview
ZeySense Hub is a Minecraft AFK Bot System with an Advanced Account System. It features a GameSense-style premium panel experience with user authentication, bot management, admin controls, and live support.

## Current State
- **Status**: Fully functional MVP
- **Last Updated**: December 12, 2025

## Features

### Authentication System
- User registration with optional invite codes
- Login with email/password
- Login with verification code
- Password reset via email code
- Session management with 30-day device remembering
- bcrypt password hashing for security

### User Roles
- **Owner** (karos): Full system access, can create/remove admins
- **Admin**: User management, ban/unban, HWID reset, invite generation
- **Member**: Basic access to profile, bot panel, support

### AFK Bot System
- Create and manage multiple bots
- Connect to any Minecraft server (1.8 - 1.21+)
- Bot behaviors: Idle, Rotate, Jump, Random Walk, Auto Chat
- Start/Stop/Delete bots
- Real-time bot logs

### Visitor Simulation
- Random visitors simulated every 3 minutes
- Displays visitor name, action, and timestamp
- Visible on the homepage

### Admin Panel
- User Manager
- Ban/Unban users
- HWID Reset
- Invite code generation

### Owner Panel
- All admin features plus:
- Create/Remove admins
- Activity logs
- User time extension

### Live Support
- Ticket system for user support
- Admin/Owner can respond to tickets
- Open/Close ticket status

## Project Structure
```
/
├── server.js           # Express backend with all API routes
├── public/
│   └── index.html      # Single-page application frontend
├── design_guidelines.md # UI/UX design guidelines
├── replit.md           # This file
└── package.json        # Dependencies
```

## Tech Stack
- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML/CSS/JS (Single Page Application)
- **Security**: bcryptjs for password hashing
- **Storage**: In-memory (Maps)

## API Routes

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - End session
- `POST /api/auth/request-verification` - Request email verification code
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/request-reset` - Request password reset code
- `POST /api/auth/reset-password` - Reset password with code
- `POST /api/auth/login-with-code` - Login with verification code

### User
- `GET /api/user/profile` - Get current user profile
- `PUT /api/user/profile` - Update profile

### Bots
- `GET /api/bots` - Get user's bots
- `POST /api/bots` - Create new bot
- `POST /api/bots/:botId/start` - Start bot
- `POST /api/bots/:botId/stop` - Stop bot
- `POST /api/bots/:botId/command` - Send command (Admin/Owner)
- `DELETE /api/bots/:botId` - Delete bot

### Tickets
- `GET /api/tickets` - Get tickets
- `POST /api/tickets` - Create ticket
- `POST /api/tickets/:ticketId/reply` - Reply to ticket
- `POST /api/tickets/:ticketId/close` - Close ticket

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/ban/:userId` - Ban user
- `POST /api/admin/unban/:userId` - Unban user
- `POST /api/admin/hwid-reset/:userId` - Reset HWID
- `POST /api/admin/invite` - Generate invite code
- `GET /api/admin/invites` - List invite codes

### Owner
- `POST /api/owner/create-admin` - Make user admin
- `POST /api/owner/remove-admin` - Remove admin role
- `POST /api/owner/add-time` - Add subscription time
- `GET /api/owner/logs` - View activity logs

## Default Owner Account
- **Username**: karos
- **Email**: karos@gmail.com
- **Password**: ruzgar20101903

## Development Notes
- Server runs on port 5000
- Random visitor simulation runs every 3 minutes (180000ms)
- Initial 5 visitors spawn at startup with 10-second intervals
- Verification/reset codes shown in console for demo purposes
