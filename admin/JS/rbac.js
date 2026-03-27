import { supabase } from "../../components/JS/config.js";

let isRBACLoaded = false;
let realtimeSubscribed = false;

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

        let roleKeys = roleData.role_powers;

        if (!Array.isArray(roleKeys)) {
            try {
                roleKeys = JSON.parse(roleKeys);
            } catch {
                roleKeys = [];
            }
        }

        let userKeys = user.additional_Powers;

        if (!userKeys) {
            userKeys = [];
        } else if (!Array.isArray(userKeys)) {
            try {
                userKeys = JSON.parse(userKeys);
            } catch {
                userKeys = [];
            }
        }

        const { data: rolePowerData } = await supabase
            .from("powers")
            .select("key, code")
            .in("key", roleKeys);

        const roleCodes = rolePowerData?.map(p => p.code) || [];

        const { data: userPowerData } = await supabase
            .from("powers")
            .select("key, code")
            .in("key", userKeys);

        const additionalCodes = userPowerData?.map(p => p.code) || [];

        const finalPowers = [...new Set([...roleCodes, ...additionalCodes])];

        localStorage.setItem("powers", JSON.stringify(finalPowers));

        console.log("===== RBAC =====");
        console.log("User ID:", user.id);
        console.log("Role:", roleData.role_name);
        console.log("role_Powers:", roleKeys);
        console.log("additional_Powers:", userKeys);
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