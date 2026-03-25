import { supabase } from "./config.js";
import "./add_cart.js";

let currentFilter = null;
let cartData = {};

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {

    const header = await fetch("user_header.html");
    document.getElementById("headerContainer").innerHTML = await header.text();

    const footer = await fetch("footer.html");
    document.getElementById("footerContainer").innerHTML = await footer.text();

    await loadCartFromDB();
    await updateHeaderFromDB();

    // Parse URL param
    const urlParams = new URLSearchParams(window.location.search);
    currentFilter = urlParams.get('category') || null;

    await loadCategories();
    await loadMenu(currentFilter);
    
    // Realtime updates for products - TARGETED UPDATES ONLY
    supabase
      .channel('menu-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
        console.log('Product change:', payload);
        const container = document.getElementById('menuContainer');
        if (container) {
          container.innerHTML = '';
          await loadMenu(currentFilter);
        }
      })
      .subscribe();
});

// ================= LOAD CART =================
async function loadCartFromDB() {

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

    cartData = data?.cart_items || {};
}

// ================= UPDATE CART =================
async function updateCartDB() {

    const user = JSON.parse(localStorage.getItem("user"));

    await supabase
        .from("cart")
        .update({ cart_items: cartData })
        .eq("user_email", user.email);
}

// ================= HEADER UPDATE =================
async function updateHeaderFromDB() {

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

    const cart = data?.cart_items || {};

    let total = 0;
    Object.values(cart).forEach(q => total += q);

    const el = document.getElementById("cartCount");
    if (el) el.textContent = total > 0 ? `(${total})` : "";
}

// ================= CART BAR =================
function showCartBar() {

    const bar = document.getElementById("cartBar");
    if (!bar) return;

    bar.classList.add("show");

    let total = 0;
    Object.values(cartData).forEach(q => total += q);

    document.getElementById("cartText").textContent =
        `${total} item${total > 1 ? "s" : ""} added`;
}

// ================= TOAST =================
function showToast(message) {

    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);
}

// ================= CREATE SINGLE PRODUCT CARD =================
function createProductCard(product) {
    const isOut = product.stock <= 0;
    const qty = cartData[product.id] || 0;

    const img = supabase.storage
        .from("Food-Website-Storage")
        .getPublicUrl(`Products/${product.image}`).data.publicUrl;

    const card = document.createElement("div");
    card.dataset.productId = product.id;
    if (isOut) card.classList.add("out-stock");
    card.className = "box";

    card.innerHTML = `
        <div class="img-wrapper">
            <img src="${img}" style="${isOut ? 'filter: grayscale(100%); opacity:0.6;' : ''}">
        </div>

        <div style="flex:1">
            <div class="name">${product.name}</div>

            <div class="flex">
                <div class="price">₹${product.price}</div>

                ${(() => {
                    let html = '';
                    if (isOut) {
                        html += `<div class="out-of-stock">Out of Stock</div>`;
                    } else {
                        if (product.Stock_qty_Status !== 'hide') {
                            html += `<div class="stock">Stock: ${product.stock}</div>`;
                        }
                        html += `
                        <div class="cart-action">
                            ${
                                qty > 0
                                    ? getStepper(qty)
                                    : `<button class="add-cart">ADD</button>`
                            }
                        </div>
                        `;
                    }
                    return html;
                })()}
            </div>
        </div>
    `;

    attachCartLogic(card, product);
    return card;
}

// ================= FIND CARD BY ID =================
function findCardById(productId) {
    return document.querySelector(`.box[data-product-id="${productId}"]`);
}

    // ================= REALTIME STOCK UPDATE - NO REFRESH EVER =================
    async function updateStockDisplay(payload) {
        const eventType = payload.eventType;
        const productId = payload.new?.id || payload.old?.id;

        if (!productId) return;

        const card = findCardById(productId);

        switch (eventType) {
            case 'INSERT':
                // Add new product card (position approximate)
                const { data: newProduct } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', productId)
                    .single();
                
                if (newProduct && newProduct.Status !== 'disabled') {
                    const container = document.getElementById('menuContainer');
                    container.appendChild(createProductCard(newProduct));
                }
                break;

            case 'UPDATE':
                if (payload.new && payload.new.Status !== 'disabled') {
                    if (card) {
                        updateCardStock(card, payload.new);
                    } else {
                        const container = document.getElementById('menuContainer');
                        container.appendChild(createProductCard(payload.new));
                    }
                } else if (card) {
                    card.remove();
                }
                break;

            case 'DELETE':
                if (card) {
                    card.remove();
                }
                break;
        }
    }

// ================= UPDATE SINGLE CARD STOCK =================
function updateCardStock(card, product) {
    const isOut = product.stock <= 0;
    
    // Toggle out-stock class
    if (isOut) {
        card.classList.add('out-stock');
    } else {
        card.classList.remove('out-stock');
    }

    // Update stock display
    let stockHtml = '';
    if (!isOut && product.Stock_qty_Status !== 'hide') {
        stockHtml = `<div class="stock">Stock: ${product.stock}</div>`;
    }

    // Update price/stock area (keep cart-action unchanged)
    const flexDiv = card.querySelector('.flex');
    if (flexDiv) {
        const priceDiv = flexDiv.querySelector('.price');
        const currentStock = flexDiv.querySelector('.stock');
        const outStock = flexDiv.querySelector('.out-of-stock');
        const cartAction = flexDiv.querySelector('.cart-action');

        // Clear stock/out-stock
        if (currentStock) currentStock.remove();
        if (outStock) outStock.remove();

        // Insert new stock/out-stock before cart-action
        if (stockHtml) {
            const stockDiv = document.createElement('div');
            stockDiv.className = 'stock';
            stockDiv.innerHTML = stockHtml;
            flexDiv.insertBefore(stockDiv, cartAction);
        } else if (isOut) {
            const outDiv = document.createElement('div');
            outDiv.className = 'out-of-stock';
            outDiv.textContent = 'Out of Stock';
            flexDiv.insertBefore(outDiv, cartAction);
        }

        // Update price if changed (rare)
        if (priceDiv) {
            priceDiv.textContent = `₹${product.price}`;
        }
    }
}

// ================= LOAD CATEGORIES =================
async function loadCategories() {
  const tabsContainer = document.getElementById('categoryTabs');
  if (!tabsContainer) return;

  const { data: products, error } = await supabase
    .from('products')
    .select('category')
    .neq('Status', 'disabled')
    .order('category');

  if (error) {
    console.error('Categories load error:', error);
    return;
  }

  // Client-side unique categories (trimmed)
  const categories = [...new Set(products.map(p => p.category ? p.category.trim() : null).filter(Boolean))].sort();

  tabsContainer.innerHTML = '';

  // All tab
  const allTab = document.createElement('span');
  allTab.className = 'tab';
  allTab.textContent = 'ALL';
  allTab.dataset.cat = '';
  allTab.addEventListener('click', () => setFilter(''));
  tabsContainer.appendChild(allTab);

  // Category tabs
  categories.forEach(cat => {
    const tab = document.createElement('span');
    tab.className = 'tab';
    tab.textContent = cat.toUpperCase();
    tab.dataset.cat = cat;
    tab.addEventListener('click', () => setFilter(cat));
    tabsContainer.appendChild(tab);
  });

  // Set initial active
  setActiveTab(currentFilter || '');
}

function setFilter(cat) {
  currentFilter = cat;
  loadMenu(currentFilter);
  history.pushState({}, '', cat ? `?category=${encodeURIComponent(cat)}` : window.location.pathname);
  setActiveTab(cat);
}

function setActiveTab(cat) {
  document.querySelectorAll('.category-tabs .tab').forEach(tab => tab.classList.remove('active'));
  const activeTab = document.querySelector(`.category-tabs .tab[data-cat="${cat}"]`) || document.querySelector('.category-tabs .tab[data-cat=""]');
  if (activeTab) activeTab.classList.add('active');
}

// ================= LOAD MENU (INITIAL FULL LOAD + REORDER) =================
async function loadMenu(filter = null) {
  const container = document.getElementById("menuContainer");
  container.innerHTML = "";

  let query = supabase
    .from("products")
    .select("*")
    .neq("Status", "disabled")
    .order('name');

  if (filter) {
    query = query.eq("category", filter);
  }

  const { data: products, error } = await query;
  if (error) {
    console.error('Menu load error:', error);
    return;
  }

  if (!products || products.length === 0) {
    const noItems = document.createElement("div");
    noItems.style.textAlign = "center";
    noItems.style.padding = "2rem";
    noItems.style.fontSize = "1.2rem";
    noItems.textContent = filter ? `No items in "${filter.toUpperCase()}" category.` : 'No products available.';
    container.appendChild(noItems);
    return;
  }

  // Separate in-stock vs out-of-stock
  const inStock = products.filter(p => p.stock > 0);
  const outStock = products.filter(p => p.stock <= 0);

  if (filter) {
    // Single category view
    const header = document.createElement("div");
    header.className = "category-header";
    header.textContent = filter.toUpperCase();
    container.appendChild(header);

    inStock.forEach(product => {
      container.appendChild(createProductCard(product));
    });

    if (outStock.length > 0) {
      const outHeader = document.createElement("div");
      outHeader.className = "category-header out-of-stock-header";
      outHeader.textContent = "OUT OF STOCK";
      container.appendChild(outHeader);

      outStock.forEach(product => {
        container.appendChild(createProductCard(product));
      });
    }
  } else {
    // All categories grouped - unique headers
    const categorySet = new Set();
    inStock.forEach(p => {
      if (p.category) categorySet.add(p.category.trim());
    });
    const uniqueCategories = Array.from(categorySet).sort();

    const groupedInStock = {};
    inStock.forEach(p => {
      if (p.category) {
        const catKey = p.category.trim();
        if (!groupedInStock[catKey]) groupedInStock[catKey] = [];
        groupedInStock[catKey].push(p);
      }
    });

    // Render unique category groups
    uniqueCategories.forEach(category => {
      const header = document.createElement("div");
      header.className = "category-header";
      header.textContent = category.toUpperCase();
      container.appendChild(header);

      groupedInStock[category].forEach(product => {
        const card = createProductCard(product);
        header.parentNode.insertBefore(card, header.nextSibling);
      });
    });

    // Out of stock section
    if (outStock.length > 0) {
      const outHeader = document.createElement("div");
      outHeader.className = "category-header out-of-stock-header";
      outHeader.textContent = "OUT OF STOCK";
      container.appendChild(outHeader);

      outStock.forEach(product => {
        const card = createProductCard(product);
        outHeader.parentNode.insertBefore(card, outHeader.nextSibling);
      });
    }
  }
}

// ================= CART EVENTS =================
function attachCartLogic(card, product) {

    const actionBox = card.querySelector(".cart-action");
    if (!actionBox) return;

    actionBox.addEventListener("click", async (e) => {
        e.preventDefault();

        let currentQty = cartData[product.id] || 0;
        let actionType = "";

        if (e.target.classList.contains("add-cart")) {
            currentQty = 1;
            actionType = "add";
        }

        if (e.target.dataset.type === "inc") {
            currentQty++;
            actionType = "inc";
        }

        if (e.target.dataset.type === "dec") {
            currentQty--;
            actionType = "dec";
        }

        if (currentQty <= 0) {
            delete cartData[product.id];
            actionBox.innerHTML = `<button class="add-cart">ADD</button>`;
        } else {
            cartData[product.id] = currentQty;
            actionBox.innerHTML = getStepper(currentQty);
        }

        await updateCartDB();
        await updateHeaderFromDB();
        showCartBar();

        // TOAST
        if (actionType === "add" || actionType === "inc") {
            showToast(`${product.name} added`);
        }
        else if (actionType === "dec" && currentQty > 0) {
            showToast(`${product.name} updated`);
        }
        else if (currentQty <= 0) {
            showToast(`${product.name} removed`);
        }
    });
}

// ================= STEPPER =================
function getStepper(qty) {
    return `
        <div class="qty-box">
            <button class="qty-btn" data-type="dec">-</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" data-type="inc">+</button>
        </div>
    `;
}

