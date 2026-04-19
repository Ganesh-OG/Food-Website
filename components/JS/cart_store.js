const GUEST_CART_KEY = "guestCart";

export function getCurrentUser() {
    return JSON.parse(localStorage.getItem("user"));
}

export function getGuestCart() {
    try {
        return JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || {};
    } catch {
        return {};
    }
}

export function setGuestCart(cartItems) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems || {}));
}

export function clearGuestCart() {
    localStorage.removeItem(GUEST_CART_KEY);
}

export function getCartCount(cartItems = {}) {
    return Object.values(cartItems).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

export async function loadStoredCart(supabase) {
    const user = getCurrentUser();

    if (!user?.email) {
        return getGuestCart();
    }

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

    return data?.cart_items || {};
}

export async function saveStoredCart(supabase, cartItems) {
    const user = getCurrentUser();

    if (!user?.email) {
        setGuestCart(cartItems);
        return { error: null };
    }

    return supabase
        .from("cart")
        .upsert({
            user_email: user.email,
            cart_items: cartItems
        });
}

export async function mergeGuestCartIntoUserCart(supabase, user) {
    const guestCart = getGuestCart();

    if (!user?.email || Object.keys(guestCart).length === 0) {
        return;
    }

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

    const mergedCart = { ...(data?.cart_items || {}) };

    Object.entries(guestCart).forEach(([productId, qty]) => {
        mergedCart[productId] = (mergedCart[productId] || 0) + Number(qty || 0);
    });

    await supabase
        .from("cart")
        .upsert({
            user_email: user.email,
            cart_items: mergedCart
        });

    clearGuestCart();
}
