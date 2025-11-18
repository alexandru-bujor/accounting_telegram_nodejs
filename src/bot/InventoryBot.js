import { Telegraf, Markup } from "telegraf";
import "dotenv/config";
import { Config } from "../config/config.js";
import { DatabaseService } from "../database/DatabaseService.js";
import { UserState } from "../models/UserState.js";
import { MenuHandler } from "../handlers/MenuHandler.js";
import { SalesHandler } from "../handlers/SalesHandler.js";
import { AdminHandler } from "../handlers/AdminHandler.js";
import { TextHandler } from "../handlers/TextHandler.js";
import { ProductEditHandler } from "../handlers/ProductEditHandler.js";
import { MenuBuilder, removeKeyboard } from "../menus/MenuBuilder.js";
import { ReportService } from "../services/ReportService.js";

/**
 * Main Bot Class
 * Orchestrates all handlers and manages bot lifecycle
 */
export class InventoryBot {
  constructor() {
    this.bot = new Telegraf(Config.botToken);
    this.db = null;
    this.userState = new UserState();
    this.menuHandler = null;
    this.salesHandler = null;
    this.adminHandler = null;
    this.textHandler = null;
  }

  async initialize() {
    // Initialize database
    this.db = await new DatabaseService().initialize();

    // Set database service in Config for role checking
    Config.setDatabaseService(this.db);

    // Initialize default admin users from environment
    if (Config.admins.length > 0) {
      for (const adminId of Config.admins) {
        const user = this.db.getUserById(adminId);
        if (!user) {
          this.db.addUser(adminId, "administrator");
          await this.db.save();
        } else if (user.role !== "administrator") {
          this.db.updateUserRole(adminId, "administrator");
          await this.db.save();
        }
      }
    }

    // Initialize handlers
    this.reportService = new ReportService();
    this.salesHandler = new SalesHandler(this.db, this.userState);
    this.adminHandler = new AdminHandler(this.db, this.userState);
    this.menuHandler = new MenuHandler(this.db, this.userState, this.reportService, this.adminHandler, this.salesHandler);
    this.productEditHandler = new ProductEditHandler(this.db, this.userState);
    this.textHandler = new TextHandler(this.db, this.userState, this.adminHandler, this.salesHandler, this.menuHandler, this.productEditHandler);

    // Register commands and actions
    this.registerCommands();
    this.registerMenuActions();
    this.registerSalesActions();
    this.registerAdminActions();
    this.registerProductEditActions();
    this.registerTextHandler();
    this.registerUtilityActions();
  }

  registerCommands() {
    this.bot.command(["start", "menu"], async (ctx) => {
      // Check access on start
      if (!Config.hasAccess(ctx.from?.id)) {
        // If no role, send chatid with access request button
        const chatId = ctx.from?.id;
        const userName = ctx.from?.username || ctx.from?.first_name || "Necunoscut";
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback("📝 Solicită acces", "access:request")]
        ]);
        await ctx.reply(
          `🆔 Informații despre cont:\n\n` +
          `ChatID: <code>${chatId}</code>\n` +
          `Utilizator: ${userName}\n\n` +
          `❌ Nu aveți acces la acest bot.\n\n` +
          `Contactați un administrator pentru a vă acorda acces.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: keyboard.reply_markup.inline_keyboard,
              remove_keyboard: true
            }
          }
        );
        return;
      }
      await ctx.reply("👋 Bun venit! Bot de gestiune stoc. Totul pe butoane.", MenuBuilder.mainMenu(ctx));
    });

    this.bot.command("chatid", async (ctx) => {
      const chatId = ctx.from?.id;
      const userName = ctx.from?.username || ctx.from?.first_name || "Necunoscut";
      await ctx.reply(
        `🆔 Informații despre cont:\n\n` +
        `ChatID: <code>${chatId}</code>\n` +
        `Utilizator: ${userName}`,
        {
          parse_mode: "HTML",
          ...removeKeyboard()
        }
      );
    });
  }

  registerMenuActions() {
    // Main menu buttons (handled via text messages)
    // These are now handled in TextHandler
  }

  registerSalesActions() {
    this.bot.action("menu:sell", async (ctx) => {
      await this.salesHandler.showProductPicker(ctx, 1, true, "sellpick", "Alege produsul pentru vânzare:");
    });

    this.bot.action(/^pg:sellpick:(-?\d+)$/, async (ctx) => {
      const page = Number(ctx.match[1]);
      await this.salesHandler.showProductPicker(ctx, page, true, "sellpick", "Alege produsul pentru vânzare:");
    });

    this.bot.action(/^sellpick:(\d+):p(\d+)$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      const page = Number(ctx.match[2]);
      await this.salesHandler.handleSellPick(ctx, productId, page);
    });

    this.bot.action(/^sellqty:(\d+):(\d+)$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      const qty = Number(ctx.match[2]);
      await this.salesHandler.handleSellQty(ctx, productId, qty);
    });

    this.bot.action(/^sellother:(\d+)$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      await this.salesHandler.handleSellOther(ctx, productId);
    });

    // Back to vanzari submenu
    this.bot.action("menu:vanzari_back", async (ctx) => {
      await this.menuHandler.handleSales(ctx);
    });

    // Back to users management menu
    this.bot.action("menu:users_back", async (ctx) => {
      await this.adminHandler.handleManageUsers(ctx);
    });

    // Back to editare menu
    this.bot.action("menu:editare_back", async (ctx) => {
      await this.menuHandler.handleEditare(ctx);
    });

    // Back to home/main menu
    this.bot.action("menu:home", async (ctx) => {
      await this.menuHandler.showMenu(ctx);
    });

    // Back to product list (for vânzări)
    this.bot.action("menu:product_list_back", async (ctx) => {
      this.userState.clearState(ctx.from.id);
      await this.salesHandler.showProductPicker(ctx, 1, false, "sellpick", "Alege produsul:", "menu:vanzari_back");
    });
  }

  registerAdminActions() {
    this.bot.action("menu:add", async (ctx) => this.adminHandler.handleAdd(ctx));
    this.bot.action("menu:rename", async (ctx) => this.adminHandler.handleRename(ctx, 1));
    this.bot.action("menu:set", async (ctx) => this.adminHandler.handleSet(ctx, 1));
    this.bot.action("menu:del", async (ctx) => this.adminHandler.handleDelete(ctx, 1));

    // Pagination for admin actions
    this.bot.action(/^pg:renpick:(-?\d+)$/, async (ctx) => {
      const page = Number(ctx.match[1]);
      await this.adminHandler.handleRename(ctx, page);
    });

    this.bot.action(/^pg:setpick:(-?\d+)$/, async (ctx) => {
      const page = Number(ctx.match[1]);
      await this.adminHandler.handleSet(ctx, page);
    });

    this.bot.action(/^pg:delpick:(-?\d+)$/, async (ctx) => {
      const page = Number(ctx.match[1]);
      await this.adminHandler.handleDelete(ctx, page);
    });

    // Product selection for admin actions
    this.bot.action(/^renpick:(\d+):p(\d+)$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      await this.adminHandler.handleRenamePick(ctx, productId);
    });

    this.bot.action(/^setpick:(\d+):p(\d+)$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      await this.adminHandler.handleSetPick(ctx, productId);
    });

    this.bot.action(/^delpick:(\d+):p(\d+)$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      await this.adminHandler.handleDeletePick(ctx, productId);
    });

    // Delete confirmation
    this.bot.action(/^delconfirm:(\d+):yes$/, async (ctx) => {
      const productId = Number(ctx.match[1]);
      await this.adminHandler.handleDeleteConfirm(ctx, productId);
    });
  }

  registerTextHandler() {
    this.bot.on("text", async (ctx) => {
      const result = await this.textHandler.handleText(ctx);
      // Check if access request was submitted and notify admins
      if (result && result.notifyAdmins && result.request) {
        await this.notifyAdminsAboutAccessRequest(result);
      }
    });
  }

  async notifyAdminsAboutAccessRequest(result) {
    const { request, userId, userName, name } = result;
    
    // Get all admin users
    const allUsers = this.db.getAllUsers();
    const admins = allUsers.filter(u => u.role === "administrator");
    
    // Also check environment admins
    const envAdmins = Config.admins;
    const adminIds = new Set();
    
    // Add database admins
    admins.forEach(admin => adminIds.add(String(admin.id)));
    
    // Add environment admins
    envAdmins.forEach(adminId => adminIds.add(String(adminId)));
    
    const message = 
      `📝 Cerere de acces nouă\n\n` +
      `Utilizator: ${name} (${userName})\n` +
      `ChatID: <code>${userId}</code>\n` +
      `Nume solicitat: ${name}\n\n` +
      `Alegeți o acțiune:`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Acceptă", `access:accept:${userId}`),
        Markup.button.callback("❌ Respinge", `access:reject:${userId}`)
      ]
    ]);
    
    // Send to all admins
    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, message, {
          parse_mode: "HTML",
          reply_markup: keyboard.reply_markup
        });
      } catch (error) {
        console.error(`Error notifying admin ${adminId}:`, error);
      }
    }
  }

  registerProductEditActions() {
    // Product selection for add/remove quantity
    this.bot.action(/^editprod:(add|remove):(\d+)$/, async (ctx) => {
      const action = ctx.match[1];
      const productId = Number(ctx.match[2]);
      await this.productEditHandler.handleProductSelect(ctx, productId, action);
    });

    // Back to editor menu
    this.bot.action("menu:editor_back", async (ctx) => {
      await this.menuHandler.handleEditor(ctx);
    });

    // Back to lista menu
    this.bot.action("menu:lista_back", async (ctx) => {
      await this.menuHandler.handleLista(ctx);
    });
  }

  registerUtilityActions() {
    this.bot.action("noop", (ctx) => ctx.answerCbQuery(""));

    // Access request actions
    this.bot.action("access:request", async (ctx) => {
      const userId = String(ctx.from?.id);
      // Check if user already has access
      if (Config.hasAccess(userId)) {
        await ctx.answerCbQuery("Aveți deja acces!");
        await ctx.reply("👋 Bun venit! Bot de gestiune stoc. Totul pe butoane.", MenuBuilder.mainMenu(ctx));
        return;
      }
      // Check if there's already a pending request
      const existingRequest = this.db.getAccessRequest(userId);
      if (existingRequest) {
        await ctx.answerCbQuery("Aveți deja o cerere în așteptare!");
        await ctx.reply(
          `Aveți o cerere de acces în așteptare.\n` +
          `Nume introdus: ${existingRequest.requestedName || "Nu a fost introdus încă"}\n\n` +
          `Vă rugăm să așteptați răspunsul unui administrator.`,
          removeKeyboard()
        );
        return;
      }
      // Set state to await name
      this.userState.setState(userId, { mode: "await_access_name" });
      const keyboard = MenuBuilder.inlineBackMenu("menu:home");
      await ctx.answerCbQuery();
      await ctx.reply(
        `📝 Solicitare acces\n\n` +
        `Pentru a solicita acces, introduceți numele vostru:\n` +
        `(Acest nume va fi afișat în rapoarte și pentru identificare)`,
        {
          reply_markup: {
            inline_keyboard: keyboard.reply_markup.inline_keyboard,
            remove_keyboard: true
          }
        }
      );
    });

    // Access request accept/reject actions
    this.bot.action(/^access:(accept|reject):(.+)$/, async (ctx) => {
      const action = ctx.match[1];
      const requestedUserId = ctx.match[2];
      
      if (!Config.isAdmin(ctx.from?.id)) {
        await ctx.answerCbQuery("Nu aveți permisiuni!");
        return;
      }

      const request = this.db.getAccessRequest(requestedUserId);
      if (!request) {
        await ctx.answerCbQuery("Cererea nu mai există!");
        await ctx.editMessageText("❌ Cererea a fost deja procesată sau nu mai există.");
        return;
      }

      if (action === "accept") {
        // Add user as seller with the requested name
        const existingUser = this.db.getUserById(requestedUserId);
        if (existingUser) {
          // User already exists, just update role and name
          this.db.updateUserRole(requestedUserId, "seller");
          if (request.requestedName) {
            this.db.updateUserName(requestedUserId, request.requestedName);
          }
        } else {
          // Create new user
          const newUser = this.db.addUser(requestedUserId, "seller");
          if (request.requestedName) {
            this.db.updateUserName(requestedUserId, request.requestedName);
          }
        }
        await this.db.save();

        // Remove request
        this.db.removeAccessRequest(requestedUserId);
        await this.db.save();

        // Notify admin
        await ctx.answerCbQuery("✅ Acces acordat!");
        const userDisplay = request.requestedName 
          ? `${request.requestedName} (ChatID: ${requestedUserId})` 
          : `ChatID: ${requestedUserId}`;
        await ctx.editMessageText(
          `✅ Acces acordat\n\n` +
          `Utilizator: ${userDisplay}\n` +
          `Rol: vânzător\n` +
          `Acordat de: ${ctx.from.first_name || "Admin"}`
        );

        // Notify user
        try {
          await this.bot.telegram.sendMessage(
            requestedUserId,
            `✅ Cererea dvs. de acces a fost acceptată!\n\n` +
            `Acum puteți utiliza botul cu rol de vânzător.\n\n` +
            `Utilizați /start pentru a începe.`
          );
        } catch (error) {
          console.error(`Error notifying user ${requestedUserId}:`, error);
        }
      } else {
        // Reject request
        this.db.removeAccessRequest(requestedUserId);
        await this.db.save();

        await ctx.answerCbQuery("❌ Acces respins!");
        const userDisplay = request.requestedName 
          ? `${request.requestedName} (ChatID: ${requestedUserId})` 
          : `ChatID: ${requestedUserId}`;
        await ctx.editMessageText(
          `❌ Acces respins\n\n` +
          `Utilizator: ${userDisplay}\n` +
          `Respins de: ${ctx.from.first_name || "Admin"}`
        );

        // Notify user
        try {
          await this.bot.telegram.sendMessage(
            requestedUserId,
            `❌ Cererea dvs. de acces a fost respinsă.\n\n` +
            `Contactați un administrator pentru mai multe informații.`
          );
        } catch (error) {
          console.error(`Error notifying user ${requestedUserId}:`, error);
        }
      }
    });
  }

  async launch() {
    await this.initialize();
    await this.bot.launch();
    console.log("Bot pornit (tastatură permanentă).");
    
    // Graceful shutdown
    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }
}

