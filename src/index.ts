/* global webflow */
type AnyEl = any;

// Pin auf eine feste Version (kein 2.0.x Wildcard!)
const UMD_SRC = "https://cdn.trustcomponent.com/trustcaptcha/2.0.1/trustcaptcha.umd.min.js";
const PLACEHOLDER_STYLE_ID = "tc-designer-placeholder-css";

/** --------------------------- helpers --------------------------- */
function byId<T = HTMLElement>(id: string): T {
    return document.getElementById(id) as unknown as T;
}
function hasChildren(el: AnyEl): el is AnyEl {
    return !!el && !!el.children && typeof el.append === "function";
}
function hasBeforeAfter(el: AnyEl): el is AnyEl {
    return !!el && (typeof el.before === "function" || typeof el.after === "function");
}
function isDomElement(el: AnyEl): boolean {
    return el?.type === "DOM";
}
async function getTagOf(el: AnyEl): Promise<string | null> {
    if (!el || typeof el.getTag !== "function") return null;
    try { return await el.getTag(); } catch { return null; }
}

/** Small async attr helpers (Webflow API setters may be async on live elements) */
async function setAttr(el: AnyEl, name: string, value: string): Promise<void> {
    const r = el?.setAttribute?.(name, value);
    if (r && typeof r.then === "function") await r;
}
async function removeAttr(el: AnyEl, name: string): Promise<void> {
    const r = el?.removeAttribute?.(name);
    if (r && typeof r.then === "function") await r;
}
async function getAttr(el: AnyEl, name: string): Promise<string | null> {
    return (await el?.getAttribute?.(name)) as string | null;
}
async function hasAttr(el: AnyEl, name: string): Promise<boolean> {
    return (await el?.getAttribute?.(name)) != null;
}

/** --------------------------- UI model -------------------------- */
type Cfg = {
    sitekey: string;
    license: string | null;
    language: string;
    theme: string;
    width: string;
    mode: string;
    autostart: boolean;
    hideBranding: boolean;
    invisible: boolean;
    invisibleHint: string;
    privacyUrl: string | null;
    bypassToken: string | null;
    tokenFieldName: string | null;
    customTranslations: string | null;
    customDesign: string | null;
};

// If not null, we’re editing this instance (Update flow)
let editingEl: AnyEl | null = null;

/** ---------------------- read/write UI -------------------------- */
function readUI(): Cfg {
    const read = (id: string) =>
        (byId<HTMLInputElement | HTMLSelectElement>(id).value || "").trim();
    const nonEmpty = (s: string) => (s && s.length ? s : null);

    const tokenFieldName = read("tokenFieldName") || "tc-verification-token";

    return {
        license: nonEmpty(read("license")),
        sitekey: read("sitekey"),
        language: read("language"),
        theme: read("theme"),
        width: read("width"),
        mode: read("mode"),

        autostart: read("autostart") === "true",
        hideBranding: read("hideBranding") === "true",
        invisible: read("invisible") === "true",

        invisibleHint: read("invisibleHint"),
        privacyUrl: nonEmpty(read("privacyUrl")),
        bypassToken: nonEmpty(read("bypassToken")),
        tokenFieldName: nonEmpty(tokenFieldName),
        customTranslations: nonEmpty(read("customTranslations")),
        customDesign: nonEmpty(read("customDesign")),
    };
}

function setSelectValue(id: string, value: string | null | undefined) {
    const sel = byId<HTMLSelectElement>(id);
    if (!sel || value == null) return;
    const has = Array.from(sel.options).some((o) => o.value === value);
    (sel as any).value = has ? value : sel.value;
}
function writeUI(cfg: Partial<Cfg>) {
    function set(id: string, val: string | null | undefined) {
        if (val == null) return;
        const el = byId<HTMLInputElement | HTMLTextAreaElement>(id);
        if (el) (el as any).value = val;
    }

    set("license", cfg.license ?? "");
    set("sitekey", cfg.sitekey ?? "");
    setSelectValue("language", cfg.language);
    setSelectValue("theme", cfg.theme);
    setSelectValue("width", cfg.width);
    setSelectValue("mode", cfg.mode);

    setSelectValue("autostart", (cfg.autostart ?? true) ? "true" : "false");
    setSelectValue("hideBranding", (cfg.hideBranding ?? false) ? "true" : "false");
    setSelectValue("invisible", (cfg.invisible ?? false) ? "true" : "false");

    setSelectValue("invisibleHint", cfg.invisibleHint ?? "right-border");
    set("privacyUrl", cfg.privacyUrl ?? "");
    set("bypassToken", cfg.bypassToken ?? "");
    set("tokenFieldName", cfg.tokenFieldName ?? "tc-verification-token");
    set("customTranslations", cfg.customTranslations ?? "");
    set("customDesign", cfg.customDesign ?? "");
}

/** --------------- JSON quick validation (gentle) ---------------- */
function isValidJsonString(s: string | null | undefined): boolean {
    if (!s) return true; // empty is fine
    try { JSON.parse(s); return true; } catch { return false; }
}

/** ---------------- ensure UMD + placeholder --------------------- */
async function ensureUMDScriptOnPage(): Promise<void> {
    const all = (await webflow.getAllElements()) as AnyEl[];
    for (const el of all) {
        if (isDomElement(el) && typeof el.getTag === "function") {
            const tag = await el.getTag();
            if (tag === "script") {
                const src = await el.getAttribute?.("src");
                if (src === UMD_SRC) return; // already present
            }
        }
    }
    const scriptBuilder = webflow.elementBuilder(webflow.elementPresets.DOM);
    scriptBuilder.setTag("script");
    scriptBuilder.setAttribute("src", UMD_SRC);

    const selected = (await webflow.getSelectedElement()) as AnyEl | null;
    const parent =
        (selected && hasChildren(selected) ? selected : null) ||
        all.find((e) => hasChildren(e));
    if (parent && hasChildren(parent)) {
        await parent.append(scriptBuilder);
    }
}

async function ensureDesignerPlaceholderStylesOnPage(): Promise<void> {
    const all = (await webflow.getAllElements()) as AnyEl[];
    for (const el of all) {
        if (isDomElement(el) && typeof el.getTag === "function") {
            const tag = await el.getTag();
            if (tag === "style") {
                const id = await el.getAttribute?.("id");
                if (id === PLACEHOLDER_STYLE_ID) return;
            }
        }
    }
    const css = `
trustcaptcha-component:not(:defined){
  display:block; min-height:64px; box-sizing:border-box; padding:10px 12px;
  border:1px dashed #d1d5db; border-radius:8px; background:#f6f8fa; color:#374151; position:relative;
}
trustcaptcha-component:not(:defined)::before{
  content:"TrustCaptcha placeholder — real widget renders on published site";
  font:600 12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
}
`;
    const styleBuilder = webflow.elementBuilder(webflow.elementPresets.DOM);
    styleBuilder.setTag("style");
    styleBuilder.setAttribute("id", PLACEHOLDER_STYLE_ID);
    (styleBuilder as any).setTextContent?.(css) ??
    (styleBuilder as any).setInnerText?.(css) ??
    (styleBuilder as any).setText?.(css);

    const selected = (await webflow.getSelectedElement()) as AnyEl | null;
    const parent =
        (selected && hasChildren(selected) ? selected : null) ||
        all.find((e) => hasChildren(e));
    if (parent && hasChildren(parent)) await parent.append(styleBuilder);
}

/** ---------------- find form / captcha ------------------------- */
async function resolveFormForm(selected: AnyEl): Promise<AnyEl | null> {
    if (!selected) return null;
    if (selected.type === "FormForm") return selected;
    if (selected.type === "FormWrapper" && typeof selected.getChildren === "function") {
        const children = await selected.getChildren();
        const form = children.find((c: AnyEl) => c.type === "FormForm");
        if (form) return form;
    }
    if (typeof selected.getParent === "function") {
        const parent = await selected.getParent();
        if (parent) return resolveFormForm(parent);
    }
    return null;
}

async function findCaptchaNearSelection(): Promise<AnyEl | null> {
    const sel = (await webflow.getSelectedElement()) as AnyEl | null;
    if (!sel) return null;
    if (isDomElement(sel) && (await getTagOf(sel)) === "trustcaptcha-component") return sel;
    const form = await resolveFormForm(sel);
    if (form?.getChildren) {
        const kids = await form.getChildren();
        for (const k of kids) {
            if (isDomElement(k) && (await getTagOf(k)) === "trustcaptcha-component") return k;
        }
    }
    return null;
}

/** -------- attribute helpers ----------------------------------- */
// autostart muss immer explizit stehen
async function setAutostartAttr(el: AnyEl, val: boolean) {
    await setAttr(el, "autostart", val ? "true" : "false");
}
async function readAutostartAttr(el: AnyEl): Promise<boolean> {
    const raw = (await getAttr(el, "autostart"));
    if (raw == null) return true; // Default = true
    const v = String(raw).trim().toLowerCase();
    return v !== "false";
}

// Präsenz-Attribute: true → setzen ("true"), false → entfernen
async function setPresenceTrueRemoveFalse(el: AnyEl, name: string, val: boolean) {
    if (val) await setAttr(el, name, "true");
    else await removeAttr(el, name);
}

/** ---------------- apply/read element attributes --------------- */
async function applyCfgToElement(el: AnyEl, cfg: Cfg): Promise<void> {
    await setAttr(el, "sitekey", cfg.sitekey);

    if (cfg.license) await setAttr(el, "license", cfg.license);
    else await removeAttr(el, "license");

    await setAttr(el, "language", cfg.language);
    await setAttr(el, "theme", cfg.theme);
    await setAttr(el, "width", cfg.width);
    await setAttr(el, "mode", cfg.mode);

    // explizit (immer)
    await setAutostartAttr(el, cfg.autostart);

    // Präsenz
    await setPresenceTrueRemoveFalse(el, "hide-branding", cfg.hideBranding);
    await setPresenceTrueRemoveFalse(el, "invisible", cfg.invisible);

    await setAttr(el, "invisible-hint", cfg.invisibleHint);

    if (cfg.privacyUrl) await setAttr(el, "privacy-url", cfg.privacyUrl);
    else await removeAttr(el, "privacy-url");

    if (cfg.bypassToken) await setAttr(el, "bypass-token", cfg.bypassToken);
    else await removeAttr(el, "bypass-token");

    if (cfg.tokenFieldName) await setAttr(el, "token-field-name", cfg.tokenFieldName);
    else await removeAttr(el, "token-field-name");

    if (cfg.customTranslations) await setAttr(el, "custom-translations", cfg.customTranslations);
    else await removeAttr(el, "custom-translations");

    if (cfg.customDesign) await setAttr(el, "custom-design", cfg.customDesign);
    else await removeAttr(el, "custom-design");
}

async function readCfgFromElement(el: AnyEl): Promise<Cfg> {
    return {
        sitekey: (await getAttr(el, "sitekey")) || "",
        license: (await getAttr(el, "license")) || null,
        language: (await getAttr(el, "language")) || "auto",
        theme: (await getAttr(el, "theme")) || "light",
        width: (await getAttr(el, "width")) || "fixed",
        mode: (await getAttr(el, "mode")) || "standard",

        autostart: await readAutostartAttr(el),
        hideBranding: await hasAttr(el, "hide-branding"),
        invisible: await hasAttr(el, "invisible"),

        invisibleHint: (await getAttr(el, "invisible-hint")) || "right-border",
        privacyUrl: (await getAttr(el, "privacy-url")) || null,
        bypassToken: (await getAttr(el, "bypass-token")) || null,
        tokenFieldName: (await getAttr(el, "token-field-name")) || "tc-verification-token",
        customTranslations: (await getAttr(el, "custom-translations")) || null,
        customDesign: (await getAttr(el, "custom-design")) || null,
    };
}

/** ---------------- primary action (Insert/Update) -------------- */
async function onPrimaryAction(e: Event) {
    e.preventDefault();

    await ensureDesignerPlaceholderStylesOnPage();
    await ensureUMDScriptOnPage();

    const cfg = readUI();
    if (!cfg.sitekey) {
        await webflow.notify({ type: "Error", message: "Please provide a Sitekey." });
        return;
    }

    // Sanfte JSON-Validierung
    if (!isValidJsonString(cfg.customTranslations)) {
        await webflow.notify({ type: "Error", message: "Custom translations: invalid JSON." });
        return;
    }
    if (!isValidJsonString(cfg.customDesign)) {
        await webflow.notify({ type: "Error", message: "Custom design: invalid JSON." });
        return;
    }

    // UPDATE existing
    if (editingEl) {
        await applyCfgToElement(editingEl, cfg);
        await webflow.notify({ type: "Success", message: "Updated selected TrustCaptcha instance." });
        return;
    }

    // INSERT new
    const selected = (await webflow.getSelectedElement()) as AnyEl | null;
    if (!selected) {
        await webflow.notify({
            type: "Error",
            message: "Select a Form (or a child inside it) in the Designer first.",
        });
        return;
    }
    const formForm = await resolveFormForm(selected);
    if (!formForm) {
        await webflow.notify({
            type: "Error",
            message: "No Webflow Form found from current selection.",
        });
        return;
    }

    // Find submit button to insert before
    let submitBtn: AnyEl | null = null;
    if (formForm?.children && typeof formForm.getChildren === "function") {
        const kids = await formForm.getChildren();
        submitBtn = kids.find((k: AnyEl) => k.type === "FormButton") || null;
    }

    const tc = webflow.elementBuilder(webflow.elementPresets.DOM);
    tc.setTag("trustcaptcha-component");
    await applyCfgToElement(tc, cfg);

    if (submitBtn && hasBeforeAfter(submitBtn) && typeof submitBtn.before === "function") {
        await submitBtn.before(tc);
    } else if (hasChildren(formForm)) {
        await formForm.append(tc);
    } else {
        await webflow.notify({ type: "Error", message: "Couldn't insert element (no suitable parent)." });
        return;
    }

    await webflow.notify({ type: "Success", message: "TrustCaptcha inserted in the selected Form." });
}

/** ---------------- update flow: load selection ----------------- */
async function loadSelectedThenEdit() {
    const inst = await findCaptchaNearSelection();
    if (!inst) {
        await webflow.notify({
            type: "Error",
            message: "No TrustCaptcha instance found near selection.",
        });
        return;
    }
    editingEl = inst;
    const cfg = await readCfgFromElement(inst);
    writeUI(cfg);
    showTab("insert");
    syncPrimaryButton();
    await webflow.notify({ type: "Success", message: "Loaded selected Captcha into editor." });
}

/** ---------------- tabs & button label ------------------------- */
function showTab(id: "insert" | "update") {
    const ids = ["insert", "update"];
    for (const key of ids) {
        byId<HTMLElement>(`view-${key}`).classList.toggle("hidden", key !== id);
        byId<HTMLButtonElement>(`tab-${key}`).classList.toggle("active", key === id);
    }
}
function syncPrimaryButton() {
    const btn = byId<HTMLButtonElement>("primaryAction");
    btn.textContent = editingEl ? "Update selected Captcha" : "Insert into selected form";
}

/** ---------------- wire ------------------------- */
function wireUI() {
    (async () => {
        try { await webflow.setExtensionSize({ width: 720, height: 640 }); } catch { /* noop */ }
    })();

    // Insert-Tab: explizit Edit-Mode beenden
    byId<HTMLButtonElement>("tab-insert").onclick = () => {
        editingEl = null;
        syncPrimaryButton();
        showTab("insert");
    };
    byId<HTMLButtonElement>("tab-update").onclick = () => showTab("update");

    const form = byId<HTMLFormElement>("tc-form");
    if (form) form.onsubmit = (e) => { void onPrimaryAction(e); };

    byId<HTMLButtonElement>("loadSelected").onclick = () => { void loadSelectedThenEdit(); };

    void ensureDesignerPlaceholderStylesOnPage();
    void ensureUMDScriptOnPage();
    syncPrimaryButton();

    // UI-Defaults beim ersten Öffnen
    writeUI({
        autostart: true,
        hideBranding: false,
        invisible: false,
        language: "auto",
        theme: "light",
        width: "fixed",
        mode: "standard",
        invisibleHint: "right-border",
        tokenFieldName: "tc-verification-token",
    });
}

document.addEventListener("DOMContentLoaded", wireUI);
