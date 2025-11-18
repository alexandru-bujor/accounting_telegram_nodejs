/**
 * Configuration module
 * Handles environment variables and app configuration
 */
export class Config {
  static databaseService = null;

  static setDatabaseService(db) {
    this.databaseService = db;
  }

  static get botToken() {
    return process.env.BOT_TOKEN;
  }

  static get admins() {
    return (process.env.ADMINS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  static getUserRole(userId) {
    if (!userId) return null;
    
    // First check if database has users
    if (this.databaseService) {
      const user = this.databaseService.getUserById(userId);
      if (user) {
        return user.role;
      }
    }

    // Fallback to environment variable admins
    if (this.admins.includes(String(userId))) {
      return "administrator";
    }

    // Default: no access
    return null;
  }

  static isAdmin(userId) {
    return this.getUserRole(userId) === "administrator";
  }

  static isSeller(userId) {
    const role = this.getUserRole(userId);
    return role === "seller" || role === "administrator";
  }

  static hasAccess(userId) {
    return this.isSeller(userId);
  }

  static get perPage() {
    return 8;
  }

  static get dbPath() {
    return "db.json";
  }
}

