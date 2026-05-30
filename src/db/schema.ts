import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// --- Users & Auth ---

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // founder, manager, member
  status: text("status").notNull().default("pending"), // pending, active, rejected
  avatarUrl: text("avatar_url"),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Phase 1 tables ---

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  stage: text("stage"),
  createdAt: text("created_at").notNull(),
  archivedAt: text("archived_at"),
});

export const clientProfile = sqliteTable("client_profile", {
  clientId: text("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  rawJson: text("raw_json"),
});

export const clientBrief = sqliteTable("client_brief", {
  clientId: text("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  summaryMd: text("summary_md"),
  northStar: text("north_star"),
  audience: text("audience"),
  voice: text("voice"),
  constraints: text("constraints"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// --- Phase 2 tables ---

export const historyEntries = sqliteTable("history_entries", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // Note, Meeting, Win, Loss, Decision
  title: text("title"),
  body: text("body"), // tiptap JSON or HTML
  attachments: text("attachments"), // JSON array of file paths
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"), // tiptap JSON
  column: text("column").notNull().default("raw"), // raw, cooking, ready
  tags: text("tags"), // JSON array
  isOnline: integer("is_online", { mode: "boolean" }).default(true),
  estimatedCost: real("estimated_cost"),
  refinedBody: text("refined_body"), // agent-refined version
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // online, offline
  objective: text("objective"),
  channel: text("channel"),
  hypothesis: text("hypothesis"),
  creativeNotes: text("creative_notes"),
  budget: real("budget"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  kpi: text("kpi"),
  outcome: text("outcome"),
  status: text("status").notNull().default("planned"), // planned, active, done
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const socialPosts = sqliteTable("social_posts", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  copy: text("copy"),
  mediaUrls: text("media_urls"), // JSON array
  scheduledFor: text("scheduled_for"),
  status: text("status").notNull().default("draft"), // draft, queued, posted
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const discoveries = sqliteTable("discoveries", {
  id: text("id").primaryKey(),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type").notNull(),
  externalId: text("external_id").notNull(),
  author: text("author"),
  title: text("title"),
  body: text("body"),
  mediaUrls: text("media_urls"), // JSON array
  externalUrl: text("external_url"),
  rawJson: text("raw_json"),
  fetchedAt: text("fetched_at").notNull(),
  popularityScore: real("popularity_score"),
});

export const clientDiscoveries = sqliteTable("client_discoveries", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  discoveryId: text("discovery_id")
    .notNull()
    .references(() => discoveries.id, { onDelete: "cascade" }),
  score: real("score").notNull(),
  tags: text("tags"), // JSON array
  whyMd: text("why_md"),
  surfacedAt: text("surfaced_at"),
  dismissedAt: text("dismissed_at"),
  savedAt: text("saved_at"),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  inputJson: text("input_json"),
  outputMd: text("output_md"),
  createdAt: text("created_at").notNull(),
});

export const predictions = sqliteTable("predictions", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  forecastMd: text("forecast_md"),
  createdAt: text("created_at").notNull(),
});

// --- Chat tables ---

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  title: text("title"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | tool_result
  content: text("content").notNull(),
  toolCalls: text("tool_calls"), // JSON: [{name, args, result}]
  createdAt: text("created_at").notNull(),
});

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  fact: text("fact").notNull(),
  sourceConversationId: text("source_conversation_id"),
  createdAt: text("created_at").notNull(),
});

// --- Notifications & Attendance ---

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // registration_request, task_assigned, chat_message, reminder
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  markedAt: text("marked_at").notNull(),
  status: text("status").notNull().default("completed"), // completed, in_progress
  notes: text("notes"), // suggestions if completed, ETA if in progress
});

// --- Client Access Control ---

export const userClientAccess = sqliteTable("user_client_access", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  accessLevel: text("access_level").notNull().default("view"), // view, manage, full
  assignedBy: text("assigned_by"),
  createdAt: text("created_at").notNull(),
});

// --- Team Chat ---

export const chatChannels = sqliteTable("chat_channels", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // group, direct, voice
  name: text("name"),
  description: text("description"),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
});

export const chatChannelMembers = sqliteTable("chat_channel_members", {
  channelId: text("channel_id")
    .notNull()
    .references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull(),
  lastReadAt: text("last_read_at"),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id")
    .notNull()
    .references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"), // image, video
  mediaExpiresAt: text("media_expires_at"),
  replyToId: text("reply_to_id"),
  editedAt: text("edited_at"),
  pinnedAt: text("pinned_at"),
  pinnedBy: text("pinned_by"),
  createdAt: text("created_at").notNull(),
});

export const chatReactions = sqliteTable("chat_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => chatMessages.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: text("created_at").notNull(),
});

export const chatPolls = sqliteTable("chat_polls", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: text("options").notNull(), // JSON array of strings
  createdAt: text("created_at").notNull(),
});

export const chatPollVotes = sqliteTable("chat_poll_votes", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull().references(() => chatPolls.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  optionIndex: integer("option_index").notNull(),
  createdAt: text("created_at").notNull(),
});

export const voiceParticipants = sqliteTable("voice_participants", {
  channelId: text("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: text("joined_at").notNull(),
  muted: integer("muted", { mode: "boolean" }).default(false),
  deafened: integer("deafened", { mode: "boolean" }).default(false),
});

export const voiceSignals = sqliteTable("voice_signals", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  type: text("type").notNull(), // offer, answer, ice-candidate
  payload: text("payload").notNull(), // JSON
  createdAt: text("created_at").notNull(),
});

export const userPresence = sqliteTable("user_presence", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("offline"), // online, idle, dnd, offline
  lastSeenAt: text("last_seen_at").notNull(),
});

// --- Update Tracking ---

export const userSectionVisits = sqliteTable("user_section_visits", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  section: text("section").notNull(), // chat, tasks, notifications, attendance
  lastVisitedAt: text("last_visited_at").notNull(),
});

// --- Business tables ---

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  number: text("number").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue
  dueDate: text("due_date"),
  paidAt: text("paid_at"),
  description: text("description"),
  taxPercent: real("tax_percent").default(0),
  discountAmount: real("discount_amount").default(0),
  notes: text("notes"),
  fromName: text("from_name"),
  fromAddress: text("from_address"),
  fromGst: text("from_gst"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  rate: real("rate").notNull(),
  amount: real("amount").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"), // referral, inbound, outbound, social
  status: text("status").notNull().default("new"), // new, contacted, qualified, proposal, won, lost
  notes: text("notes"),
  assignedTo: text("assigned_to"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo, in_progress, done
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  dueDate: text("due_date"),
  assignedTo: text("assigned_to"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .references(() => clients.id, { onDelete: "cascade" }),
  title: text("title"),
  body: text("body").notNull(),
  tags: text("tags"), // JSON array
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const deliverables = sqliteTable("deliverables", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .references(() => campaigns.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  type: text("type"), // design, video, copy, social_post, report
  status: text("status").notNull().default("pending"), // pending, in_progress, review, delivered
  fileUrl: text("file_url"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Team Tasks & Challenges ---

export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: text("assigned_to").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedBy: text("assigned_by").notNull().references(() => users.id),
  status: text("status").notNull().default("active"), // active, completed, expired
  reward: text("reward"),
  dueDate: text("due_date"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Types ---

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientProfile = typeof clientProfile.$inferSelect;
export type ClientBrief = typeof clientBrief.$inferSelect;
export type HistoryEntry = typeof historyEntries.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type Discovery = typeof discoveries.$inferSelect;
export type ClientDiscovery = typeof clientDiscoveries.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type ChatChannel = typeof chatChannels.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatReaction = typeof chatReactions.$inferSelect;
export type ChatPoll = typeof chatPolls.$inferSelect;
export type ChatPollVote = typeof chatPollVotes.$inferSelect;
export type VoiceParticipant = typeof voiceParticipants.$inferSelect;
export type VoiceSignal = typeof voiceSignals.$inferSelect;
export type UserPresence = typeof userPresence.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
