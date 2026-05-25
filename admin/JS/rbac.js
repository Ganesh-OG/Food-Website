import { supabase } from "../../components/JS/config.js";

let isRBACLoaded = false;
let realtimeSubscribed = false;

function normalizeKeyArray(value) {
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

function splitUserPowerOverrides(additionalEntries = [], rolePowerData = []) {
    const additionalKeys = [];
    const removedRoleKeys = [];
    const rolePowerByKey = new Map(
        (rolePowerData || []).map(item => [String(item.key || "").trim().toLowerCase(), String(item.key || "").trim()])
    );
    const rolePowerByCode = new Map(
        (rolePowerData || []).map(item => [String(item.code || "").trim().toLowerCase(), String(item.key || "").trim()])
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

export async function loadPowers(forceReload = false) {

    if (isRBACLoaded && !forceReload) {
        console.log("⚡ RBAC cached");
        return JSON.parse(localStorage.getItem("powers")) || [];
    }

    isRBACLoaded = true;

    console.log("🔄 RBAC: Loading...");

    try {

        const storedUser = JSON.parse(localStorage.getItem("user"));

        if (!storedUser?.id) {
            console.warn("⚠️ No stored user");
            return [];
        }

        const { data: user, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", storedUser.id)
            .single();

        if (userError || !user) {
            console.error("❌ User fetch failed:", userError);
            return [];
        }

        const { data: roleData, error: roleError } = await supabase
            .from("roles")
            .select("role_name, role_powers")
            .ilike("role_name", user.role)
            .single();

        if (roleError || !roleData) {
            console.error("❌ Role fetch error:", roleError);
            return [];
        }

        let roleKeys = normalizeKeyArray(roleData.role_powers);

        const rawUserKeys = normalizeKeyArray(user.additional_Powers);
        const storedRemovedRoleKeys = normalizeKeyArray(user.removed_role_powers);

        const { data: rolePowerData } = await supabase
            .from("powers")
            .select("key, code")
            .in("key", roleKeys);

        const legacyOverrides = splitUserPowerOverrides(rawUserKeys, rolePowerData || []);
        const removedRoleKeys = Array.from(new Set([...storedRemovedRoleKeys, ...legacyOverrides.removedRoleKeys]));
        roleKeys = roleKeys.filter(key => !removedRoleKeys.includes(key));

        const roleCodes = (rolePowerData || [])
            .filter(power => roleKeys.includes(String(power.key || "").trim()))
            .map(power => power.code) || [];

        const userPowerData = legacyOverrides.additionalKeys.length
            ? (await supabase
                .from("powers")
                .select("key, code")
                .in("key", legacyOverrides.additionalKeys)).data
            : [];

        const additionalCodes = userPowerData?.map(p => p.code) || [];

        const finalPowers = [...new Set([...roleCodes, ...additionalCodes])];

        localStorage.setItem("powers", JSON.stringify(finalPowers));

        console.log("===== RBAC =====");
        console.log("User ID:", user.id);
        console.log("Role:", roleData.role_name);
        console.log("role_Powers:", roleKeys);
        console.log("additional_Powers:", legacyOverrides.additionalKeys);
        console.log("removed_role_powers:", removedRoleKeys);
        console.log("final_Powers:", finalPowers);
        console.log("================");

        if (!realtimeSubscribed && supabase) {

            realtimeSubscribed = true;

            supabase
                .channel("rbac-live")
                .on("postgres_changes", { event: "*", schema: "public", table: "roles" }, () => loadPowers(true))
                .on("postgres_changes", { event: "*", schema: "public", table: "powers" }, () => loadPowers(true))
                .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (payload) => {
                    if (payload.new?.id === user.id) loadPowers(true);
                })
                .subscribe();
        }

        return finalPowers;

    } catch (err) {
        console.error("❌ RBAC Error:", err);
        return [];
    }
}
