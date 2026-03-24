// components/JS/db.js

import { supabase } from "./config.js"; // ✅ same folder import

const BUCKET = "Food-Website-Storage";


// ================= DATABASE =================

export async function getData(table) {
    const { data, error } = await supabase.from(table).select("*");

    if (error) {
        console.error("GET ERROR:", error);
        return null;
    }

    return data;
}

export async function insertData(table, payload) {
    const { data, error } = await supabase.from(table).insert([payload]);

    if (error) {
        console.error("INSERT ERROR:", error);
        return null;
    }

    return data;
}

export async function updateData(table, id, payload) {
    const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq("id", id);

    if (error) {
        console.error("UPDATE ERROR:", error);
        return null;
    }

    return data;
}

export async function deleteData(table, id) {
    const { data, error } = await supabase
        .from(table)
        .delete()
        .eq("id", id);

    if (error) {
        console.error("DELETE ERROR:", error);
        return null;
    }

    return data;
}


// ================= STORAGE =================

export async function uploadFile(path, file) {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: true
        });

    if (error) {
        console.error("UPLOAD ERROR:", error);
        return null;
    }

    return data;
}

export function getFileUrl(path) {
    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

    return data.publicUrl;
}

export async function deleteFile(path) {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .remove([path]);

    if (error) {
        console.error("DELETE FILE ERROR:", error);
        return null;
    }

    return data;
}