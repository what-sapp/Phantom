const config = require("../../config");
const timeHelper = require("./timeHelper");
const CHARS = {
  cornerTopLeft: "╭",
  cornerTopRight: "╮",
  cornerBottomLeft: "╰",
  cornerBottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  arrow: "➣",
  bullet: "◦",
  star: "✦",
  diamond: "◇",
  dot: "•",
  check: "",
  cross: "✗",
  line: "━",
};

const EMOJIS = {
  dashboard: "📊",
  info: "ℹ️",
  user: "👤",
  bot: "🤖",
  owner: "👑",
  premium: "💎",
  free: "🆓",
  public: "🌐",
  self: "🔒",
  commands: "🖥️",
  utilities: "🔧",
  fun: "🎮",
  group: "👥",
  time: "⏰",
  uptime: "⏱️",
  version: "📌",
  speed: "⚡",
  limit: "📊",
  status: "📋",
  mode: "🔄",
  name: "📝",
  number: "📱",
  developer: "👨‍💻",
  total: "📈",
  tip: "💡",
  warning: "⚠️",
  success: "✅",
  error: "❌",
  loading: "⏳",
};

function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Format date to Indonesian local format
 * @param {Date|number|string} date - Date to format
 * @returns {string} Formatted date string
 * @example
 * formatDate(new Date()); // "17/12/2024, 12:30:45"
 */
function formatDate(date) {
  return timeHelper.fromTimestamp(date, "DD/MM/YYYY HH:mm:ss");
}

/**
 * Format phone number to a more readable format
 * @param {string} number - Phone number
 * @returns {string} Formatted number
 * @example
 */
function formatNumber(number) {
  if (!number) return "";
  const cleaned = number.replace(/[^0-9]/g, "");
  if (cleaned.length < 10) return cleaned;

  if (cleaned.startsWith("256")) {
    const withoutCode = cleaned.slice(2);
    const formatted = withoutCode.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
    return `256 ${formatted}`;
  }

  return cleaned;
}

/**
 * Format file size to readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 * @example
 * formatFileSize(1024); // "1.00 KB"
 * formatFileSize(1048576); // "1.00 MB"
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Create a horizontal line
 * @param {number} length - Line length
 * @param {string} [char='─'] - Character for line
 * @returns {string} Line string
 */
function createLine(length = 20, char = CHARS.horizontal) {
  return char.repeat(length);
}

/**
 * Create a box header
 * @param {string} title - Header title
 * @param {number} [width=20] - Box width
 * @returns {string} Header string
 * @example
 * createHeader('DASHBOARD');
 * // "╭─「 DASHBOARD 」─────╮"
 */
function createHeader(title, width = 20) {
  const titlePart = `${CHARS.horizontal}「 ${title} 」`;
  const remainingWidth = Math.max(0, width - titlePart.length - 2);
  return `${CHARS.cornerTopLeft}${titlePart}${createLine(remainingWidth)}${CHARS.cornerTopRight}`;
}

/**
 * Create a box footer
 * @param {number} [width=20] - Box width
 * @returns {string} Footer string
 * @example
 * createFooter(); // "╰────────────────────╯"
 */
function createFooter(width = 20) {
  return `${CHARS.cornerBottomLeft}${createLine(width)}${CHARS.cornerBottomRight}`;
}

/**
 * Create a body line with bullet
 * @param {string} text - Text for the line
 * @param {string} [prefix='│'] - Line prefix
 * @param {string} [bullet='◦'] - Bullet character
 * @returns {string} Formatted body line
 */
function createBodyLine(text, prefix = CHARS.vertical, bullet = CHARS.bullet) {
  return `${prefix} ${bullet} ${text}`;
}

/**
 * Create a line with arrow
 * @param {string} label - Label
 * @param {string} value - Value
 * @returns {string} Formatted line with arrow
 * @example
 * createArrowLine('Name', 'Ourin-AI'); // "│ ➣ Name: Ourin-AI"
 */
function createArrowLine(label, value) {
  return `${CHARS.vertical} ${CHARS.arrow} ${label}: ${value}`;
}

/**
 * Create dashboard info
 * @param {DashboardData} data - Data for dashboard
 * @returns {string} Formatted dashboard string
 */
function createDashboard(data) {
  const {
    userName = "User",
    userStatus = "Free User",
    mode = "Public",
    totalUsers = 0,
    userLimit = 25,
  } = data;

  const lines = [
    `${CHARS.cornerTopLeft}${CHARS.horizontal}「 ${EMOJIS.dashboard} DASHBOARD 」${CHARS.horizontal}`,
    `${CHARS.vertical}`,
    createArrowLine("Name", userName),
    createArrowLine("User Status", userStatus),
    createArrowLine("Mode", mode),
    createArrowLine("Users", totalUsers.toString()),
    createArrowLine("Limit", userLimit.toString()),
    `${CHARS.vertical}`,
    `${CHARS.cornerBottomLeft}${createLine(24)}`,
  ];

  return lines.join("\n");
}

/**
 * Create bot info
 * @param {BotInfoData} data - Bot info data
 * @returns {string} Formatted bot info string
 */
function createBotInfo(data) {
  const {
    botName = config.bot?.name || "Phantom-X",
    developer = config.owner?.name || "Owner",
    version = config.bot?.version || "1.0.0",
    uptime = "0s",
    totalFeatures = 0,
    mode = config.mode || "public",
    platform = "Node.js",
  } = data;

  const lines = [
    `${CHARS.horizontal} *Bot Information* ${CHARS.horizontal}`,
    ``,
    `${CHARS.dot} Bot-Name : ${botName} 🌿`,
    `${CHARS.dot} Developer : ${developer}`,
    `${CHARS.dot} Mode : ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
    `${CHARS.dot} Version : ${version}`,
    `${CHARS.dot} Uptime : ${uptime}`,
    `${CHARS.dot} Total-Features : ${totalFeatures}`,
    `${CHARS.dot} Platform : ${platform}`,
    ``,
  ];

  return lines.join("\n");
}

/**
 * Create user profile
 * @param {UserProfileData} data - User profile data
 * @returns {string} Formatted user profile string
 */
function createUserProfile(data) {
  const {
    name = "User",
    number = "",
    status = "Free",
    limit = 25,
    registeredAt = "",
  } = data;

  const statusEmoji =
    status === "Owner"
      ? EMOJIS.owner
      : status === "Premium"
        ? EMOJIS.premium
        : EMOJIS.free;

  const lines = [
    `【 USER PROFILE 】`,
    `${EMOJIS.name} Name   : ${name}`,
    `${EMOJIS.number} Number : ${formatNumber(number)}`,
    `${statusEmoji} Status : ${status}`,
    `${EMOJIS.limit} Limit  : ${limit}`,
    ``,
  ];

  if (registeredAt) {
    lines.splice(5, 0, `${EMOJIS.time} Registered : ${registeredAt}`);
  }

  return lines.join("\n");
}

/**
 * Create bot status
 * @param {Object} data - Bot status data
 * @returns {string} Formatted bot status string
 */
function createBotStatus(data) {
  const {
    botName = config.bot?.name || "phantom-X",
    uptime = "0s",
    mode = "Public",
    totalCommands = 0,
    totalUsers = 0,
    speed = "0.00s",
  } = data;

  const lines = [
    `【 BOT STATUS 】`,
    `${EMOJIS.bot} Bot      : ${botName}`,
    `${EMOJIS.uptime} Uptime   : ${uptime}`,
    `${EMOJIS.mode} Mode     : ${mode}`,
    `${EMOJIS.commands} Commands : ${totalCommands} features`,
    `${EMOJIS.user} Users    : ${totalUsers} users`,
    `${EMOJIS.speed} Speed    : ${speed}`,
    ``,
  ];

  return lines.join("\n");
}

/**
 * Create category menu
 * @param {MenuCategory} category - Category data
 * @param {string} prefix - Command prefix
 * @returns {string} Formatted category menu
 */
function createCategoryMenu(category, prefix = config.command?.prefix || ".") {
  const { name, emoji, description = "", commands = [] } = category;

  if (commands.length === 0) {
    return "";
  }

  const header = `${emoji} *${name}*`;
  const commandList = commands
    .map((cmd) => `${CHARS.vertical} ${prefix}${cmd}`)
    .join("\n");
  const footer = `${CHARS.cornerBottomLeft}${createLine(15)}`;

  return `${header}\n${commandList}\n${footer}`;
}

/**
 * Create category menu with sub-description
 * @param {Object} data - Category menu data
 * @returns {string} Formatted category section
 */
function createCategorySection(data) {
  const { emoji, title, command, description, prefix = "." } = data;

  const lines = [
    `${emoji} *${title}*`,
    `  Type: ${prefix}${command}`,
    `  ${CHARS.vertical} ( ${description} )`,
    ``,
  ];

  return lines.join("\n");
}

/**
 * Create complete main menu
 * @param {Object} data - Data for main menu
 * @returns {string} Formatted main menu string
 */
function createMainMenu(data) {
  const {
    greeting = "",
    userName = "User",
    userStatus = "Free User",
    categories = [],
    botInfo = {},
    prefix = config.command?.prefix || ".",
  } = data;

  const parts = [];

  if (greeting) {
    parts.push(greeting);
    parts.push("");
  }

  parts.push(createDashboard({ userName, userStatus, ...data }));
  parts.push("");

  parts.push(createBotInfo(botInfo));
  parts.push("");

  for (const category of categories) {
    parts.push(
      createCategorySection({
        ...category,
        prefix,
      }),
    );
  }

  parts.push(`${EMOJIS.tip} *Tip:* If you don't know how to use the Bot`);
  parts.push(`You can ask the owner`);
  parts.push(`${CHARS.vertical} Mode: ${data.mode || "Public"}`);

  return parts.join("\n");
}

/**
 * Create command list for a specific category
 * @param {string} categoryName - Category name
 * @param {string[]} commands - Array of commands
 * @param {string} prefix - Command prefix
 * @returns {string} Formatted command list
 */
function createCommandList(categoryName, commands, prefix = ".") {
  const emoji = config.categoryEmojis?.[categoryName.toLowerCase()] || "📋";

  const lines = [
    `${CHARS.cornerTopLeft}${CHARS.horizontal}❏ ${emoji} *${categoryName.toUpperCase()}*`,
    "",
  ];

  for (const cmd of commands) {
    lines.push(`${CHARS.vertical} ${prefix}${cmd}`);
  }

  lines.push("");
  lines.push(`${CHARS.cornerBottomLeft}${createLine(20)}`);

  return lines.join("\n");
}

/**
 * Create wait/loading message
 * @param {string} [message='Please wait...'] - Loading message
 * @returns {string} Formatted wait message
 */
function createWaitMessage(message = "Please wait...") {
  return `${EMOJIS.loading} *${message}*`;
}

/**
 * Create success message
 * @param {string} [message='Success!'] - Success message
 * @returns {string} Formatted success message
 */
function createSuccessMessage(message = "Success!") {
  return `${EMOJIS.success} *${message}*`;
}

/**
 * Create error message
 * @param {string} [message='An error occurred!'] - Error message
 * @returns {string} Formatted error message
 */
function createErrorMessage(message = "An error occurred!") {
  return `${EMOJIS.error} *${message}*`;
}

/**
 * Create warning message
 * @param {string} message - Warning message
 * @returns {string} Formatted warning message
 */
function createWarningMessage(message) {
  return `${EMOJIS.warning} *${message}*`;
}

/**
 * Get greeting based on time of day
 * @returns {string} Greeting message
 * @example
 * getTimeGreeting(); // "Good Morning 🌅" (if morning)
 */
function getTimeGreeting() {
  const hour = timeHelper.getHour();

  if (hour >= 4 && hour < 10) return "Good Morning 🌅";
  if (hour >= 10 && hour < 15) return "Good Afternoon ☀️";
  if (hour >= 15 && hour < 18) return "Good Evening 🌇";
  return "Good Night 🌙";
}

/**
 * Capitalize each word in a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 * @example
 * capitalize('hello world'); // "Hello World"
 */
function capitalize(str) {
  if (!str) return "";
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Truncate text if too long
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix if truncated
 * @returns {string} Truncated text
 */
function truncate(text, maxLength, suffix = "...") {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

module.exports = {
  CHARS,
  EMOJIS,
  formatUptime,
  formatDate,
  formatNumber,
  formatFileSize,
  createLine,
  createHeader,
  createFooter,
  createBodyLine,
  createArrowLine,
  createDashboard,
  createBotInfo,
  createUserProfile,
  createBotStatus,
  createCategoryMenu,
  createCategorySection,
  createMainMenu,
  createCommandList,
  createWaitMessage,
  createSuccessMessage,
  createErrorMessage,
  createWarningMessage,
  getTimeGreeting,
  capitalize,
  truncate,
};