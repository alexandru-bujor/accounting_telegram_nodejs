# Telegram Inventory Bot

A modular, object-oriented Telegram bot for inventory management with inline menus and beautiful table formatting.

## 📁 Project Structure

```
telegram_inventory_bot/
├── src/
│   ├── bot/
│   │   └── InventoryBot.js       # Main bot class orchestrating all handlers
│   ├── config/
│   │   └── config.js             # Configuration and environment variables
│   ├── database/
│   │   └── DatabaseService.js    # Database operations (products & sales)
│   ├── handlers/
│   │   ├── AdminHandler.js       # Admin operations (add, edit, delete)
│   │   ├── MenuHandler.js        # Menu navigation handlers
│   │   ├── SalesHandler.js       # Sales operations
│   │   └── TextHandler.js        # Text input handling for multi-step flows
│   ├── menus/
│   │   └── MenuBuilder.js        # Inline keyboard menu builders
│   ├── models/
│   │   └── UserState.js          # User state management
│   └── utils/
│       ├── MessageUtils.js       # Message sending utilities
│       ├── Pagination.js         # Pagination logic
│       ├── ProductUtils.js       # Product calculation utilities
│       └── TableBuilder.js       # ASCII table formatter
├── index.js                      # Entry point
├── seed.js                       # Database seeding script
└── package.json
```

## 🏗️ Architecture Overview

The bot follows an **Object-Oriented Programming (OOP)** architecture with clear separation of concerns:

- **Config**: Centralized configuration management
- **Database**: Data persistence layer
- **Models**: Data models and state management
- **Utils**: Reusable utility functions
- **Menus**: UI components (keyboards)
- **Handlers**: Business logic for different features
- **Bot**: Main orchestrator that wires everything together

## 🚀 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create a `.env` file:
   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   ADMINS=123456789,987654321  # Optional: comma-separated user IDs
   ```

3. **Seed database (optional):**
   ```bash
   npm run seed
   ```

4. **Start the bot:**
   ```bash
   npm start
   ```

## 📖 How to Add New Functionalities

### Step 1: Add a New Menu Button

Edit `src/menus/MenuBuilder.js` to add a new button to the main menu:

```javascript
static mainMenu(ctx) {
  const rows = [
    [Markup.button.callback("Lista", "menu:lista")],
    [Markup.button.callback("Stoc", "menu:stoc")],
    [Markup.button.callback("Vanzari", "menu:sales")],
    [Markup.button.callback("Editare", "menu:editare")],
    [Markup.button.callback("Noua Funcție", "menu:newfeature")], // Add here
    [Markup.button.callback("Inapoi", "menu:home")],
    [Markup.button.callback("Meniu principal", "menu:home")]
  ];
  return Markup.inlineKeyboard(rows);
}
```

### Step 2: Create a Handler Method

Add a handler method in the appropriate handler class. For example, in `src/handlers/MenuHandler.js`:

```javascript
async handleNewFeature(ctx) {
  // Your logic here
  await MessageUtils.safeEdit(
    ctx,
    "This is my new feature!",
    MenuBuilder.mainMenu(ctx)
  );
}
```

### Step 3: Register the Action

In `src/bot/InventoryBot.js`, register the action in the appropriate method:

```javascript
registerMenuActions() {
  // ... existing actions
  this.bot.action("menu:newfeature", async (ctx) => 
    this.menuHandler.handleNewFeature(ctx)
  );
}
```

### Step 4: Create a New Handler Class (if needed)

If your feature is complex enough, create a new handler class:

**Create `src/handlers/NewFeatureHandler.js`:**

```javascript
import { MessageUtils } from "../utils/MessageUtils.js";
import { MenuBuilder } from "../menus/MenuBuilder.js";

export class NewFeatureHandler {
  constructor(databaseService, userState) {
    this.db = databaseService;
    this.userState = userState;
  }

  async handleFeature(ctx) {
    // Your feature logic
    const data = this.db.getAllProducts(); // Example
    await MessageUtils.safeEdit(
      ctx,
      `Feature result: ${data.length} products`,
      MenuBuilder.mainMenu(ctx)
    );
  }
}
```

**Register it in `src/bot/InventoryBot.js`:**

```javascript
constructor() {
  // ... existing code
  this.newFeatureHandler = null;
}

async initialize() {
  // ... existing code
  this.newFeatureHandler = new NewFeatureHandler(this.db, this.userState);
  // ... rest of initialization
}

registerNewFeatureActions() {
  this.bot.action("menu:newfeature", async (ctx) => 
    this.newFeatureHandler.handleFeature(ctx)
  );
}

// Call registerNewFeatureActions() in initialize() method
```

### Step 5: Add Multi-Step Flows

For features requiring multiple user inputs (like adding products), use the `UserState` class:

**Example: Multi-step feature**

```javascript
// Step 1: Start the flow
async handleStartFlow(ctx) {
  this.userState.setState(ctx.from.id, { mode: "flow_step1" });
  await MessageUtils.safeEdit(
    ctx,
    "Enter first input:",
    MenuBuilder.backMenu()
  );
}

// Step 2: Handle first input (in TextHandler)
// Add to src/handlers/TextHandler.js:
async handleText(ctx) {
  const state = this.userState.getState(ctx.from.id);
  if (!state) return;

  if (state.mode === "flow_step1") {
    const input1 = ctx.message.text.trim();
    this.userState.setState(ctx.from.id, { 
      mode: "flow_step2", 
      temp: { input1 } 
    });
    return ctx.reply("Enter second input:");
  }

  if (state.mode === "flow_step2") {
    const input2 = ctx.message.text.trim();
    const { input1 } = state.temp || {};
    
    // Process inputs
    const result = this.processInputs(input1, input2);
    
    this.userState.clearState(ctx.from.id);
    return ctx.reply(`Result: ${result}`, MenuBuilder.mainMenu(ctx));
  }
}
```

### Step 6: Add Database Operations

If you need new database operations, extend `src/database/DatabaseService.js`:

```javascript
// Add new method to DatabaseService class
getProductsByType(type) {
  return this.db.data.products.filter(p => p.type === type);
}

// Use it in your handler
async handleFilterByType(ctx, type) {
  const products = this.db.getProductsByType(type);
  // ... process and display
}
```

### Step 7: Add Custom Menus

Create custom menus in `src/menus/MenuBuilder.js`:

```javascript
static customFeatureMenu(options) {
  const rows = options.map(opt => [
    Markup.button.callback(opt.label, opt.callback)
  ]);
  rows.push([Markup.button.callback("⬅️ Înapoi", "menu:home")]);
  return Markup.inlineKeyboard(rows);
}
```

## 🔧 Common Patterns

### Pattern 1: Simple Action Handler

```javascript
// In Handler class
async handleAction(ctx) {
  const result = this.performAction();
  await MessageUtils.safeEdit(
    ctx,
    result,
    MenuBuilder.mainMenu(ctx)
  );
}

// In InventoryBot.js
this.bot.action("action:name", async (ctx) => 
  this.handler.handleAction(ctx)
);
```

### Pattern 2: Paginated List

```javascript
async handlePaginatedList(ctx, page = 1) {
  const items = this.db.getAllItems();
  const { slice, page: p, pages } = Pagination.paginate(items, page);
  const keyboard = MenuBuilder.productPickerMenu(
    slice, p, pages, "prefix", "menu:home"
  );
  await MessageUtils.safeEdit(ctx, "Select item:", keyboard);
}

// Register pagination
this.bot.action(/^pg:prefix:(-?\d+)$/, async (ctx) => {
  const page = Number(ctx.match[1]);
  await this.handler.handlePaginatedList(ctx, page);
});
```

### Pattern 3: Confirmation Dialog

```javascript
async handleDelete(ctx, id) {
  await MessageUtils.safeEdit(
    ctx,
    "Are you sure?",
    MenuBuilder.deleteConfirmationMenu(id)
  );
}

// Confirmation action
this.bot.action(/^confirm:(\d+):yes$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  await this.handler.performDelete(ctx, id);
});
```

## 📝 Best Practices

1. **Keep handlers focused**: Each handler should handle one feature area
2. **Use dependency injection**: Pass `databaseService` and `userState` to handlers
3. **Reuse utilities**: Use `MessageUtils`, `Pagination`, `TableBuilder` for common tasks
4. **Clear state**: Always clear user state when flows complete
5. **Error handling**: Validate inputs and handle edge cases
6. **Admin checks**: Use `Config.isAdmin(ctx.from?.id)` for admin-only features

## 🧪 Testing Your Changes

1. **Start the bot**: `npm start`
2. **Test in Telegram**: Send `/start` to your bot
3. **Check console**: Look for errors in the terminal
4. **Test edge cases**: Empty data, invalid inputs, etc.

## 📚 Key Classes Reference

### `DatabaseService`
- `getProductById(id)` - Get product by ID
- `getAllProducts()` - Get all products
- `addProduct(product)` - Add new product
- `updateProduct(id, updates)` - Update product
- `deleteProduct(id)` - Delete product
- `addSale(sale)` - Record a sale
- `getRecentSales(limit)` - Get recent sales
- `save()` - Persist changes

### `UserState`
- `setState(userId, state)` - Set user state
- `getState(userId)` - Get user state
- `clearState(userId)` - Clear user state
- `hasState(userId)` - Check if user has state

### `MenuBuilder`
- `mainMenu(ctx)` - Main menu
- `listaSubmenu()` - List submenu
- `editareSubmenu(ctx)` - Edit submenu
- `productPickerMenu(...)` - Product picker with pagination
- `backMenu(action)` - Simple back button

### `MessageUtils`
- `safeEdit(ctx, text, keyboard, opts)` - Safely edit or send message

### `ProductUtils`
- `remainingOf(product)` - Calculate remaining stock
- `listProducts(products, includeZero)` - Filter and sort products
- `productLine(product)` - Format product line

### `TableBuilder`
- `buildTable(items)` - Create ASCII table

### `Pagination`
- `paginate(arr, page, perPage)` - Paginate array

## 🐛 Troubleshooting

**Bot not responding?**
- Check `BOT_TOKEN` in `.env`
- Verify bot is running: `npm start`
- Check console for errors

**Database issues?**
- Ensure `db.json` exists and is writable
- Check file permissions

**State not working?**
- Ensure you're calling `setState` and `clearState` correctly
- Check user ID is being passed correctly

## 📄 License

This project is open source and available for modification.

## 🤝 Contributing

When adding new features:
1. Follow the existing code structure
2. Add comments for complex logic
3. Update this README if adding major features
4. Test thoroughly before committing
