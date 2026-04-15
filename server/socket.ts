import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { db } from "./db";
import { users, participants, messages } from "@shared/schema";
import { eq } from "drizzle-orm";

export function setupSocketIO(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" 
        ? false 
        : ["http://localhost:5173", "http://localhost:5000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Store io instance globally for use in routes
  (global as any).io = io;

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // User joins their personal room for notifications
    socket.on("user:online", async (userId: number) => {
      if (!userId) return;
      
      socket.join(`user:${userId}`);
      socket.data.userId = userId;

      // Update user online status
      try {
        await db.update(users)
          .set({ isOnline: true, lastSeen: new Date() })
          .where(eq(users.id, userId));

        // Notify others
        socket.broadcast.emit("user:status", { userId, isOnline: true });
      } catch (error) {
        console.error("Error updating user online status:", error);
      }

      console.log(`👤 User ${userId} is online`);
    });

    // User joins a conversation room
    socket.on("conversation:join", (conversationId: number) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 User joined conversation: ${conversationId}`);
    });

    // User leaves a conversation room
    socket.on("conversation:leave", (conversationId: number) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`👋 User left conversation: ${conversationId}`);
    });

    // Typing indicator
    socket.on("typing:start", ({ conversationId, userId, userName }) => {
      socket.to(`conversation:${conversationId}`).emit("typing:start", { userId, userName });
    });

    socket.on("typing:stop", ({ conversationId, userId }) => {
      socket.to(`conversation:${conversationId}`).emit("typing:stop", { userId });
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      const userId = socket.data.userId;
      if (userId) {
        try {
          await db.update(users)
            .set({ isOnline: false, lastSeen: new Date() })
            .where(eq(users.id, userId));

          socket.broadcast.emit("user:status", { userId, isOnline: false });
        } catch (error) {
          console.error("Error updating user offline status:", error);
        }
      }
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });

  return io;
}
