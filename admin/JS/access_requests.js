import { supabase } from "../../components/JS/config.js";

export function normalizeKeyArray(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item || "").trim()).filter(Boolean);
    }

    if (typeof value === "string") {
        const raw = value.trim();
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(item => String(item || "").trim()).filter(Boolean);
            }
        } catch {
            return raw
                .split(",")
                .map(item => item.replace(/[\[\]"']/g, "").trim())
                .filter(Boolean);
        }
    }

    return [];
}

export function normalizeRoleLabel(role) {
    return String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

export function humanizePowerCode(code) {
    return String(code || "")
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function getPowerKey(power) {
    return String(power?.key || power?.id || "").trim();
}

export function getPowerCode(power) {
    return String(power?.code || power?.key || "").trim().toLowerCase();
}

export function getPowerLabel(power) {
    return String(
        power?.display_name
        || power?.name
        || power?.label
        || humanizePowerCode(getPowerCode(power))
    ).trim();
}

export async function fetchRolesAndPowers() {
    const [rolesRes, powersRes] = await Promise.all([
        supabase.from("roles").select("role_name, display_name, role_powers").order("role_name"),
        supabase.from("powers").select("*").order("code")
    ]);

    return {
        roles: rolesRes.data || [],
        roleError: rolesRes.error || null,
        powers: powersRes.data || [],
        powerError: powersRes.error || null
    };
}

export async function fetchPowerCategories() {
    return supabase
        .from("powers_category")
        .select("*")
        .order("name");
}

export function findRoleDefinition(roles = [], roleName) {
    return (roles || []).find(role => normalizeRoleLabel(role?.role_name) === normalizeRoleLabel(roleName)) || null;
}

export function getRolePowerKeys(roles = [], roleName) {
    const role = findRoleDefinition(roles, roleName);
    return normalizeKeyArray(role?.role_powers);
}

export async function fetchAccessRequests({ status = null, requestedBy = null } = {}) {
    let query = supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false });

    if (status) {
        query = query.ilike("status", String(status).trim());
    }

    if (requestedBy) {
        query = query.eq("requested_by", requestedBy);
    }

    return query;
}

export async function createAccessRequest(payload) {
    return supabase
        .from("access_requests")
        .insert([payload]);
}

export async function updateAccessRequestStatus(requestId, payload) {
    return supabase
        .from("access_requests")
        .update(payload)
        .eq("id", requestId);
}

function buildLegacyRemovedPowerMarkers(removedRolePowerKeys = []) {
    return Array.from(new Set(
        (removedRolePowerKeys || [])
            .map(key => String(key || "").trim())
            .filter(Boolean)
            .map(key => {
                const match = key.match(/^power0*(\d+)$/i);
                return match ? `rm_power_${match[1]}` : `rm_power_${key}`;
            })
    ));
}

export async function applyUserAccess({
    userId,
    role,
    additionalPowerKeys,
    removedRolePowerKeys = []
}) {
    const normalizedAdditional = normalizeKeyArray(additionalPowerKeys);
    const normalizedRemovedRole = normalizeKeyArray(removedRolePowerKeys);
    const legacyRemovedMarkers = buildLegacyRemovedPowerMarkers(normalizedRemovedRole);
    const combinedAdditional = Array.from(new Set([
        ...normalizedAdditional,
        ...legacyRemovedMarkers
    ]));

    const primaryResult = await supabase
        .from("users")
        .update({
            role,
            additional_Powers: combinedAdditional,
            removed_role_powers: normalizedRemovedRole
        })
        .eq("id", userId);

    if (!primaryResult.error) {
        return primaryResult;
    }

    const message = String(primaryResult.error.message || "").toLowerCase();
    const missingRemovedRoleColumn = message.includes("removed_role_powers");

    if (!missingRemovedRoleColumn) {
        return primaryResult;
    }

    return supabase
        .from("users")
        .update({
            role,
            additional_Powers: combinedAdditional
        })
        .eq("id", userId);
}

export async function updateRolePowers(roleName, rolePowerKeys = []) {
    return supabase
        .from("roles")
        .update({
            role_powers: rolePowerKeys
        })
        .ilike("role_name", String(roleName || "").trim());
}

export async function createPowerDefinition(payload) {
    return supabase
        .from("powers")
        .insert([payload]);
}

export async function createPowerCategory(payload) {
    return supabase
        .from("powers_category")
        .insert([payload]);
}

export async function updatePowerCategory(name, payload) {
    return supabase
        .from("powers_category")
        .update(payload)
        .eq("name", String(name || "").trim());
}

export async function createAccessAuditLog(payload) {
    const result = await supabase
        .from("access_audit_log")
        .insert([payload]);

    if (!result.error) {
        return result;
    }

    const message = String(result.error.message || "").toLowerCase();
    const code = String(result.error.code || "").trim();
    const missingRelation = code === "PGRST205"
        || message.includes("could not find the table")
        || message.includes("access_audit_log");

    if (missingRelation) {
        return { data: null, error: null };
    }

    return result;
}
