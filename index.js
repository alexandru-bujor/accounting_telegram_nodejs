import { InventoryBot } from "./src/bot/InventoryBot.js";

/**
 * Entry point for the Telegram Inventory Bot
 * Initializes and launches the bot
 */
const bot = new InventoryBot();
bot.launch().catch(console.error);
