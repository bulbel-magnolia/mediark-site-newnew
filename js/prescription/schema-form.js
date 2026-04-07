function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function setByPath(target, path, value) {
  const parts = path.split(".");
  let cursor = target;

  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }

    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  });
}

function renderField(field, initialValue) {
  const inputId = `field-${field.id}`;
  const value = initialValue ?? "";

  if (field.type === "select") {
    const options = (field.options || []).map((option) => `
      <option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>
    `).join("");

    return `
      <div class="field">
        <label for="${inputId}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
        <select id="${inputId}" data-bind="${field.bind}" ${field.required ? "required" : ""}>
          ${options}
        </select>
      </div>
    `;
  }

  if (field.type === "textarea") {
    return `
      <div class="field">
        <label for="${inputId}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
        <textarea id="${inputId}" data-bind="${field.bind}" ${field.required ? "required" : ""}>${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    const options = (field.options || []).map((option) => {
      const checked = selected.includes(option) ? "checked" : "";
      return `
        <label class="choice-pill">
          <input type="checkbox" data-bind="${field.bind}" value="${escapeHtml(option)}" ${checked}>
          <span>${escapeHtml(option)}</span>
        </label>
      `;
    }).join("");

    return `
      <div class="field">
        <label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
        <div class="choice-grid">${options}</div>
      </div>
    `;
  }

  const type = field.type === "number" ? "number" : "text";
  return `
    <div class="field">
      <label for="${inputId}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
      <input id="${inputId}" type="${type}" value="${escapeHtml(value)}" data-bind="${field.bind}" ${field.required ? "required" : ""}>
    </div>
  `;
}

export function createSchemaForm(container, definition, initialValue = {}) {
  const sections = definition?.form_sections || [];

  container.innerHTML = sections.map((section) => `
    <section class="form-card">
      <div class="inline-actions" style="justify-content: space-between; align-items: baseline;">
        <div>
          <h3 class="section-title">${escapeHtml(section.title)}</h3>
          ${section.description ? `<p class="body-muted">${escapeHtml(section.description)}</p>` : ""}
        </div>
      </div>
      <div class="form-grid" style="margin-top: 18px;">
        ${section.fields.map((field) => renderField(field, getByPath(initialValue, field.bind))).join("")}
      </div>
    </section>
  `).join("");

  function collectInput() {
    const output = {};

    sections.forEach((section) => {
      (section.fields || []).forEach((field) => {
        if (field.type === "multiselect") {
          const values = Array.from(container.querySelectorAll(`input[data-bind="${field.bind}"]:checked`))
            .map((input) => input.value);
          setByPath(output, field.bind, values);
          return;
        }

        const input = container.querySelector(`[data-bind="${field.bind}"]`);
        const rawValue = input?.value ?? "";
        const value = field.type === "number" && rawValue !== "" ? Number(rawValue) : rawValue;
        setByPath(output, field.bind, value);
      });
    });

    return output;
  }

  return {
    collectInput
  };
}
