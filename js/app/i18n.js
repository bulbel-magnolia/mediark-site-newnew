const STORAGE_KEY = "mediark_ui_language";
const DEFAULT_LANGUAGE = "zh-CN";

export function normalizeLanguage(language) {
  return String(language || "").toLowerCase().startsWith("en") ? "en" : DEFAULT_LANGUAGE;
}

export function getUiLanguage() {
  try {
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function setUiLanguage(language) {
  const next = normalizeLanguage(language);

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage failures and still update the document language.
  }

  document.documentElement.lang = next === "en" ? "en" : "zh-CN";
  return next;
}

export function languageToggleLabel(language) {
  return normalizeLanguage(language) === "en" ? "中文" : "English";
}

function lookup(dictionary, language, key) {
  return String(key || "")
    .split(".")
    .reduce((value, part) => (value && part in value ? value[part] : undefined), dictionary?.[language]);
}

export function createPageI18n(dictionary, options = {}) {
  const fallbackLanguage = normalizeLanguage(options.defaultLanguage || DEFAULT_LANGUAGE);
  let currentLanguage = setUiLanguage(getUiLanguage());

  function t(key, fallback = "") {
    return lookup(dictionary, currentLanguage, key)
      ?? lookup(dictionary, fallbackLanguage, key)
      ?? fallback
      ?? key;
  }

  function applyStaticTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      const value = t(node.dataset.i18n, node.textContent);
      node.textContent = value;
    });

    root.querySelectorAll("[data-i18n-html]").forEach((node) => {
      const value = t(node.dataset.i18nHtml, node.innerHTML);
      node.innerHTML = value;
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder, node.getAttribute("placeholder") || ""));
    });

    root.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.dataset.i18nTitle, node.getAttribute("title") || ""));
    });

    const titleKey = options.titleKey || "document_title";
    const titleValue = t(titleKey, "");
    if (titleValue) {
      document.title = titleValue;
    }

    const toggle = typeof options.toggle === "string"
      ? document.querySelector(options.toggle)
      : options.toggle;

    if (toggle) {
      toggle.textContent = languageToggleLabel(currentLanguage);
    }
  }

  function apply(root = document) {
    currentLanguage = setUiLanguage(currentLanguage);
    applyStaticTranslations(root);
    options.onChange?.({
      language: currentLanguage,
      t
    });
  }

  function setLanguage(language, root = document) {
    currentLanguage = setUiLanguage(language);
    apply(root);
  }

  function toggleLanguage(root = document) {
    setLanguage(currentLanguage === "en" ? DEFAULT_LANGUAGE : "en", root);
  }

  function bindToggle(root = document) {
    const toggle = typeof options.toggle === "string"
      ? root.querySelector(options.toggle)
      : options.toggle;

    if (!toggle) {
      return;
    }

    toggle.addEventListener("click", () => toggleLanguage(root));
  }

  return {
    get language() {
      return currentLanguage;
    },
    t,
    apply,
    setLanguage,
    toggleLanguage,
    bindToggle
  };
}
