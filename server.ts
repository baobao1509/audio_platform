import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";

// Load environment variables from .env file
dotenv.config();

// Admin credentials from environment variables (overridable without exposing in source files)
const getAdminUsername = (): string => {
  const val = process.env.ADMIN_USERNAME;
  if (typeof val === "string" && val.trim() !== "" && val !== "undefined") {
    return val;
  }
  return "myadminaccount";
};

const getAdminPassword = (): string => {
  const val = process.env.ADMIN_PASSWORD;
  if (typeof val === "string" && val.trim() !== "" && val !== "undefined") {
    return val;
  }
  return "adminpassword!@#";
};

const ADMIN_USERNAME = getAdminUsername();
const ADMIN_PASSWORD = getAdminPassword();


// Define TypeScript structures for static types
interface Participant {
  id: string;
  name: string;
  role: "admin" | "listener";
  joinedAt: number;
  lastSeen: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface AudioState {
  url: string;
  name: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
}

interface Room {
  id: string;
  participants: Record<string, Participant>;
  audioState: AudioState;
  chatMessages: ChatMessage[];
  adminId: string | null;
  createdAt?: number;
}

// In-memory rooms storage (used as cache or as active store if MongoDB is not present)
const rooms: Record<string, Room> = {};

// Default mock audio track URLs to make testing instant and pleasant
const DEFAULT_TRACKS = [
  {
    name: "Lofi Chill Sunset (Relaxing Beat)",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  {
    name: "Deep Focus Ambient Synth",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
  },
  {
    name: "Cozy Morning Coffee Jazz",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
  }
];

// --- MongoDB Atlas Connection & Schema Setup ---
const MONGODB_URI = process.env.MONGODB_URI;
let useMongoDB = false;

if (MONGODB_URI) {
  console.log("🔌 Attempting connection to MongoDB Atlas...");
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log("🔌 Connected to MongoDB Atlas successfully!");
      useMongoDB = true;
      await seedAdminUser();
    })
    .catch((err) => {
      console.error("❌ Failed to connect to MongoDB Atlas:", err);
      console.warn("⚠️ Continuing with in-memory rooms storage fallback.");
    });
} else {
  console.warn("⚠️ MONGODB_URI not found in environment variables. Operating in in-memory mode.");
}

// Define Mongoose Schema for persistence
const ParticipantSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["admin", "listener"], required: true },
  joinedAt: { type: Number, required: true },
  lastSeen: { type: Number, required: true },
});

const ChatMessageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
});

const AudioStateSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String, required: true },
  isPlaying: { type: Boolean, required: true, default: false },
  currentTime: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Number, required: true, default: Date.now },
});

const RoomSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  participants: { type: Map, of: ParticipantSchema, default: {} },
  audioState: { type: AudioStateSchema, required: true },
  chatMessages: { type: [ChatMessageSchema], default: [] },
  adminId: { type: String, default: null },
  createdAt: { type: Number, default: Date.now },
});

const RoomModel = mongoose.models.Room || mongoose.model("Room", RoomSchema);

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const AdminModel = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

// In-memory admin password hash fallback for offline/in-memory mode
let inMemoryAdminHash = "";

async function initializeSecurity() {
  try {
    inMemoryAdminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  } catch (err) {
    console.error("Failed to initialize in-memory security:", err);
  }
}

async function seedAdminUser() {
  if (!useMongoDB) return;
  try {
    const adminExists = await (AdminModel as any).findOne({ username: ADMIN_USERNAME });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await (AdminModel as any).create({
        username: ADMIN_USERNAME,
        password: hashedPassword,
      });
      console.log(`🌱 [Seed] Default admin account '${ADMIN_USERNAME}' created successfully in MongoDB.`);
    } else {
      console.log(`🌱 [Seed] Admin account '${ADMIN_USERNAME}' already exists in MongoDB.`);
    }
  } catch (err) {
    console.error("❌ Failed to seed default admin user:", err);
  }
}

// --- Abstracted Room State Fetching & Syncing Helpers ---
async function getRoomState(roomId: string): Promise<Room | null> {
  if (useMongoDB) {
    try {
      const doc = await (RoomModel as any).findOne({ id: roomId });
      if (!doc) return null;
      const roomObj = doc.toObject();
      const participants: Record<string, Participant> = {};
      
      if (roomObj.participants) {
        if (roomObj.participants instanceof Map) {
          roomObj.participants.forEach((val: any, key: string) => {
            participants[key] = {
              id: val.id,
              name: val.name,
              role: val.role,
              joinedAt: val.joinedAt,
              lastSeen: val.lastSeen
            };
          });
        } else {
          Object.keys(roomObj.participants).forEach((key) => {
            const p = roomObj.participants[key];
            participants[key] = {
              id: p.id,
              name: p.name,
              role: p.role,
              joinedAt: p.joinedAt,
              lastSeen: p.lastSeen
            };
          });
        }
      }

      return {
        id: roomObj.id,
        participants,
        audioState: roomObj.audioState || {
          url: "",
          name: "",
          isPlaying: false,
          currentTime: 0,
          lastUpdated: Date.now()
        },
        chatMessages: roomObj.chatMessages || [],
        adminId: roomObj.adminId,
        createdAt: roomObj.createdAt || Date.now(),
      };
    } catch (err) {
      console.error(`[MongoDB error fetching room ${roomId}]:`, err);
    }
  }
  return rooms[roomId] || null;
}

async function saveRoomState(roomId: string, roomData: Partial<Room>): Promise<Room | null> {
  if (useMongoDB) {
    try {
      const updateData: any = {};
      if (roomData.participants !== undefined) updateData.participants = roomData.participants;
      if (roomData.audioState !== undefined) updateData.audioState = roomData.audioState;
      if (roomData.chatMessages !== undefined) updateData.chatMessages = roomData.chatMessages;
      if (roomData.adminId !== undefined) updateData.adminId = roomData.adminId;

      const updatedDoc = await (RoomModel as any).findOneAndUpdate(
        { id: roomId },
        { $set: updateData },
        { new: true, upsert: true }
      );

      const roomObj = updatedDoc.toObject();
      const participants: Record<string, Participant> = {};
      
      if (roomObj.participants) {
        if (roomObj.participants instanceof Map) {
          roomObj.participants.forEach((val: any, key: string) => {
            participants[key] = {
              id: val.id,
              name: val.name,
              role: val.role,
              joinedAt: val.joinedAt,
              lastSeen: val.lastSeen
            };
          });
        } else {
          Object.keys(roomObj.participants).forEach((key) => {
            const p = roomObj.participants[key];
            participants[key] = {
              id: p.id,
              name: p.name,
              role: p.role,
              joinedAt: p.joinedAt,
              lastSeen: p.lastSeen
            };
          });
        }
      }

      const room: Room = {
        id: roomObj.id,
        participants,
        audioState: roomObj.audioState || {
          url: "",
          name: "",
          isPlaying: false,
          currentTime: 0,
          lastUpdated: Date.now()
        },
        chatMessages: roomObj.chatMessages || [],
        adminId: roomObj.adminId,
        createdAt: roomObj.createdAt || Date.now(),
      };

      // Keep local in-memory store in sync as a cache
      rooms[roomId] = room;
      return room;
    } catch (err) {
      console.error(`[MongoDB error saving room ${roomId}]:`, err);
    }
  }

  // Local fallback
  if (rooms[roomId]) {
    Object.assign(rooms[roomId], roomData);
    return rooms[roomId];
  }
  return null;
}

async function deleteRoomState(roomId: string): Promise<void> {
  if (useMongoDB) {
    try {
      await (RoomModel as any).deleteOne({ id: roomId });
      console.log(`[MongoDB Deleted Room] ${roomId}`);
    } catch (err) {
      console.error(`[MongoDB error deleting room ${roomId}]:`, err);
    }
  }
  if (rooms[roomId]) {
    delete rooms[roomId];
    console.log(`[Memory Deleted Room] ${roomId}`);
  }
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const username = req.headers["x-admin-username"];
  const password = req.headers["x-admin-password"];

  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    return res.status(401).json({ error: "Yêu cầu tài khoản Admin hợp lệ để thực hiện thao tác này." });
  }

  try {
    if (useMongoDB) {
      const admin = await (AdminModel as any).findOne({ username });
      if (admin) {
        const matches = await bcrypt.compare(password, admin.password);
        if (matches) {
          return next();
        }
      }
    } else {
      // Fallback in-memory mode using inMemoryAdminHash
      if (username === ADMIN_USERNAME) {
        const matches = await bcrypt.compare(password, inMemoryAdminHash);
        if (matches) {
          return next();
        }
      }
    }
  } catch (err) {
    console.error("[Auth Error]:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi xác thực tài khoản." });
  }

  return res.status(401).json({ error: "Tài khoản hoặc mật khẩu Admin không chính xác." });
}

async function startServer() {
  await initializeSecurity();
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve static uploads
  app.use("/uploads", express.static(uploadsDir));

  // --- API Routes ---

  // Get active tracks (default list)
  app.get("/api/tracks/default", (req, res) => {
    res.json(DEFAULT_TRACKS);
  });

  // Create a new room
  app.post("/api/rooms", requireAdmin, async (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: Room = {
      id: roomId,
      participants: {},
      audioState: {
        url: DEFAULT_TRACKS[0].url,
        name: DEFAULT_TRACKS[0].name,
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now()
      },
      chatMessages: [],
      adminId: null,
      createdAt: Date.now()
    };

    if (useMongoDB) {
      try {
        await (RoomModel as any).create(newRoom);
      } catch (err) {
        console.error("Failed to create room in MongoDB:", err);
      }
    }
    rooms[roomId] = newRoom;
    console.log(`[Room Created] Room ID: ${roomId}`);
    res.json({ roomId });
  });

  // Get room state
  app.get("/api/rooms/:roomId", async (req, res) => {
    const { roomId } = req.params;
    const room = await getRoomState(roomId);
    if (!room) {
      return res.status(404).json({ error: "Phòng không tồn tại." });
    }
    res.json(room);
  });

  // Join or heartbeat ping a room
  app.post("/api/rooms/:roomId/join", async (req, res) => {
    const { roomId } = req.params;
    const { userId, name, role } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: "Thiếu thông tin người dùng." });
    }

    const room = await getRoomState(roomId);
    if (!room) {
      return res.status(404).json({ error: "Phòng không tồn tại." });
    }

    const now = Date.now();
    let assignedRole: "admin" | "listener" = role || "listener";
    
    // Check if the current room has an active admin
    const activeAdminExists = Object.values(room.participants).some(
      (p) => p.role === "admin" && (now - p.lastSeen) < 30000 && p.id !== userId
    );

    if (assignedRole === "admin" && activeAdminExists) {
      assignedRole = "listener";
    }

    if (!activeAdminExists && !room.adminId) {
      assignedRole = "admin";
      room.adminId = userId;
    }

    if (assignedRole === "admin") {
      room.adminId = userId;
    }

    room.participants[userId] = {
      id: userId,
      name,
      role: assignedRole,
      joinedAt: room.participants[userId]?.joinedAt || now,
      lastSeen: now
    };

    await saveRoomState(roomId, {
      participants: room.participants,
      adminId: room.adminId
    });

    res.json({
      room,
      assignedRole
    });
  });

  // Leave a room
  app.post("/api/rooms/:roomId/leave", async (req, res) => {
    const { roomId } = req.params;
    const { userId } = req.body;

    const room = await getRoomState(roomId);
    if (room && userId) {
      console.log(`[User Left] Room ${roomId}: ${room.participants[userId]?.name || userId}`);

      delete room.participants[userId];
      
      // If the admin leaves, we do NOT delete the room immediately. This allows reconnecting / page refreshing.
      // We set room.adminId to null if the leaving user was the admin, so someone else can claim or they can re-claim.
      if (room.adminId === userId) {
        room.adminId = null;
      }

      await saveRoomState(roomId, {
        participants: room.participants,
        adminId: room.adminId
      });
    }
    res.json({ success: true });
  });

  // Admin sync audio state
  app.post("/api/rooms/:roomId/sync", async (req, res) => {
    const { roomId } = req.params;
    const { userId, isPlaying, currentTime, url, name } = req.body;

    const room = await getRoomState(roomId);
    if (!room) {
      return res.status(404).json({ error: "Phòng không tồn tại." });
    }

    // Security check: Only let the official admin sync state
    if (room.adminId !== userId) {
      const adminInRoom = room.participants[room.adminId || ""];
      const isStale = !adminInRoom || (Date.now() - adminInRoom.lastSeen) > 15000;
      
      if (!isStale) {
        return res.status(403).json({ error: "Chỉ quản trị viên mới có thể điều khiển âm thanh." });
      } else {
        room.adminId = userId;
        if (room.participants[userId]) {
          room.participants[userId].role = "admin";
        }
      }
    }

    room.audioState = {
      url: url ?? room.audioState.url,
      name: name ?? room.audioState.name,
      isPlaying: isPlaying ?? room.audioState.isPlaying,
      currentTime: currentTime ?? room.audioState.currentTime,
      lastUpdated: Date.now()
    };

    await saveRoomState(roomId, {
      audioState: room.audioState,
      participants: room.participants,
      adminId: room.adminId
    });

    res.json({ success: true, audioState: room.audioState });
  });

  // Post chat message
  app.post("/api/rooms/:roomId/chat", async (req, res) => {
    const { roomId } = req.params;
    const { userId, name, text } = req.body;

    const room = await getRoomState(roomId);
    if (!room) {
      return res.status(404).json({ error: "Phòng không tồn tại." });
    }

    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: userId,
      senderName: name,
      text,
      timestamp: Date.now()
    };

    room.chatMessages.push(message);
    
    // Limit chat messages array size to 100
    if (room.chatMessages.length > 100) {
      room.chatMessages.shift();
    }

    await saveRoomState(roomId, {
      chatMessages: room.chatMessages
    });

    res.json(message);
  });

  // Binary stream audio file upload
  app.post("/api/upload", requireAdmin, (req, res) => {
    const roomId = req.query.roomId as string;
    const fileName = (req.query.fileName as string) || "audio_file.mp3";

    if (!roomId) {
      return res.status(400).json({ error: "Phòng không hợp lệ hoặc không tồn tại." });
    }

    const safeFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeFileName);
    const fileStream = fs.createWriteStream(filePath);

    req.pipe(fileStream);

    fileStream.on("finish", async () => {
      const publicUrl = `/uploads/${safeFileName}`;
      
      const room = await getRoomState(roomId);
      if (room) {
        room.audioState = {
          url: publicUrl,
          name: fileName,
          isPlaying: false,
          currentTime: 0,
          lastUpdated: Date.now()
        };
        await saveRoomState(roomId, {
          audioState: room.audioState
        });
      }

      res.json({
        url: publicUrl,
        name: fileName
      });
    });

    fileStream.on("error", (err) => {
      console.error("[Upload Error]:", err);
      res.status(500).json({ error: "Tải tệp âm thanh lên thất bại." });
    });
  });

  // Get list of uploaded files
  app.get("/api/uploads", (req, res) => {
    try {
      if (!fs.existsSync(uploadsDir)) {
        return res.json([]);
      }
      // Robustly filter out directories or hidden files like .DS_Store or .gitkeep
      const files = fs.readdirSync(uploadsDir).filter((file) => {
        const filePath = path.join(uploadsDir, file);
        try {
          return fs.statSync(filePath).isFile() && !file.startsWith(".");
        } catch {
          return false;
        }
      });

      const fileList = files.map((file) => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        const parts = file.split("_");
        const originalName = parts.slice(1).join("_") || file;
        
        // stats.mtimeMs is guaranteed to be available on Linux containers where birthtimeMs isn't!
        const fileTime = stats.mtimeMs || stats.birthtimeMs || Date.now();

        return {
          fileName: file,
          name: originalName,
          url: `/uploads/${file}`,
          size: stats.size,
          createdAt: fileTime,
        };
      });

      // Sort by newest first
      fileList.sort((a, b) => b.createdAt - a.createdAt);
      res.json(fileList);
    } catch (err) {
      console.error("[List Uploads Error]:", err);
      res.status(500).json({ error: "Không thể lấy danh sách tệp." });
    }
  });

  // Delete specific uploaded file
  app.delete("/api/uploads/:fileName", requireAdmin, (req, res) => {
    try {
      const { fileName } = req.params;
      const filePath = path.join(uploadsDir, fileName);

      // Prevent directory traversal attacks
      if (!filePath.startsWith(uploadsDir)) {
        return res.status(400).json({ error: "Đường dẫn không hợp lệ." });
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Deleted File]: ${fileName}`);
        return res.json({ success: true, message: `Đã xóa tệp ${fileName}` });
      } else {
        return res.status(404).json({ error: "Không tìm thấy tệp cần xóa." });
      }
    } catch (err) {
      console.error("[Delete Upload Error]:", err);
      res.status(500).json({ error: "Không thể xóa tệp." });
    }
  });

  // Clear all uploaded files
  app.delete("/api/uploads", requireAdmin, (req, res) => {
    try {
      if (!fs.existsSync(uploadsDir)) {
        return res.json({ success: true, message: "Thư mục tải lên trống." });
      }
      const files = fs.readdirSync(uploadsDir);
      let count = 0;
      files.forEach((file) => {
        const filePath = path.join(uploadsDir, file);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          count++;
        }
      });
      console.log(`[Cleared All Files]: Deleted ${count} files`);
      res.json({ success: true, message: `Đã xóa toàn bộ ${count} tệp âm thanh.` });
    } catch (err) {
      console.error("[Clear Uploads Error]:", err);
      res.status(500).json({ error: "Không thể xóa sạch các tệp." });
    }
  });

  // Periodic Cleanup of inactive participants (rooms are kept forever)
  setInterval(async () => {
    const now = Date.now();
    let roomsToClean: string[] = [];

    if (useMongoDB) {
      try {
        const docs = await (RoomModel as any).find({});
        roomsToClean = docs.map((doc: any) => doc.id);
      } catch (err) {
        console.error("Error fetching rooms for cleanup from MongoDB:", err);
      }
    } else {
      roomsToClean = Object.keys(rooms);
    }

    for (const roomId of roomsToClean) {
      const room = await getRoomState(roomId);
      if (!room) continue;

      // Clean up stale/inactive participants who haven't pinged in 60 seconds (generous for tab backgrounding/throttling)
      let hasChanges = false;
      Object.keys(room.participants).forEach((userId) => {
        const participant = room.participants[userId];
        if (now - participant.lastSeen > 60000) {
          console.log(`[User Left due to Timeout] Room ${roomId}: ${participant.name}`);
          delete room.participants[userId];
          if (room.adminId === userId) {
            room.adminId = null;
          }
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await saveRoomState(roomId, {
          participants: room.participants,
          adminId: room.adminId
        });
      }
    }
  }, 5000);

  // --- Serve Front-End ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
