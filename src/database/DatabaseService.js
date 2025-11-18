import { JSONFilePreset } from "lowdb/node";
import { Config } from "../config/config.js";

/**
 * Database Service Class
 * Handles all database operations for products and sales
 */
export class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    this.db = await JSONFilePreset(Config.dbPath, { 
      products: [], 
      sales: [], 
      users: [],
      clients: [],
      pendingAccessRequests: []
    });
    
    // Migrate existing databases: ensure users array exists
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    
    // Migrate existing databases: ensure clients array exists
    if (!this.db.data.clients) {
      this.db.data.clients = [];
      // Migrate existing sales to create clients
      if (this.db.data.sales && this.db.data.sales.length > 0) {
        for (const sale of this.db.data.sales) {
          if (sale.client_name) {
            const normalizedName = this.normalizeClientName(sale.client_name);
            let client = this.db.data.clients.find(c => c.name_normalized === normalizedName);
            if (!client) {
              const nextId = (this.db.data.clients.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
              client = {
                id: nextId,
                name_normalized: normalizedName,
                name_display: sale.client_name.trim()
              };
              this.db.data.clients.push(client);
            }
            sale.client_id = client.id;
          }
        }
      }
      await this.db.write();
    }

    // Migrate existing databases: ensure pendingAccessRequests array exists
    if (!this.db.data.pendingAccessRequests) {
      this.db.data.pendingAccessRequests = [];
      await this.db.write();
    }

    // Ensure all users have 'name' field (migration)
    this.ensureUserNames();
    
    return this;
  }

  // Normalize client name for matching (case-insensitive, trimmed)
  normalizeClientName(name) {
    if (!name) return "";
    return name.trim().toLowerCase();
  }

  // Product operations
  getProductById(id) {
    return this.db.data.products.find(p => p.id === id);
  }

  getAllProducts() {
    return this.db.data.products;
  }

  addProduct(product) {
    const nextId = (this.db.data.products.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
    const newProduct = { id: nextId, ...product, qty_sold: 0 };
    this.db.data.products.push(newProduct);
    return newProduct;
  }

  updateProduct(id, updates) {
    const product = this.getProductById(id);
    if (!product) return null;
    Object.assign(product, updates);
    return product;
  }

  deleteProduct(id) {
    const before = this.db.data.products.length;
    this.db.data.products = this.db.data.products.filter(x => x.id !== id);
    return before !== this.db.data.products.length;
  }

  // Client operations
  getOrCreateClient(clientName) {
    if (!this.db.data.clients) {
      this.db.data.clients = [];
    }
    
    if (!clientName || !clientName.trim()) {
      return null;
    }
    
    const normalizedName = this.normalizeClientName(clientName);
    let client = this.db.data.clients.find(c => c.name_normalized === normalizedName);
    
    if (!client) {
      // Create new client
      const nextId = (this.db.data.clients.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
      client = {
        id: nextId,
        name_normalized: normalizedName,
        name_display: clientName.trim()
      };
      this.db.data.clients.push(client);
    }
    
    return client;
  }

  getClientById(id) {
    if (!this.db.data.clients) {
      return null;
    }
    return this.db.data.clients.find(c => c.id === id);
  }

  getAllClients() {
    if (!this.db.data.clients) {
      this.db.data.clients = [];
    }
    return this.db.data.clients;
  }

  // Sales operations
  addSale(sale) {
    const nextId = (this.db.data.sales.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
    
    // Handle client if client_name is provided
    let clientId = sale.client_id || null;
    if (sale.client_name && !clientId) {
      const client = this.getOrCreateClient(sale.client_name);
      if (client) {
        clientId = client.id;
      }
    }
    
    const newSale = { 
      id: nextId, 
      ...sale,
      client_id: clientId,
      client_name: sale.client_name || null, // Keep for compatibility
      ts: new Date().toISOString() 
    };
    this.db.data.sales.push(newSale);
    return newSale;
  }

  getRecentSales(limit = 20) {
    return this.db.data.sales.slice().reverse().slice(0, limit);
  }

  getAllSales() {
    return this.db.data.sales.slice();
  }

  // User operations
  getUserById(userId) {
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    return this.db.data.users.find(u => u.id === String(userId));
  }

  getUserByIdOrName(identifier) {
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    if (!identifier) return null;
    
    const identifierStr = String(identifier).trim();
    
    // First try by ID
    const byId = this.db.data.users.find(u => u.id === identifierStr);
    if (byId) return byId;
    
    // Then try by name (case-insensitive)
    const byName = this.db.data.users.find(u => 
      u.name && u.name.toLowerCase() === identifierStr.toLowerCase()
    );
    if (byName) return byName;
    
    // Try partial name match
    const partialMatch = this.db.data.users.find(u => 
      u.name && u.name.toLowerCase().includes(identifierStr.toLowerCase())
    );
    if (partialMatch) return partialMatch;
    
    return null;
  }

  getAllUsers() {
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    return this.db.data.users;
  }

  addUser(userId, role = "seller", name = null) {
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    const existing = this.getUserById(userId);
    if (existing) {
      existing.role = role;
      if (name) {
        existing.name = name;
      }
      return existing;
    }
    const newUser = { id: String(userId), role, name: name || null };
    this.db.data.users.push(newUser);
    return newUser;
  }

  updateUserRole(userId, role) {
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    const user = this.getUserById(userId);
    if (!user) return null;
    user.role = role;
    return user;
  }

  updateUserName(userId, name) {
    if (!this.db.data.users) {
      this.db.data.users = [];
    }
    const user = this.getUserById(userId);
    if (!user) return null;
    user.name = name || null;
    return user;
  }

  // Ensure all users have 'name' field (migration helper)
  ensureUserNames() {
    if (!this.db.data.users) {
      this.db.data.users = [];
      return;
    }
    this.db.data.users.forEach(user => {
      if (!('name' in user)) {
        user.name = null;
      }
    });
  }

  deleteUser(userId) {
    if (!this.db.data.users) {
      this.db.data.users = [];
      return false;
    }
    const before = this.db.data.users.length;
    this.db.data.users = this.db.data.users.filter(u => u.id !== String(userId));
    return before !== this.db.data.users.length;
  }

  // Access request operations
  addAccessRequest(userId, userName, requestedName) {
    if (!this.db.data.pendingAccessRequests) {
      this.db.data.pendingAccessRequests = [];
    }
    // Remove any existing request from this user
    this.db.data.pendingAccessRequests = this.db.data.pendingAccessRequests.filter(
      req => req.userId !== String(userId)
    );
    const request = {
      userId: String(userId),
      userName: userName || "Necunoscut",
      requestedName: requestedName || null,
      timestamp: Date.now()
    };
    this.db.data.pendingAccessRequests.push(request);
    return request;
  }

  getAllAccessRequests() {
    if (!this.db.data.pendingAccessRequests) {
      this.db.data.pendingAccessRequests = [];
      return [];
    }
    return this.db.data.pendingAccessRequests;
  }

  getAccessRequest(userId) {
    if (!this.db.data.pendingAccessRequests) {
      this.db.data.pendingAccessRequests = [];
      return null;
    }
    return this.db.data.pendingAccessRequests.find(req => req.userId === String(userId));
  }

  removeAccessRequest(userId) {
    if (!this.db.data.pendingAccessRequests) {
      this.db.data.pendingAccessRequests = [];
      return false;
    }
    const before = this.db.data.pendingAccessRequests.length;
    this.db.data.pendingAccessRequests = this.db.data.pendingAccessRequests.filter(
      req => req.userId !== String(userId)
    );
    return before !== this.db.data.pendingAccessRequests.length;
  }

  // Persistence
  async save() {
    await this.db.write();
  }
}

