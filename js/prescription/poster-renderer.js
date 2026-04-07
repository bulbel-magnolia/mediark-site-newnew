function findPosterHero(images = []) {
  const heroImage = images.find((item) => item.role === "poster_hero");
  return heroImage?.path || images[0]?.path || "";
}

export function buildPosterPayload(masterJson) {
  const posterSpec = masterJson?.spec?.poster_spec || {};
  const images = masterJson?.artifacts?.images || [];

  return {
    templateId: posterSpec.template_id || "poster_clinical_v1",
    title: posterSpec.title || "",
    subtitle: posterSpec.subtitle || "",
    heroImage: findPosterHero(images),
    keyPoints: posterSpec.key_points || [],
    doList: posterSpec.do_list || [],
    dontList: posterSpec.dont_list || [],
    redFlags: posterSpec.red_flags || [],
    footer: {
      badge: posterSpec.footer_badge || "",
      sourceTag: posterSpec.source_tag || ""
    }
  };
}

export function renderPosterMarkup(payload) {
  return `
    <section class="rounded-3xl overflow-hidden bg-white shadow-xl border border-slate-200">
      <div class="grid md:grid-cols-[1.2fr_1fr]">
        <div class="min-h-[360px] bg-slate-100">
          ${payload.heroImage ? `<img src="${payload.heroImage}" alt="${payload.title}" class="h-full w-full object-cover">` : '<div class="h-full w-full flex items-center justify-center text-slate-400">Poster Hero</div>'}
        </div>
        <div class="p-8 bg-gradient-to-b from-white to-slate-50">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">${payload.footer.sourceTag}</p>
          <h2 class="mt-3 text-3xl font-bold text-slate-900">${payload.title}</h2>
          <p class="mt-2 text-sm text-slate-500">${payload.subtitle}</p>
          <div class="mt-6 grid gap-4">
            <div>
              <h3 class="text-sm font-semibold text-slate-800">三点重点</h3>
              <ul class="mt-2 space-y-2">${payload.keyPoints.map((item) => `<li class="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">${item}</li>`).join("")}</ul>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm font-semibold text-slate-800">建议这样做</h3>
                <ul class="mt-2 space-y-2">${payload.doList.map((item) => `<li class="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">${item}</li>`).join("")}</ul>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-slate-800">尽量避免</h3>
                <ul class="mt-2 space-y-2">${payload.dontList.map((item) => `<li class="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">${item}</li>`).join("")}</ul>
              </div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-slate-800">危险信号</h3>
              <div class="mt-2 flex flex-wrap gap-2">${payload.redFlags.map((item) => `<span class="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">${item}</span>`).join("")}</div>
            </div>
          </div>
          <div class="mt-6 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">${payload.footer.badge}</div>
        </div>
      </div>
    </section>
  `;
}
