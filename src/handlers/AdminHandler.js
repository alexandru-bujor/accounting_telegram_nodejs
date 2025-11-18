import { MenuBuilder, removeKeyboard } from "../menus/MenuBuilder.js";
import { ProductUtils } from "../utils/ProductUtils.js";
import { Config } from "../config/config.js";
import { SalesHandler } from "./SalesHandler.js";

/**
 * Admin Handler
 * Handles admin-only operations (add, edit, delete products)
 */
export class AdminHandler {
  constructor(databaseService, userState) {
    this.db = databaseService;
    this.userState = userState;
    this.salesHandler = new SalesHandler(databaseService, userState);
  }

  async handleAdd(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "add_name" });
    const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
    await ctx.reply("Introduceți numele produsului.", { ...keyboard, ...removeKeyboard() });
  }

  async handleAddName(ctx, name) {
    if (!name) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
      return ctx.reply("Introdu un nume valid.", keyboard);
    }
    this.userState.setState(ctx.from.id, { mode: "add_type", temp: { name } });
    const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
    return ctx.reply("Introduceți tipul (ex: Spumant, Vin roșu).", keyboard);
  }

  async handleAddType(ctx, type) {
    if (!type) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
      return ctx.reply("Introdu un tip valid.", keyboard);
    }
    const state = this.userState.getState(ctx.from.id);
    const temp = { ...(state.temp || {}), type };
    this.userState.setState(ctx.from.id, { mode: "add_qty", temp });
    const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
    return ctx.reply("Introduceți cantitatea totală (număr întreg pozitiv).", keyboard);
  }

  async handleAddQty(ctx, qty) {
    const state = this.userState.getState(ctx.from.id);
    const { name, type } = state.temp || {};
    const product = this.db.addProduct({ name, type, qty_total: qty });
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    return ctx.reply(
      `✅ Adăugat #${product.id}: ${name} (${type}), cant=${qty}`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleRename(ctx, page = 1) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }
    this.userState.clearState(ctx.from.id);
    return this.salesHandler.showProductPicker(
      ctx,
      page,
      true,
      "renpick",
      "Alege produsul pentru redenumire:",
      "menu:editare"
    );
  }

  async handleRenamePick(ctx, productId) {
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.reply("Produs inexistent.", removeKeyboard());
    }
    this.userState.setState(ctx.from.id, { mode: "rename_wait", productId });
    const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
    await ctx.reply(
      `Produs selectat: #${product.id} ${product.name}\nTrimite noul nume în chat.`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleRenameWait(ctx, newName) {
    const state = this.userState.getState(ctx.from.id);
    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }
    this.db.updateProduct(product.id, { name: newName });
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    return ctx.reply(`✅ Redenumit #${product.id} în: ${newName}`, MenuBuilder.mainMenu(ctx));
  }

  async handleSet(ctx, page = 1) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }
    this.userState.clearState(ctx.from.id);
    return this.salesHandler.showProductPicker(
      ctx,
      page,
      true,
      "setpick",
      "Alege produsul pentru setarea stocului total:",
      "menu:editare"
    );
  }

  async handleSetPick(ctx, productId) {
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.reply("Produs inexistent.", removeKeyboard());
    }
    this.userState.setState(ctx.from.id, { mode: "set_wait", productId });
    const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
    await ctx.reply(
      `Produs selectat: #${product.id} ${product.name}\nIntroduceți noua cantitate totală (număr).`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleSetWait(ctx, total) {
    const state = this.userState.getState(ctx.from.id);
    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }
    this.db.updateProduct(product.id, { qty_total: total });
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    return ctx.reply(
      `✅ Actualizat #${product.id}: total=${product.qty_total}, vândut=${product.qty_sold || 0}, rămase=${ProductUtils.remainingOf(product)}`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleDelete(ctx, page = 1) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }
    this.userState.clearState(ctx.from.id);
    return this.salesHandler.showProductPicker(
      ctx,
      page,
      true,
      "delpick",
      "Alege produsul pentru ștergere:",
      "menu:editare"
    );
  }

  async handleDeletePick(ctx, productId) {
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.reply("Produs inexistent.", removeKeyboard());
    }
    this.userState.setState(ctx.from.id, { mode: "delete_confirm", productId });
    const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
    // Combine inline keyboard with removeKeyboard
    await ctx.reply(
      `Sigur doriți să ștergeți: #${product.id} ${product.name}?\nScrieți "DA" pentru confirmare sau "NU" pentru anulare.`,
      { 
        reply_markup: {
          inline_keyboard: keyboard.reply_markup.inline_keyboard,
          remove_keyboard: true
        }
      }
    );
  }

  async handleDeleteConfirm(ctx, productId) {
    const deleted = this.db.deleteProduct(productId);
    await this.db.save();
    await ctx.reply(
      deleted ? `✅ Șters #${productId}.` : "Produsul nu a fost găsit.",
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleManageUsers(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }
    await ctx.reply("Alege opțiunea:", removeKeyboard());
    await ctx.reply("Gestiune utilizatori:", MenuBuilder.usersManagementMenu());
  }

  async handleAddSeller(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "add_seller_chatid" });

    // Get all users to show current list
    const users = this.db.getAllUsers();
    
    let message = "Introduceți ChatID-ul pentru a adăuga un vânzător:\n\n";
    message += "(După ChatID veți putea adăuga un nume custom pentru vânzător)\n\n";
    
    if (users.length === 0) {
      message += "❌ Nu există utilizatori înregistrați.";
    } else {
      message += "📋 Utilizatori actuali:\n\n";
      const lines = users.map(u => {
        const roleEmoji = u.role === "administrator" ? "👑" : "👤";
        const userDisplay = u.name ? `${u.name} (ChatID: ${u.id})` : `ChatID: ${u.id}`;
        return `${roleEmoji} ${userDisplay} — ${u.role}`;
      });
      message += lines.join("\n");
    }

    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    // Combine inline keyboard with removeKeyboard
    await ctx.reply(message, { 
      reply_markup: {
        inline_keyboard: keyboard.reply_markup.inline_keyboard,
        remove_keyboard: true
      }
    });
  }

  async handleAddSellerChatId(ctx, identifier) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const identifierStr = String(identifier).trim();
    if (!identifierStr) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
      return ctx.reply("Introduceți un ChatID valid.", keyboard);
    }

    // Check if user wants to go back (clicked back button text)
    if (identifierStr.toLowerCase().includes("înapoi") || 
        identifierStr.toLowerCase().includes("inapoi") ||
        identifierStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    // Only accept ChatID (numeric)
    if (!/^-?\d+$/.test(identifierStr)) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
      return ctx.reply(
        `ChatID invalid. Te rog să introduci un număr valid (ex: 123456789).\n\n` +
        `Introduceți ChatID-ul utilizatorului:`,
        keyboard
      );
    }

    // It's a valid ChatID
    const existingUser = this.db.getUserById(identifierStr);
    if (existingUser) {
      if (existingUser.role === "administrator") {
        this.userState.clearState(ctx.from.id);
        return ctx.reply(
          `Utilizatorul cu ChatID ${identifierStr} este deja administrator.`,
          MenuBuilder.mainMenu(ctx)
        );
      }
      // Move to name input step
      this.userState.setState(ctx.from.id, { mode: "add_seller_name", chatId: identifierStr });
        const keyboard1 = MenuBuilder.inlineBackMenu("menu:users_back");
        const userDisplay = existingUser.name ? `${existingUser.name} (ChatID: ${identifierStr})` : `ChatID: ${identifierStr}`;
        await ctx.reply(
          `Utilizator găsit: ${userDisplay}\n\n` +
          `Introduceți numele custom pentru vânzător (opțional, apăsați "Skip" pentru a continua fără nume):`,
          keyboard1
        );
      return;
    }

    // New user with ChatID
    this.userState.setState(ctx.from.id, { mode: "add_seller_name", chatId: identifierStr });
    const keyboard2 = MenuBuilder.inlineBackMenu("menu:users_back");
    await ctx.reply(
      `ChatID validat: ${identifierStr}\n\n` +
      `Introduceți numele custom pentru vânzător (opțional, apăsați "Skip" pentru a continua fără nume):`,
      keyboard2
    );
  }

  async handleAddSellerName(ctx, name) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "add_seller_name") {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Sesiune expirată. Începeți din nou.", MenuBuilder.mainMenu(ctx));
    }

    // Check if user wants to go back (clicked back button text)
    const nameStr = String(name || "").trim();
    if (nameStr.toLowerCase().includes("înapoi") || 
        nameStr.toLowerCase().includes("inapoi") ||
        nameStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    const chatIdNum = state.chatId;
    const sellerName = name && name.trim().toLowerCase() !== "skip" ? name.trim() : null;

    const existingUser = this.db.getUserById(chatIdNum);
    if (existingUser) {
      if (existingUser.role === "administrator") {
        this.userState.clearState(ctx.from.id);
        return ctx.reply(
          `Utilizatorul cu ChatID ${chatIdNum} este deja administrator.`,
          MenuBuilder.mainMenu(ctx)
        );
      }
      this.db.updateUserRole(chatIdNum, "seller");
      this.db.updateUserName(chatIdNum, sellerName);
      await this.db.save();
      this.userState.clearState(ctx.from.id);
      const userDisplay = sellerName ? `${sellerName} (ChatID: ${chatIdNum})` : `ChatID: ${chatIdNum}`;
      return ctx.reply(
        `✅ Utilizatorul ${userDisplay} a fost actualizat la vânzător.`,
        MenuBuilder.mainMenu(ctx)
      );
    }

    this.db.addUser(chatIdNum, "seller", sellerName);
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    const userDisplay = sellerName ? `${sellerName} (ChatID: ${chatIdNum})` : `ChatID: ${chatIdNum}`;
    return ctx.reply(
      `✅ Vânzător adăugat cu succes!\n${userDisplay} — Rol: seller`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleListUsers(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }

    const users = this.db.getAllUsers();
    if (!users.length) {
      return ctx.reply("Nu există utilizatori înregistrați.", MenuBuilder.usersManagementMenu());
    }

    const lines = users.map(u => {
      const roleEmoji = u.role === "administrator" ? "👑" : "👤";
      const displayName = u.name ? `${u.name} (ChatID: ${u.id})` : `ChatID: ${u.id}`;
      return `${roleEmoji} ${displayName} — Rol: ${u.role}`;
    });

    const message = "👥 Utilizatori înregistrați:\n\n" + lines.join("\n");
    await ctx.reply(message, MenuBuilder.usersManagementMenu());
  }

  async handleChangeUserName(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "change_username_chatid" });

    // Get all users to show current list
    const users = this.db.getAllUsers();
    
    let message = "Introduceți ChatID-ul sau numele utilizatorului pentru a-i schimba numele:\n\n";
    
    if (users.length === 0) {
      message += "❌ Nu există utilizatori înregistrați.";
    } else {
      message += "📋 Utilizatori actuali:\n\n";
      const lines = users.map(u => {
        const roleEmoji = u.role === "administrator" ? "👑" : "👤";
        const displayName = u.name ? `${u.name} (ChatID: ${u.id})` : `ChatID: ${u.id}`;
        return `${roleEmoji} ${displayName} — Rol: ${u.role}`;
      });
      message += lines.join("\n");
    }

    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    // Combine inline keyboard with removeKeyboard
    await ctx.reply(message, { 
      reply_markup: {
        inline_keyboard: keyboard.reply_markup.inline_keyboard,
        remove_keyboard: true
      }
    });
  }

  async handleChangeUserNameChatId(ctx, identifier) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const identifierStr = String(identifier).trim();
    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    
    if (!identifierStr) {
      return ctx.reply("Introduceți un ChatID sau nume valid.", keyboard);
    }

    // Check if user wants to go back (clicked back button text)
    if (identifierStr.toLowerCase().includes("înapoi") || 
        identifierStr.toLowerCase().includes("inapoi") ||
        identifierStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    // Try to find user by ID or name
    const user = this.db.getUserByIdOrName(identifierStr);
    if (!user) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply(
        `Utilizatorul "${identifierStr}" nu a fost găsit.`,
        keyboard
      );
    }

    // Save user ID and move to name input step
    this.userState.setState(ctx.from.id, { 
      mode: "change_username_value", 
      userId: user.id 
    });
    
    const userDisplay = user.name ? `${user.name} (ChatID: ${user.id})` : `ChatID: ${user.id}`;
    await ctx.reply(
      `Utilizator: ${userDisplay}\nRol: ${user.role}\nNume actual: ${user.name || "(fără nume)"}\n\n` +
      `Introduceți noul nume (sau "Sterge" pentru a șterge numele existent):`,
      { 
        reply_markup: {
          inline_keyboard: keyboard.reply_markup.inline_keyboard,
          remove_keyboard: true
        }
      }
    );
  }

  async handleChangeUserNameValue(ctx, newName) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "change_username_value") {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Sesiune expirată. Începeți din nou.", MenuBuilder.mainMenu(ctx));
    }

    // Check if user wants to go back (clicked back button text)
    const nameStr = String(newName || "").trim();
    if (nameStr.toLowerCase().includes("înapoi") || 
        nameStr.toLowerCase().includes("inapoi") ||
        nameStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    const userId = state.userId;
    const user = this.db.getUserById(userId);
    if (!user) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply(
        `Utilizatorul cu ChatID ${userId} nu a fost găsit.`,
        MenuBuilder.mainMenu(ctx)
      );
    }

    // Check if user wants to delete the name
    let finalName = null;
    if (nameStr.toLowerCase() === "sterge" || nameStr.toLowerCase() === "delete" || nameStr.toLowerCase() === "șterge") {
      finalName = null;
    } else if (nameStr) {
      finalName = nameStr;
    } else {
      const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
      return ctx.reply(
        "Introduceți un nume valid sau \"Sterge\" pentru a șterge numele existent.",
        { 
          reply_markup: {
            inline_keyboard: keyboard.reply_markup.inline_keyboard,
            remove_keyboard: true
          }
        }
      );
    }

    // Update user name
    this.db.updateUserName(userId, finalName);
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    
    const userDisplay = finalName ? `${finalName} (ChatID: ${userId})` : `ChatID: ${userId}`;
    const action = finalName ? (user.name ? "schimbat" : "setat") : "șters";
    return ctx.reply(
      `✅ Numele utilizatorului ${userDisplay} a fost ${action}.`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleRemoveSeller(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "remove_seller_chatid" });

    // Get all users (only sellers for deletion)
    const users = this.db.getAllUsers();
    const sellers = users.filter(u => u.role === "seller");
    
    let message = "Introduceți ChatID-ul sau numele vânzătorului pentru a-l șterge:\n\n";
    message += "(Atenție: Utilizatorii cu rol de administrator nu pot fi șterși)\n\n";
    
    if (sellers.length === 0) {
      message += "❌ Nu există vânzători înregistrați.";
    } else {
      message += "📋 Vânzători actuali:\n\n";
      const lines = sellers.map(u => {
        const userDisplay = u.name ? `${u.name} (ChatID: ${u.id})` : `ChatID: ${u.id}`;
        return `👤 ${userDisplay}`;
      });
      message += lines.join("\n");
    }

    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    // Combine inline keyboard with removeKeyboard
    await ctx.reply(message, { 
      reply_markup: {
        inline_keyboard: keyboard.reply_markup.inline_keyboard,
        remove_keyboard: true
      }
    });
  }

  async handleChangeRole(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni.", removeKeyboard());
    }
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "change_role_chatid" });
    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    // Combine inline keyboard with removeKeyboard
    await ctx.reply(
      "Introduceți ChatID-ul sau numele utilizatorului pentru a-i schimba rolul:\n\n" +
      "(Puteți folosi ChatID sau numele dacă utilizatorul are deja un nume setat)\n" +
      "(Puteți schimba între 'seller' și 'administrator')",
      { 
        reply_markup: {
          inline_keyboard: keyboard.reply_markup.inline_keyboard,
          remove_keyboard: true
        }
      }
    );
  }

  async handleChangeRoleChatId(ctx, identifier) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const identifierStr = String(identifier).trim();
    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    
    if (!identifierStr) {
      return ctx.reply("Introduceți un ChatID sau nume valid.", keyboard);
    }

    // Check if user wants to go back (clicked back button text)
    if (identifierStr.toLowerCase().includes("înapoi") || 
        identifierStr.toLowerCase().includes("inapoi") ||
        identifierStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    // Try to find user by ID or name
    const user = this.db.getUserByIdOrName(identifierStr);
    if (!user) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply(
        `Utilizatorul "${identifierStr}" nu a fost găsit.`,
        keyboard
      );
    }

    // Save chatId and current role, move to role selection
    this.userState.setState(ctx.from.id, { 
      mode: "change_role_select", 
      chatId: user.id,
      currentRole: user.role 
    });
    
    const newRole = user.role === "administrator" ? "seller" : "administrator";
    const userDisplay = user.name ? `${user.name} (ChatID: ${user.id})` : `ChatID: ${user.id}`;
    const keyboard4 = MenuBuilder.inlineBackMenu("menu:users_back");
    await ctx.reply(
      `Utilizator: ${userDisplay}\n` +
      `Rol actual: ${user.role}\n` +
      `Rol nou propus: ${newRole}\n\n` +
      `Scrieți "DA" pentru a confirma schimbarea sau "NU" pentru anulare:`,
      keyboard4
    );
  }

  async handleChangeRoleConfirm(ctx, confirm) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "change_role_select") {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Sesiune expirată. Începeți din nou.", MenuBuilder.mainMenu(ctx));
    }

    // Check if user wants to go back (clicked back button text)
    const confirmStr = String(confirm || "").trim();
    if (confirmStr.toLowerCase().includes("înapoi") || 
        confirmStr.toLowerCase().includes("inapoi") ||
        confirmStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    const chatIdNum = state.chatId;
    const user = this.db.getUserById(chatIdNum);
    if (!user) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply(
        `Utilizatorul cu ChatID ${chatIdNum} nu a fost găsit.`,
        MenuBuilder.mainMenu(ctx)
      );
    }

    if (confirm.toUpperCase() === "DA" || confirm.toUpperCase() === "YES") {
      const newRole = user.role === "administrator" ? "seller" : "administrator";
      this.db.updateUserRole(chatIdNum, newRole);
      await this.db.save();
      this.userState.clearState(ctx.from.id);
      const userDisplay = user.name ? `${user.name} (ChatID: ${chatIdNum})` : `ChatID: ${chatIdNum}`;
      return ctx.reply(
        `✅ Rolul utilizatorului ${userDisplay} a fost schimbat de la "${user.role}" la "${newRole}".`,
        MenuBuilder.mainMenu(ctx)
      );
    }

    if (confirm.toUpperCase() === "NU" || confirm.toUpperCase() === "NO") {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Schimbarea rolului a fost anulată.", MenuBuilder.mainMenu(ctx));
    }

    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    return ctx.reply('Scrieți "DA" pentru confirmare sau "NU" pentru anulare.', keyboard);
  }

  async handleSettings(ctx) {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.reply("Nu aveți acces.", removeKeyboard());
    }
    
    const userId = String(ctx.from?.id);
    const user = this.db.getUserById(userId);
    const userDisplay = user && user.name ? `${user.name} (ChatID: ${userId})` : `ChatID: ${userId}`;
    const role = user ? user.role : (Config.isAdmin(userId) ? "administrator" : (Config.isSeller(userId) ? "seller" : "fără rol"));
    
    const message = 
      `⚙️ Setări\n\n` +
      `Utilizator: ${userDisplay}\n` +
      `Rol: ${role}\n` +
      `Nume actual: ${user && user.name ? user.name : "(fără nume)"}\n\n` +
      `Alegeți o opțiune:`;
    
    await ctx.reply(message, MenuBuilder.settingsMenu());
  }

  async handleChangeMyName(ctx) {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.reply("Nu aveți acces.", removeKeyboard());
    }
    
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "change_myname" });
    
    const userId = String(ctx.from?.id);
    const user = this.db.getUserById(userId);
    const currentName = user && user.name ? user.name : "(fără nume)";
    
    const message = 
      `Schimbă numele tău:\n\n` +
      `Nume actual: ${currentName}\n\n` +
      `Introduceți noul nume (sau "Sterge" pentru a șterge numele existent):`;
    
    const keyboard = MenuBuilder.inlineBackMenu("menu:home");
    await ctx.reply(message, { 
      reply_markup: {
        inline_keyboard: keyboard.reply_markup.inline_keyboard,
        remove_keyboard: true
      }
    });
  }

  async handleChangeMyNameValue(ctx, newName) {
    if (!Config.hasAccess(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți acces.", MenuBuilder.mainMenu(ctx));
    }

    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "change_myname") {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Sesiune expirată. Începeți din nou.", MenuBuilder.mainMenu(ctx));
    }

    // Check if user wants to go back (clicked back button text)
    const nameStr = String(newName || "").trim();
    if (nameStr.toLowerCase().includes("înapoi") || 
        nameStr.toLowerCase().includes("inapoi") ||
        nameStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleSettings(ctx);
    }

    const userId = String(ctx.from?.id);
    
    // Ensure user exists in database
    let user = this.db.getUserById(userId);
    if (!user) {
      // Create user if doesn't exist
      const role = Config.isAdmin(userId) ? "administrator" : (Config.isSeller(userId) ? "seller" : null);
      if (role) {
        user = this.db.addUser(userId, role);
        await this.db.save();
      } else {
        this.userState.clearState(ctx.from.id);
        return ctx.reply("Nu aveți acces.", MenuBuilder.mainMenu(ctx));
      }
    }

    // Check if user wants to delete the name
    let finalName = null;
    if (nameStr.toLowerCase() === "sterge" || nameStr.toLowerCase() === "delete" || nameStr.toLowerCase() === "șterge") {
      finalName = null;
    } else if (nameStr) {
      finalName = nameStr;
    } else {
      const keyboard = MenuBuilder.inlineBackMenu("menu:home");
      return ctx.reply(
        "Introduceți un nume valid sau \"Sterge\" pentru a șterge numele existent.",
        { 
          reply_markup: {
            inline_keyboard: keyboard.reply_markup.inline_keyboard,
            remove_keyboard: true
          }
        }
      );
    }

    // Update user name
    this.db.updateUserName(userId, finalName);
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    
    const userDisplay = finalName ? `${finalName} (ChatID: ${userId})` : `ChatID: ${userId}`;
    const action = finalName ? (user.name ? "schimbat" : "setat") : "șters";
    return ctx.reply(
      `✅ Numele tău ${userDisplay} a fost ${action}.`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleAccessRequestName(ctx, name) {
    const userId = String(ctx.from?.id);
    const state = this.userState.getState(userId);
    
    if (!state || state.mode !== "await_access_name") {
      this.userState.clearState(userId);
      return ctx.reply("Sesiune expirată. Începeți din nou.", removeKeyboard());
    }

    // Check if user wants to go back
    const nameStr = String(name || "").trim();
    if (nameStr.toLowerCase().includes("înapoi") || 
        nameStr.toLowerCase().includes("inapoi") ||
        nameStr.includes("⬅️")) {
      this.userState.clearState(userId);
      return ctx.reply(
        "Solicitarea a fost anulată.",
        removeKeyboard()
      );
    }

    if (!nameStr || nameStr.length === 0) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:home");
      return ctx.reply(
        "Introduceți un nume valid.",
        { 
          reply_markup: {
            inline_keyboard: keyboard.reply_markup.inline_keyboard,
            remove_keyboard: true
          }
        }
      );
    }

    // Get user info
    const userName = ctx.from?.username || ctx.from?.first_name || "Necunoscut";
    
    // Add access request
    const request = this.db.addAccessRequest(userId, userName, nameStr);
    await this.db.save();
    
    // Clear state
    this.userState.clearState(userId);
    
    // Notify user
    await ctx.reply(
      `✅ Cererea dvs. de acces a fost trimisă!\n\n` +
      `Nume introdus: ${nameStr}\n\n` +
      `Un administrator va procesa cererea în curând.\n` +
      `Veți primi o notificare când cererea va fi procesată.`,
      removeKeyboard()
    );
    
    // Return request info so InventoryBot can notify admins
    return { request, userId, userName, name: nameStr, notifyAdmins: true };
  }

  async handleRemoveSellerChatId(ctx, identifier) {
    if (!Config.isAdmin(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți permisiuni.", MenuBuilder.mainMenu(ctx));
    }

    const identifierStr = String(identifier).trim();
    const keyboard = MenuBuilder.inlineBackMenu("menu:users_back");
    
    if (!identifierStr) {
      return ctx.reply("Introduceți un ChatID sau nume valid.", keyboard);
    }

    // Check if user wants to go back (clicked back button text)
    if (identifierStr.toLowerCase().includes("înapoi") || 
        identifierStr.toLowerCase().includes("inapoi") ||
        identifierStr.includes("⬅️")) {
      this.userState.clearState(ctx.from.id);
      return this.handleManageUsers(ctx);
    }

    // Try to find user by ID or name
    const user = this.db.getUserByIdOrName(identifierStr);
    if (!user) {
      return ctx.reply(
        `Utilizatorul "${identifierStr}" nu a fost găsit.`,
        keyboard
      );
    }

    if (user.role === "administrator") {
      this.userState.clearState(ctx.from.id);
      return ctx.reply(
        "Nu puteți șterge un administrator.",
        MenuBuilder.mainMenu(ctx)
      );
    }

    const deleted = this.db.deleteUser(user.id);
    await this.db.save();
    this.userState.clearState(ctx.from.id);
    const userDisplayName = user.name ? `${user.name} (ChatID: ${user.id})` : `ChatID: ${user.id}`;
    return ctx.reply(
      deleted ? `✅ Utilizatorul ${userDisplayName} a fost șters.` : "Utilizatorul nu a fost găsit.",
      MenuBuilder.mainMenu(ctx)
    );
  }
}

