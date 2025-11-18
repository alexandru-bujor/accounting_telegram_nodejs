/**
 * Message Utility Functions
 * Helper functions for sending/editing messages
 */
export class MessageUtils {
  /**
   * Safely edit a message, or send a new one if editing fails
   */
  static async safeEdit(ctx, text, keyboard, opts = {}) {
    try {
      await ctx.editMessageText(text, { ...opts, ...keyboard });
    } catch {
      await ctx.reply(text, { ...opts, ...keyboard });
    }
  }
}

