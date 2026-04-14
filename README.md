# RealChatX
A real-time, responsive, full-stack chat application built with the MERN stack and Socket.IO.

## Features
- **Real-Time Messaging**: Send and receive text, images, and audio messages instantly without needing to refresh.
- **Group Chats**: Create groups, update group names, change icons, and manage members seamlessly with instant UI previews.
- **Dynamic Themes/Wallpapers**: Customize your chat experience by adding backgrounds.
- **Smart Reactions & Context**: React to individual messages safely without UI jitter/bubbling, reply within context threads, and interact beautifully.
- **Responsive Layout**: Designed mobile-first. Scales fluidly up to desktop wide-screen views with collapse-enabled sidebar and flexible chat bubbles.
- **Audio & Video Call Architecture**: (Integration ready).

## Tech Stack
- **Frontend**: React, TailwindCSS, Motion (for fluid animations), Lucide Docs.
- **Backend / API**: Node.js, Express, MongoDB (Mongoose).
- **Websockets**: Socket.IO for robust 2-way real-time payloads.
- **File Uploads**: Cloudinary (or compatible form upload handling) / Multer.

## Setup Instructions
1. **Clone & Install Dependencies**
   Navigate into both `/client` and `/server` and run `npm install`.

2. **Environment Variables**
   Set up your `.env` connecting your MongoDB cluster, JWT Secret, and Port in the `/server` folder.

3. **Run Services**
   - For backend: `cd server && npm start`
   - For frontend: `cd client && npm run dev`

## Folder Structure
```
/client
 ├── public
 ├── src
 │   ├── components/chat (All Chat UI elements)
 │   ├── context (Auth, Chat & Theme state management)
 │   ├── pages (Home page, Chat Room routing)
 │   └── services (API interceptors)
/server
 ├── controllers
 ├── models
 ├── routes
 └── server.js (Socket.IO & Express entry point)
```

_Engineered for modern, secure communication._
