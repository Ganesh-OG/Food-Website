import { supabase } from "./config.js";

const USER_STORAGE_KEY = "user";
const POWER_STORAGE_KEY = "powers";
const PAYMENT_STORAGE_KEY = "paymentSelected";
export const MASTER_CONTROL_POWER = "master_control";
export const MASTER_CONTROL_ALIASES = [MASTER_CONTROL_POWER, "master_controll"];

export const ADMIN_ROLE_NAMES = [
    "admin",
    "manager",
    "sales staff",
    "billing staff",
    "custom role"
];

export function normalizeRoleName(role) {
    return String(role || "").trim().toLowerCase();
}

export function isAdminRoleName(role) {
    return ADMIN_ROLE_NAMES.includes(normalizeRoleName(role));
}

export function isAdminUser(user) {
    return isAdminRoleName(user?.role);
}

export function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
    } catch {
        return null;
    }
}

export function getStoredPowers() {
    try {
        return JSON.parse(localStorage.getItem(POWER_STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

export function hasStoredPower(code, powers = getStoredPowers()) {
    const normalizedPowers = powers.map(item => String(item || "").trim().toLowerCase());
    if (hasMasterControlPower(normalizedPowers)) {
        return true;
    }
    const target = String(code || "").trim().toLowerCase();
    return normalizedPowers.includes(target);
}

export function hasAnyStoredPower(codes = [], powers = getStoredPowers()) {
    const normalizedPowers = powers.map(item => String(item || "").trim().toLowerCase());
    if (hasMasterControlPower(normalizedPowers)) {
        return true;
    }
    return codes.some(code => normalizedPowers.includes(String(code || "").trim().toLowerCase()));
}

export function canAccessAdmin(user = getStoredUser(), powers = getStoredPowers()) {
    const resolvedPowers = Array.isArray(powers) ? powers.filter(Boolean) : [];
    return Boolean(user) && (isAdminUser(user) || resolvedPowers.length > 0);
}

export function hasMasterControlPower(powers = getStoredPowers()) {
    const normalizedPowers = powers.map(item => String(item || "").trim().toLowerCase());
    return MASTER_CONTROL_ALIASES.some(code => normalizedPowers.includes(code));
}

export function clearStoredSession({ keepCart = true } = {}) {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(POWER_STORAGE_KEY);
    localStorage.removeItem(PAYMENT_STORAGE_KEY);

    if (!keepCart) {
        localStorage.removeItem("guestCart");
    }
}

export function setStoredSession(user, powers = []) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user || null));
    localStorage.setItem(
        POWER_STORAGE_KEY,
        JSON.stringify(
            Array.from(
                new Set(
                    (powers || [])
                        .map(item => String(item || "").trim().toLowerCase())
                        .filter(Boolean)
                )
            )
        )
    );
}

export function normalizeKeyArray(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        const raw = value.trim();
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(item => String(item).trim()).filter(Boolean);
            }
        } catch {
            return raw.split(",").map(item => item.replace(/[\[\]"']/g, "").trim()).filter(Boolean);
        }
    }

    return [];
}

function isLegacyRemovedPowerMarker(value) {
    return /^rm_power_/i.test(String(value || "").trim());
}

function markerTokenToCandidates(marker) {
    const rawToken = String(marker || "")
        .trim()
        .replace(/^rm_power_/i, "")
        .trim();

    if (!rawToken) return [];

    const normalized = rawToken.toLowerCase();
    const candidates = new Set([rawToken, normalized]);

    if (/^\d+$/.test(rawToken)) {
        candidates.add(`Power${rawToken.padStart(3, "0")}`);
        candidates.add(`power${rawToken.padStart(3, "0")}`);
    }

    const powerMatch = normalized.match(/^power0*(\d+)$/i);
    if (powerMatch) {
        candidates.add(`Power${powerMatch[1].padStart(3, "0")}`);
        candidates.add(`power${powerMatch[1].padStart(3, "0")}`);
    }

    return Array.from(candidates);
}

export async function fetchUserById(id) {
    if (!id) return null;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

async function fetchRolePowerKeys(role) {
    if (!role) return [];

    const { data, error } = await supabase
        .from("roles")
        .select("role_powers")
        .ilike("role_name", String(role).trim())
        .maybeSingle();

    if (error) {
        throw error;
    }

    return normalizeKeyArray(data?.role_powers);
}

async function fetchPowerRecords(powerKeys = []) {
    if (!powerKeys.length) return [];

    const { data, error } = await supabase
        .from("powers")
        .select("key, code")
        .in("key", powerKeys);

    if (error) {
        throw error;
    }

    return data || [];
}

function splitUserPowerOverrides(additionalEntries = [], rolePowerRecords = []) {
    const additionalKeys = [];
    const removedRoleKeys = [];
    const rolePowerByKey = new Map(
        (rolePowerRecords || []).map(item => [String(item.key || "").trim().toLowerCase(), String(item.key || "").trim()])
    );
    const rolePowerByCode = new Map(
        (rolePowerRecords || []).map(item => [String(item.code || "").trim().toLowerCase(), String(item.key || "").trim()])
    );

    (additionalEntries || []).forEach(entry => {
        const rawEntry = String(entry || "").trim();
        if (!rawEntry) return;

        if (!isLegacyRemovedPowerMarker(rawEntry)) {
            additionalKeys.push(rawEntry);
            return;
        }

        const resolvedKey = markerTokenToCandidates(rawEntry)
            .map(candidate => rolePowerByKey.get(String(candidate || "").trim().toLowerCase())
                || rolePowerByCode.get(String(candidate || "").trim().toLowerCase()))
            .find(Boolean);

        if (resolvedKey) {
            removedRoleKeys.push(resolvedKey);
        }
    });

    return {
        additionalKeys: Array.from(new Set(additionalKeys)),
        removedRoleKeys: Array.from(new Set(removedRoleKeys))
    };
}

async function fetchPowerCodes(powerKeys = []) {
    return (await fetchPowerRecords(powerKeys))
        .map(item => String(item.code || "").trim().toLowerCase())
        .filter(Boolean);
}

export async function resolveUserPowers(user) {
    if (!user) return [];

    const roleKeys = await fetchRolePowerKeys(user.role);
    const rolePowerRecords = await fetchPowerRecords(roleKeys);
    const rawAdditionalKeys = normalizeKeyArray(user.additional_Powers ?? user.additional_powers);
    const storedRemovedRoleKeys = normalizeKeyArray(user.removed_role_powers ?? user.removedRolePowers);
    const legacyOverrides = splitUserPowerOverrides(rawAdditionalKeys, rolePowerRecords);
    const removedRoleKeys = Array.from(new Set([...storedRemovedRoleKeys, ...legacyOverrides.removedRoleKeys]));
    const filteredRoleKeys = roleKeys.filter(key => !removedRoleKeys.includes(key));
    const mergedKeys = Array.from(new Set([...filteredRoleKeys, ...legacyOverrides.additionalKeys]));
    return fetchPowerCodes(mergedKeys);
}

export async function initializeUserSession(user) {
    const powers = await resolveUserPowers(user);
    setStoredSession(user, powers);
    return { user, powers };
}

export async function refreshStoredSession() {
    const storedUser = getStoredUser();

    if (!storedUser?.id) {
        clearStoredSession();
        return { user: null, powers: [] };
    }

    try {
        const liveUser = await fetchUserById(storedUser.id);

        if (!liveUser) {
            clearStoredSession();
            return { user: null, powers: [] };
        }

        const powers = await resolveUserPowers(liveUser);
        setStoredSession(liveUser, powers);
        return { user: liveUser, powers };
    } catch (error) {
        console.error("Session refresh failed:", error);
        return {
            user: storedUser,
            powers: getStoredPowers()
        };
    }
}
