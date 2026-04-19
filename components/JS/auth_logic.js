import { EMAILJS_CONFIG, supabase } from "./config.js";
import { mergeGuestCartIntoUserCart } from "./cart_store.js";

export function getPostAuthRedirect(redirectTarget, fallback = "index.html") {
    return redirectTarget || fallback;
}

export async function authenticateUser({ input, password }) {
    const loginInput = input?.trim();
    const loginPassword = password?.trim();

    if (!loginInput || !loginPassword) {
        return { ok: false, message: "Enter your email or ID and password" };
    }

    try {
        let user = null;

        let res = await supabase
            .from("users")
            .select("*")
            .ilike("email", loginInput)
            .eq("password", loginPassword)
            .maybeSingle();

        user = res.data;

        if (!user) {
            res = await supabase
                .from("users")
                .select("*")
                .ilike("id", loginInput)
                .eq("password", loginPassword)
                .maybeSingle();

            user = res.data;
        }

        if (!user) {
            return { ok: false, message: "Invalid login" };
        }

        const { data: roleData } = await supabase
            .from("roles")
            .select("role_powers")
            .eq("role_name", user.role)
            .single();

        const rolePowers = roleData?.role_powers || [];
        const userPowers = user.additional_powers || [];
        const finalPowers = user.role === "Custom Role"
            ? userPowers
            : [...new Set([...rolePowers, ...userPowers])];

        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("powers", JSON.stringify(finalPowers));

        await mergeGuestCartIntoUserCart(supabase, user);

        return { ok: true, user, powers: finalPowers };
    } catch (error) {
        console.error(error);
        return { ok: false, message: "Error occurred while signing in" };
    }
}

export async function registerExternalUser({
    name,
    email,
    dob,
    password,
    confirmPassword
}) {
    const fullName = name?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    const dateOfBirth = dob || null;
    const pass = password?.trim();
    const confirm = confirmPassword?.trim();

    if (!fullName || !normalizedEmail || !pass || !confirm) {
        return { ok: false, message: "Please fill all required fields" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { ok: false, message: "Enter a valid email address" };
    }

    if (pass.length < 6) {
        return { ok: false, message: "Password must be at least 6 characters" };
    }

    if (pass !== confirm) {
        return { ok: false, message: "Passwords do not match" };
    }

    try {
        const { data: existingUser, error: emailCheckError } = await supabase
            .from("users")
            .select("id, email, password, otp, otp_created_at")
            .ilike("email", normalizedEmail)
            .maybeSingle();

        if (emailCheckError) {
            console.error("Email check error:", emailCheckError);
            return { ok: false, message: "Unable to verify your email right now" };
        }

        if (!existingUser) {
            return { ok: false, message: "Generate and verify your OTP first" };
        }

        if (existingUser.password) {
            return { ok: false, message: "This email is already registered" };
        }

        if (existingUser.otp || existingUser.otp_created_at) {
            return { ok: false, message: "Verify your OTP first" };
        }

        const userId = existingUser.id || await generateSequentialUserId();

        const updatedUser = {
            id: userId,
            name: fullName,
            email: normalizedEmail,
            dob: dateOfBirth,
            user_type: "external",
            role: "external",
            password: pass
        };

        const { data: savedUser, error: updateError } = await supabase
            .from("users")
            .update(updatedUser)
            .eq("email", normalizedEmail)
            .select("*")
            .single();

        if (updateError) {
            console.error("Register error:", updateError);
            return { ok: false, message: updateError.message || "Unable to create account right now" };
        }

        localStorage.setItem("user", JSON.stringify(savedUser));
        localStorage.setItem("powers", JSON.stringify([]));

        await mergeGuestCartIntoUserCart(supabase, savedUser);

        return { ok: true, user: savedUser, generatedId: userId };
    } catch (error) {
        console.error("Register failed:", error);
        return { ok: false, message: "Something went wrong while registering" };
    }
}

export async function sendRegistrationOtp({ name, email, dob }) {
    const fullName = name?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    const dateOfBirth = dob || null;

    if (!fullName || !normalizedEmail) {
        return { ok: false, message: "Enter your name and email first" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { ok: false, message: "Enter a valid email address" };
    }

    const otpCreatedAt = new Date().toISOString();
    const otp = generateOtp();

    try {
        const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("id, email, password, otp")
            .ilike("email", normalizedEmail)
            .maybeSingle();

        if (existingUserError) {
            console.error("Existing user check failed:", existingUserError);
            return { ok: false, message: "Unable to verify your email right now" };
        }

        if (existingUser?.password) {
            return { ok: false, message: "This email is already registered" };
        }

        const userId = existingUser?.id || await generateSequentialUserId();
        const pendingUser = {
            id: userId,
            name: fullName,
            email: normalizedEmail,
            dob: dateOfBirth,
            otp,
            otp_created_at: otpCreatedAt
        };

        if (existingUser) {
            const { error: updateError } = await supabase
                .from("users")
                .update(pendingUser)
                .eq("email", normalizedEmail);

            if (updateError) {
                console.error("Pending registration update failed:", updateError);
                return { ok: false, message: updateError.message || "Unable to save OTP right now" };
            }
        } else {
            const { error: insertError } = await supabase
                .from("users")
                .insert([pendingUser]);

            if (insertError) {
                console.error("Pending registration insert failed:", insertError);
                return { ok: false, message: insertError.message || "Unable to save OTP right now" };
            }
        }

        const emailResult = await sendOtpEmail({
            name: fullName,
            email: normalizedEmail,
            otp
        });

        if (!emailResult.ok) {
            return emailResult;
        }

        return {
            ok: true,
            message: "OTP sent to your email"
        };
    } catch (error) {
        console.error("Send OTP failed:", error);
        return { ok: false, message: "Unable to send OTP right now" };
    }
}

export async function verifyRegistrationOtp({ email, token }) {
    return verifyOtpAgainstUsersTable({ email, token });
}

export async function sendPasswordResetOtp(email) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
        return { ok: false, message: "Enter your registered email first" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { ok: false, message: "Enter a valid email address" };
    }

    const otpCreatedAt = new Date().toISOString();
    const otp = generateOtp();

    try {
        const { data: existingUser, error } = await supabase
            .from("users")
            .select("id, email, password")
            .ilike("email", normalizedEmail)
            .maybeSingle();

        if (error) {
            console.error("Password reset email check failed:", error);
            return { ok: false, message: "Unable to verify your email right now" };
        }

        if (!existingUser || !existingUser.password) {
            return { ok: false, message: "No registered account found for this email" };
        }

        const { error: updateError } = await supabase
            .from("users")
            .update({
                otp,
                otp_created_at: otpCreatedAt
            })
            .eq("email", normalizedEmail);

        if (updateError) {
            console.error("Password reset OTP update failed:", updateError);
            return { ok: false, message: updateError.message || "Unable to save OTP right now" };
        }

        const emailResult = await sendOtpEmail({
            name: existingUser.name || "User",
            email: normalizedEmail,
            otp
        });

        if (!emailResult.ok) {
            return emailResult;
        }

        return { ok: true, message: "OTP sent to your email" };
    } catch (error) {
        console.error("Send password reset OTP failed:", error);
        return { ok: false, message: "Unable to send OTP right now" };
    }
}

export async function verifyPasswordResetOtp({ email, token }) {
    return verifyOtpAgainstUsersTable({ email, token });
}

export async function resetUserPassword({ email, password, confirmPassword }) {
    const normalizedEmail = email?.trim().toLowerCase();
    const pass = password?.trim();
    const confirm = confirmPassword?.trim();

    if (!normalizedEmail || !pass || !confirm) {
        return { ok: false, message: "Please fill all required fields" };
    }

    if (pass.length < 6) {
        return { ok: false, message: "Password must be at least 6 characters" };
    }

    if (pass !== confirm) {
        return { ok: false, message: "Passwords do not match" };
    }

    try {
        const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("email, password")
            .ilike("email", normalizedEmail)
            .maybeSingle();

        if (existingUserError) {
            console.error("Reset password email check failed:", existingUserError);
            return { ok: false, message: "Unable to verify your account right now" };
        }

        if (!existingUser) {
            return { ok: false, message: "No account found for this email" };
        }

        const { data: updatedUser, error: updateError } = await supabase
            .from("users")
            .update({
                password: pass,
                otp: null,
                otp_created_at: null,
                last_reset_by: normalizedEmail,
                last_reset_at: new Date().toISOString()
            })
            .eq("email", normalizedEmail)
            .select("*")
            .single();

        if (updateError) {
            console.error("Reset password update failed:", updateError);
            return { ok: false, message: updateError.message || "Unable to update password right now" };
        }

        const sessionUpdated = syncStoredUserAfterPasswordReset(updatedUser, normalizedEmail);

        return {
            ok: true,
            message: "Password updated successfully",
            user: updatedUser,
            sessionUpdated
        };
    } catch (error) {
        console.error("Reset password failed:", error);
        return { ok: false, message: "Unable to update password right now" };
    }
}

async function verifyOtpAgainstUsersTable({ email, token }) {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedToken = token?.trim();

    if (!normalizedEmail || !normalizedToken) {
        return { ok: false, message: "Enter the OTP sent to your email" };
    }

    try {
        const { data: pendingUser, error: fetchError } = await supabase
            .from("users")
            .select("id, otp, otp_created_at")
            .ilike("email", normalizedEmail)
            .maybeSingle();

        if (fetchError) {
            console.error("Verify OTP fetch failed:", fetchError);
            return { ok: false, message: "Unable to verify OTP right now" };
        }

        if (!pendingUser) {
            return { ok: false, message: "Generate OTP first" };
        }

        if (String(pendingUser.otp || "").toLowerCase() === "expired") {
            return { ok: false, message: "OTP expired. Generate a new OTP." };
        }

        if (!pendingUser.otp || pendingUser.otp !== normalizedToken) {
            return { ok: false, message: "Invalid OTP" };
        }

        const createdAt = pendingUser.otp_created_at ? new Date(pendingUser.otp_created_at) : null;
        const isExpired = !createdAt || (Date.now() - createdAt.getTime()) > 60 * 1000;

        if (isExpired) {
            await supabase
                .from("users")
                .update({
                    otp: "Expired"
                })
                .eq("email", normalizedEmail);

            return { ok: false, message: "OTP expired. Generate a new OTP." };
        }

        const { error: updateError } = await supabase
            .from("users")
            .update({
                otp: null,
                otp_created_at: null
            })
            .eq("email", normalizedEmail);

        if (updateError) {
            console.error("Verify OTP update failed:", updateError);
            return { ok: false, message: "OTP matched but verification could not be saved" };
        }

        return { ok: true };
    } catch (error) {
        console.error("Verify OTP failed:", error);
        return { ok: false, message: "Unable to verify OTP right now" };
    }
}

async function generateSequentialUserId() {
    const { data: rows, error } = await supabase
        .from("users")
        .select("id")
        .ilike("id", "u%");

    if (error) {
        console.error("Sequential ID fetch failed:", error);
        throw new Error("Unable to generate a user ID");
    }

    const maxNumber = (rows || []).reduce((max, row) => {
        const match = String(row.id || "").trim().match(/^u(\d+)$/i);
        if (!match) return max;

        return Math.max(max, Number(match[1]));
    }, 0);

    return `U${maxNumber + 1}`;
}

function syncStoredUserAfterPasswordReset(updatedUser, normalizedEmail) {
    try {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (!storedUser?.email) return false;

        if (String(storedUser.email).trim().toLowerCase() !== normalizedEmail) {
            return false;
        }

        localStorage.setItem("user", JSON.stringify({
            ...storedUser,
            ...updatedUser
        }));

        return true;
    } catch (error) {
        console.error("Stored session sync failed after password reset:", error);
        return false;
    }
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail({ name, email, otp }) {
    const { publicKey, serviceId, templateId } = EMAILJS_CONFIG;

    if (
        !publicKey ||
        !serviceId ||
        !templateId ||
        publicKey.includes("YOUR_") ||
        serviceId.includes("YOUR_") ||
        templateId.includes("YOUR_")
    ) {
        return {
            ok: false,
            message: "Configure EmailJS keys in components/JS/config.js"
        };
    }

    try {
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                template_params: {
                    name,
                    email,
                    otp
                }
            })
        });

        const rawText = await response.text();

        if (!response.ok) {
            console.error("EmailJS send failed:", rawText);
            return {
                ok: false,
                message: "Unable to send OTP email right now"
            };
        }

        return {
            ok: true,
            message: rawText || "OTP email sent successfully"
        };
    } catch (error) {
        console.error("EmailJS request failed:", error);
        return {
            ok: false,
            message: "Unable to send OTP email right now"
        };
    }
}
