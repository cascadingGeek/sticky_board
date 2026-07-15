import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize local database path
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default colors for sticky notes
const COLOR_PRESETS = ["yellow", "blue", "green", "pink", "purple", "orange", "mint", "cream"];

// In-Memory cache serialized to disk
let db = {
  users: [] as any[],
  todos: [] as any[],
  streaks: {} as Record<string, any>,
  activityLogs: [] as any[]
};

// Load database
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      db = JSON.parse(data);
    } else {
      saveDB();
    }
  } catch (error) {
    console.error("Failed to load local DB, using empty store:", error);
  }
}

// Save database
function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save local DB:", error);
  }
}

loadDB();

// Initialize Gemini SDK lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Hashing Helpers using native crypto PBKDF2
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

function generateId(): string {
  return crypto.randomUUID();
}

// Authentication Middleware
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction): any {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const user = db.users.find(u => u.sessionToken === token);
  if (!user) {
    return res.status(403).json({ error: "Invalid or expired session" });
  }

  (req as any).user = {
    id: user.id,
    email: user.email,
    name: user.name,
    preferences: user.preferences
  };
  next();
}

// --- API ROUTES ---

// 1. Auth Endpoint: Register
app.post("/api/auth/register", (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "Name, email and password are required" });
    return;
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(400).json({ error: "Email is already registered" });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hashedPassword = hashPassword(password, salt);
  const userId = generateId();

  const newUser = {
    id: userId,
    email: email.toLowerCase(),
    name,
    salt,
    passwordHash: hashedPassword,
    sessionToken: crypto.randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
    preferences: {
      theme: "dark",
      accentColor: "#f43f5e", // elegant rose
      handwritingFont: true,
      soundEnabled: true,
      timezone: "America/New_York",
      startOfWeek: 1, // Monday
      defaultPriority: "medium",
      stickyColorMode: "auto"
    }
  };

  db.users.push(newUser);

  // Initialize basic user setup
  db.streaks[userId] = {
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null
  };

  // Seed user with some starter sticky notes
  const todayStr = new Date().toISOString().split("T")[0];
  const sampleTodos = [
    {
      id: generateId(),
      userId,
      title: "Welcome to StickyBoard! Double-click me to edit my contents ✏️",
      description: "You can set subtasks, select priorities, and customize colors.",
      isCompleted: false,
      dateStr: todayStr,
      priority: "high",
      category: "Personal",
      noteColor: "yellow",
      subtasks: [
        { id: generateId(), title: "Try checking a subtask", isCompleted: false },
        { id: generateId(), title: "Change note color", isCompleted: false }
      ],
      isPinned: true,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: generateId(),
      userId,
      title: "Complete this task to see physical push-pin animations 🎉",
      description: "When completed, the pin pops, the paper peels, and confetti bursts!",
      isCompleted: false,
      dateStr: todayStr,
      priority: "critical",
      category: "Urgent",
      noteColor: "pink",
      subtasks: [],
      isPinned: false,
      isFavorite: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  db.todos.push(...sampleTodos);
  saveDB();

  res.status(201).json({
    token: newUser.sessionToken,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      preferences: newUser.preferences
    }
  });
});

// 2. Auth Endpoint: Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const hashedPassword = hashPassword(password, user.salt);
  if (hashedPassword !== user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Refresh token on login
  user.sessionToken = crypto.randomBytes(32).toString("hex");
  saveDB();

  res.json({
    token: user.sessionToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      preferences: user.preferences
    }
  });
});

// 3. Auth Endpoint: Me
app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ user: (req as any).user });
});

// 4. Update Preferences
app.put("/api/auth/preferences", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  user.preferences = {
    ...user.preferences,
    ...req.body
  };

  saveDB();
  res.json({ preferences: user.preferences });
});

// 5. Todos: GET with filters & isolation
app.get("/api/todos", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const { dateStr, category, priority, status, search, isPinned, isFavorite } = req.query;

  let filtered = db.todos.filter(t => t.userId === userId);

  // Apply absolute date isolation
  if (dateStr) {
    filtered = filtered.filter(t => t.dateStr === dateStr);
  }

  if (category) {
    filtered = filtered.filter(t => t.category.toLowerCase() === (category as string).toLowerCase());
  }

  if (priority) {
    filtered = filtered.filter(t => t.priority === priority);
  }

  if (status) {
    if (status === "completed") {
      filtered = filtered.filter(t => t.isCompleted);
    } else if (status === "pending") {
      filtered = filtered.filter(t => !t.isCompleted);
    }
  }

  if (isPinned) {
    filtered = filtered.filter(t => t.isPinned === (isPinned === "true"));
  }

  if (isFavorite) {
    filtered = filtered.filter(t => t.isFavorite === (isFavorite === "true"));
  }

  if (search) {
    const q = (search as string).toLowerCase();
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  res.json({ todos: filtered });
});

// 6. Todos: POST Create
app.post("/api/todos", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const { title, description, dateStr, priority, category, noteColor, dueTime, estimatedMinutes, subtasks, positionX, positionY } = req.body;

  if (!title) {
    res.status(400).json({ error: "Task title is required" });
    return;
  }

  // Determine a pretty stickynote color
  let assignedColor = noteColor;
  if (!assignedColor || !COLOR_PRESETS.includes(assignedColor)) {
    if (priority === "critical") assignedColor = "pink";
    else if (priority === "high") assignedColor = "orange";
    else if (priority === "medium") assignedColor = "yellow";
    else assignedColor = "green";
  }

  const newTodo = {
    id: generateId(),
    userId,
    title,
    description: description || "",
    isCompleted: false,
    dateStr: dateStr || new Date().toISOString().split("T")[0],
    priority: priority || "medium",
    category: category || "Personal",
    noteColor: assignedColor,
    positionX: positionX !== undefined ? Number(positionX) : undefined,
    positionY: positionY !== undefined ? Number(positionY) : undefined,
    subtasks: (subtasks || []).map((s: any) => ({
      id: generateId(),
      title: s.title,
      isCompleted: !!s.isCompleted
    })),
    dueTime: dueTime || undefined,
    estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
    isPinned: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.todos.push(newTodo);

  // Log activity
  db.activityLogs.push({
    id: generateId(),
    userId,
    action: "create_todo",
    details: `Created sticky note "${title}"`,
    createdAt: new Date().toISOString()
  });

  saveDB();
  res.status(201).json({ todo: newTodo });
});

// 6.5. Todos: PUT Reorder
app.put("/api/todos/reorder", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ error: "orderedIds must be an array" });
    return;
  }

  const userTodos = db.todos.filter(t => t.userId === userId);
  const otherTodos = db.todos.filter(t => t.userId !== userId);

  const userTodosMap = new Map(userTodos.map(t => [t.id, t]));
  const sortedUserTodos: any[] = [];

  orderedIds.forEach((id: string) => {
    const todo = userTodosMap.get(id);
    if (todo) {
      sortedUserTodos.push(todo);
      userTodosMap.delete(id);
    }
  });

  userTodosMap.forEach(todo => {
    sortedUserTodos.push(todo);
  });

  db.todos = [...otherTodos, ...sortedUserTodos];
  saveDB();

  res.json({ success: true });
});

// 7. Todos: PUT Update
app.put("/api/todos/:id", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const todo = db.todos.find(t => t.id === id && t.userId === userId);
  if (!todo) {
    res.status(404).json({ error: "Sticky note not found" });
    return;
  }

  const fields = ["title", "description", "priority", "category", "noteColor", "dueTime", "estimatedMinutes", "isPinned", "isFavorite", "isCompleted", "dateStr", "positionX", "positionY"];
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      todo[field] = req.body[field];
    }
  });

  if (req.body.subtasks !== undefined) {
    todo.subtasks = req.body.subtasks.map((s: any) => ({
      id: s.id || generateId(),
      title: s.title,
      isCompleted: !!s.isCompleted
    }));
  }

  todo.updatedAt = new Date().toISOString();

  // If newly completed, update streak
  if (req.body.isCompleted === true && !todo.isCompleted) {
    todo.isCompleted = true;
    updateStreak(userId, todo.dateStr);
  }

  saveDB();
  res.json({ todo });
});

// 8. Todos: DELETE Delete
app.delete("/api/todos/:id", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const idx = db.todos.findIndex(t => t.id === id && t.userId === userId);
  if (idx === -1) {
    res.status(404).json({ error: "Sticky note not found" });
    return;
  }

  const deletedTitle = db.todos[idx].title;
  db.todos.splice(idx, 1);

  db.activityLogs.push({
    id: generateId(),
    userId,
    action: "delete_todo",
    details: `Deleted sticky note "${deletedTitle}"`,
    createdAt: new Date().toISOString()
  });

  saveDB();
  res.json({ success: true, message: "Sticky note deleted" });
});

// 9. Todos: Duplicate Task
app.post("/api/todos/:id/duplicate", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const todo = db.todos.find(t => t.id === id && t.userId === userId);
  if (!todo) {
    res.status(404).json({ error: "Sticky note not found" });
    return;
  }

  const duplicated = {
    ...todo,
    id: generateId(),
    title: `${todo.title} (Copy)`,
    isCompleted: false,
    subtasks: todo.subtasks.map((s: any) => ({ ...s, id: generateId(), isCompleted: false })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.todos.push(duplicated);
  saveDB();

  res.status(201).json({ todo: duplicated });
});

// 10. Dashboard Stats & Streak Calculations
app.get("/api/analytics/summary", authenticateToken, (req, res) => {
  const userId = (req as any).user.id;
  const userTodos = db.todos.filter(t => t.userId === userId);

  const completed = userTodos.filter(t => t.isCompleted);
  const total = userTodos.length;
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Streak details
  const streak = db.streaks[userId] || { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };

  // Category Breakdown
  const categories: Record<string, number> = {};
  userTodos.forEach(t => {
    const cat = t.category || "Personal";
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const categoryDistribution = Object.entries(categories).map(([name, val]) => {
    let color = "#10b981"; // Emerald
    if (name === "Work") color = "#3b82f6"; // Blue
    else if (name === "Urgent" || name === "Critical") color = "#ef4444"; // Red
    else if (name === "Finance") color = "#f59e0b"; // Amber
    else if (name === "Health") color = "#ec4899"; // Pink
    return { name, value: val, color };
  });

  // Heatmap: count of completed tasks per dateStr
  const heatmap: Record<string, number> = {};
  completed.forEach(t => {
    if (t.dateStr) {
      heatmap[t.dateStr] = (heatmap[t.dateStr] || 0) + 1;
    }
  });

  // Weekly breakdown
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyActivity = daysOfWeek.map((day, offset) => {
    // Return mock counts matching some distributions, styled beautifully
    return {
      day,
      completed: completed.filter(t => new Date(t.createdAt).getDay() === offset).length,
      pending: userTodos.filter(t => !t.isCompleted && new Date(t.createdAt).getDay() === offset).length
    };
  });

  res.json({
    completionRate,
    totalCompleted: completed.length,
    totalPending: userTodos.length - completed.length,
    streak,
    categoryDistribution,
    weeklyActivity,
    heatmap
  });
});

// Helper: Update Streaks on completion
function updateStreak(userId: string, dateStr: string) {
  if (!db.streaks[userId]) {
    db.streaks[userId] = { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
  }

  const streak = db.streaks[userId];
  if (!streak.lastCompletedDate) {
    streak.currentStreak = 1;
    streak.longestStreak = 1;
    streak.lastCompletedDate = dateStr;
  } else {
    const lastDate = new Date(streak.lastCompletedDate);
    const currentDate = new Date(dateStr);
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak.currentStreak += 1;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      streak.lastCompletedDate = dateStr;
    } else if (diffDays > 1) {
      streak.currentStreak = 1;
      streak.lastCompletedDate = dateStr;
    }
  }
}

// 11. AI Command Endpoint: Parse Natural Language into StickyNote Tasks
app.post("/api/gemini/parse", authenticateToken, async (req, res) => {
  const { prompt, timezone } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({ 
      error: "AI service currently offline. Provide GEMINI_API_KEY inside Settings > Secrets." 
    });
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const systemInstruction = `You are an elite, smart productivity agent.
Parse the user's natural language input into a structured Todo item.
Your task is to extract:
1. "title": Simple, polished task title (keep emojis if appropriate).
2. "description": Extra details if mentioned, otherwise empty.
3. "priority": 'low' | 'medium' | 'high' | 'critical' (infer based on urgency words like 'asap', 'critical', 'immediately', 'high priority').
4. "category": 'Work' | 'Personal' | 'Urgent' | 'Health' | 'Finance' (infer, defaults to 'Personal').
5. "dueTime": 'HH:MM' format if a specific time is mentioned (e.g. 8pm is "20:00", 2:30am is "02:30").
6. "estimatedMinutes": estimated task duration in minutes if specified (e.g. '1 hour' is 60, '30 mins' is 30).
7. "dateOffset": Number representing how many days in the future from today. Today is 0, tomorrow is 1, next Monday is offset based on current day. Default is 0.

Current local date is: ${today}.
Always output your response strictly as valid, parsable JSON matching this schema structure. No Markdown wrapping other than raw JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Input: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
            category: { type: Type.STRING },
            dueTime: { type: Type.STRING },
            estimatedMinutes: { type: Type.INTEGER },
            dateOffset: { type: Type.INTEGER }
          },
          required: ["title", "priority", "category", "dateOffset"]
        }
      }
    });

    const parsedText = response.text ? response.text.trim() : "{}";
    const structuredResult = JSON.parse(parsedText);
    res.json({ result: structuredResult });
  } catch (err: any) {
    console.error("Gemini Parsing Error:", err);
    res.status(500).json({ error: "Failed to parse query via Gemini AI", details: err.message });
  }
});

// 12. AI Briefing Endpoint: Generate Morning Briefing or Evening Reflection
app.post("/api/gemini/briefing", authenticateToken, async (req, res) => {
  const userId = (req as any).user.id;
  const { dateStr, type } = req.body; // type: 'morning' | 'evening'

  const userTodos = db.todos.filter(t => t.userId === userId && t.dateStr === dateStr);
  const completed = userTodos.filter(t => t.isCompleted);
  const pending = userTodos.filter(t => !t.isCompleted);

  const ai = getGeminiClient();
  if (!ai) {
    res.json({ 
      briefing: "📝 Add a valid **GEMINI_API_KEY** under Settings > Secrets to unlock personalized Daily briefings and focus coaching!" 
    });
    return;
  }

  try {
    const listDescription = userTodos.map(t => `- [${t.isCompleted ? "x" : " "}] ${t.title} (${t.priority} priority, ${t.category})`).join("\n");
    const mode = type === "evening" ? "Evening Review and Gratitude Note" : "Morning Briefing and Encouraging Agenda";

    const systemInstruction = `You are a warm, mindful, and elite productivity coach.
Generate a beautiful, short, highly inspiring ${mode} (about 3-4 sentences max) written in the first person.
Keep it conversational, positive, and crisp.
Directly mention the tasks for today to give a tailored focus. Avoid dry system details. Use 1 or 2 elegant emojis.
Make the user feel excited and focused. Do not use markdown headers, just return a single elegant block of text.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Date: ${dateStr}\nTasks:\n${listDescription || "No tasks scheduled for today yet!"}`,
      config: { systemInstruction }
    });

    res.json({ briefing: response.text ? response.text.trim() : "Enjoy a beautiful, focused day!" });
  } catch (err: any) {
    console.error("Gemini Briefing Error:", err);
    res.json({ briefing: "☀️ Good morning! Let's conquer our sticky notes and make today exceptionally focused and rewarding." });
  }
});

// --- GOOGLE OAUTH ENDPOINTS ---

// Google OAuth URL generator
app.get("/api/auth/google/url", (req, res) => {
  const origin = (req.query.origin as string) || process.env.APP_URL || "https://ais-dev-5yimdqtoper5zx2menluoi-726049282731.europe-west2.run.app";
  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account"
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

// Google OAuth Callback Handler
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send("No authorization code provided by Google");
    return;
  }

  // Construct correct redirect_uri that was used during auth request
  const host = req.get("host") || "ais-dev-5yimdqtoper5zx2menluoi-726049282731.europe-west2.run.app";
  const protocol = req.headers["x-forwarded-proto"] || (req.protocol === "http" ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Google Token Exchange Failed:", errText);
      res.status(500).send("Failed to exchange authentication code with Google: " + errText);
      return;
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoResponse.ok) {
      res.status(500).send("Failed to retrieve user profile details from Google");
      return;
    }

    const userInfo = await userInfoResponse.json();
    const email = userInfo.email?.toLowerCase();
    if (!email) {
      res.status(400).send("Google did not return an email address");
      return;
    }

    let user = db.users.find(u => u.email.toLowerCase() === email);
    if (!user) {
      // Create new user (Google Registration)
      const userId = generateId();
      const sessionToken = crypto.randomBytes(32).toString("hex");
      user = {
        id: userId,
        email,
        name: userInfo.name || email.split("@")[0],
        salt: crypto.randomBytes(16).toString("hex"),
        passwordHash: "",
        sessionToken,
        createdAt: new Date().toISOString(),
        preferences: {
          theme: "dark",
          accentColor: "#6366f1", // Indigo
          handwritingFont: true,
          soundEnabled: true,
          timezone: "America/New_York",
          startOfWeek: 1,
          defaultPriority: "medium",
          stickyColorMode: "auto"
        }
      };
      db.users.push(user);

      // Initialize streaks database
      db.streaks[userId] = {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null
      };

      // Seed starter tasks
      const todayStr = new Date().toISOString().split("T")[0];
      const sampleTodos = [
        {
          id: generateId(),
          userId,
          title: "Welcome to StickyBoard! Double-click me to edit my contents ✏️",
          description: "You can set subtasks, select priorities, and customize colors.",
          isCompleted: false,
          dateStr: todayStr,
          priority: "high",
          category: "Personal",
          noteColor: "yellow",
          subtasks: [
            { id: generateId(), title: "Try checking a subtask", isCompleted: false },
            { id: generateId(), title: "Change note color", isCompleted: false }
          ],
          isPinned: true,
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: generateId(),
          userId,
          title: "Complete this task to see physical push-pin animations 🎉",
          description: "When completed, the pin pops, the paper peels, and confetti bursts!",
          isCompleted: false,
          dateStr: todayStr,
          priority: "critical",
          category: "Urgent",
          noteColor: "pink",
          subtasks: [],
          isPinned: false,
          isFavorite: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      db.todos.push(...sampleTodos);
      saveDB();
    } else {
      // Existing user: refresh session token
      user.sessionToken = crypto.randomBytes(32).toString("hex");
      saveDB();
    }

    res.send(`
      <html>
        <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f0f11; color: #fff;">
          <h2 style="margin-bottom: 8px;">Authentication Successful</h2>
          <p style="color: #a1a1aa; font-size: 14px;">Logging you into StickyBoard...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${user.sessionToken}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Google OAuth login error:", err);
    res.status(500).send("Authentication error: " + err.message);
  }
});

// --- GITHUB OAUTH ENDPOINTS ---

// GitHub OAuth URL generator
app.get("/api/auth/github/url", (req, res) => {
  const origin = (req.query.origin as string) || process.env.APP_URL || "https://ais-dev-5yimdqtoper5zx2menluoi-726049282731.europe-west2.run.app";
  const redirectUri = `${origin}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || "",
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state: crypto.randomBytes(8).toString("hex"),
  });
  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

// GitHub OAuth Callback Handler
app.get("/api/auth/github/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send("No authorization code provided by GitHub");
    return;
  }

  // Construct correct redirect_uri that was used during auth request
  const host = req.get("host") || "ais-dev-5yimdqtoper5zx2menluoi-726049282731.europe-west2.run.app";
  const protocol = req.headers["x-forwarded-proto"] || (req.protocol === "http" ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/auth/github/callback`;

  try {
    const tokenUrl = "https://github.com/login/oauth/access_token";
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GITHUB_CLIENT_ID || "",
        client_secret: process.env.GITHUB_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("GitHub Token Exchange Failed:", errText);
      res.status(500).send("Failed to exchange authentication code with GitHub: " + errText);
      return;
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    if (!accessToken) {
      console.error("GitHub Token Exchange did not return an access token:", tokens);
      res.status(500).send("Failed to retrieve access token from GitHub: " + JSON.stringify(tokens));
      return;
    }

    // Retrieve user profile details from GitHub
    const userProfileResponse = await fetch("https://api.github.com/user", {
      headers: { 
        Authorization: `token ${accessToken}`,
        "User-Agent": "StickyBoard-App"
      }
    });

    if (!userProfileResponse.ok) {
      const errText = await userProfileResponse.text();
      console.error("GitHub Profile Fetch Failed:", errText);
      res.status(500).send("Failed to retrieve user profile details from GitHub");
      return;
    }

    const userProfile = await userProfileResponse.json();
    
    // GitHub emails are often private, so try to retrieve emails explicitly
    let email = userProfile.email?.toLowerCase();
    
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: { 
          Authorization: `token ${accessToken}`,
          "User-Agent": "StickyBoard-App"
        }
      });
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        const primaryEmailObj = emails.find((e: any) => e.primary && e.verified) || emails[0];
        if (primaryEmailObj) {
          email = primaryEmailObj.email?.toLowerCase();
        }
      }
    }

    if (!email) {
      // Fallback email if still not found
      email = `${userProfile.login || "github_user"}@github.placeholder.com`.toLowerCase();
    }

    let user = db.users.find(u => u.email.toLowerCase() === email);
    if (!user) {
      // Create new user (GitHub Registration)
      const userId = generateId();
      const sessionToken = crypto.randomBytes(32).toString("hex");
      user = {
        id: userId,
        email,
        name: userProfile.name || userProfile.login || email.split("@")[0],
        salt: crypto.randomBytes(16).toString("hex"),
        passwordHash: "",
        sessionToken,
        createdAt: new Date().toISOString(),
        preferences: {
          theme: "dark",
          accentColor: "#6366f1", // Indigo
          handwritingFont: true,
          soundEnabled: true,
          timezone: "America/New_York",
          startOfWeek: 1,
          defaultPriority: "medium",
          stickyColorMode: "auto"
        }
      };
      db.users.push(user);

      // Initialize streaks database
      db.streaks[userId] = {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null
      };

      // Seed starter tasks
      const todayStr = new Date().toISOString().split("T")[0];
      const sampleTodos = [
        {
          id: generateId(),
          userId,
          title: "Welcome to StickyBoard! Double-click me to edit my contents ✏️",
          description: "You can set subtasks, select priorities, and customize colors.",
          isCompleted: false,
          dateStr: todayStr,
          priority: "high",
          category: "Personal",
          noteColor: "yellow",
          subtasks: [
            { id: generateId(), title: "Try checking a subtask", isCompleted: false },
            { id: generateId(), title: "Change note color", isCompleted: false }
          ],
          isPinned: true,
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: generateId(),
          userId,
          title: "Complete this task to see physical push-pin animations 🎉",
          description: "When completed, the pin pops, the paper peels, and confetti bursts!",
          isCompleted: false,
          dateStr: todayStr,
          priority: "critical",
          category: "Urgent",
          noteColor: "pink",
          subtasks: [],
          isPinned: false,
          isFavorite: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      db.todos.push(...sampleTodos);
      saveDB();
    } else {
      // Existing user: refresh session token
      user.sessionToken = crypto.randomBytes(32).toString("hex");
      saveDB();
    }

    res.send(`
      <html>
        <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f0f11; color: #fff;">
          <h2 style="margin-bottom: 8px;">Authentication Successful</h2>
          <p style="color: #a1a1aa; font-size: 14px;">Logging you into StickyBoard...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${user.sessionToken}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("GitHub OAuth login error:", err);
    res.status(500).send("Authentication error: " + err.message);
  }
});

// --- VITE DEV / PRODUCTION ENGINE ---

async function startServer() {
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
