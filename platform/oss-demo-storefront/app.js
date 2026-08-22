let projects = [];

async function loadCatalog() {
  try {
    const res = await fetch('./catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    projects = Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error('[catalog] load failed:', err);
    projects = [];
  }
  renderProjects();
}

let activeCategory = "全部";
let activeLicense = "全部";
let activeDeploy = "全部";

const projectList = document.querySelector("#projectList");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const resultsLabel = document.querySelector("#resultsLabel");
const licenseFilter = document.querySelector("#licenseFilter");
const deployFilter = document.querySelector("#deployFilter");
const modalBackdrop = document.querySelector("#modalBackdrop");
const detailBackdrop = document.querySelector("#detailBackdrop");
const detailContent = document.querySelector("#detailContent");
const formMessage = document.querySelector("#formMessage");
const contactForm = document.querySelector("#contactForm");

function projectMatches(project) {
  const query = searchInput.value.trim().toLowerCase();
  const haystack = [
    project.name,
    project.businessName,
    project.category,
    project.licenseLabel,
    project.deploy,
    project.description,
    project.suitable,
  ].join(" ").toLowerCase();

  return (
    (activeCategory === "全部" || project.category === activeCategory) &&
    (activeLicense === "全部" || project.license === activeLicense) &&
    (activeDeploy === "全部" || project.deploy.includes(activeDeploy)) &&
    haystack.includes(query)
  );
}

function renderProjects() {
  const visible = projects.filter(projectMatches);
  const downloadCount = visible.filter((p) => p.deploy && p.deploy.includes("桌面端")).length;
  resultsLabel.textContent = `${String(visible.length).padStart(2, "0")} 个项目 · 已按九章评审排序`;
  if (downloadCount > 0) {
    resultsLabel.textContent += ` · 含 ${downloadCount} 个下载使用`;
  }
  projectList.innerHTML = visible
    .map((p) => {
      const isDesktop = !!(p.deploy && p.deploy.includes("桌面端"));
      const ctaLabel = isDesktop ? "下载使用 ↗" : p.launch_url ? "立即试用 ↗" : p.launchable ? "申请开通 ↗" : "申请试用";
      const tryBtn = p.launch_url
        ? `<a class="btn-try${isDesktop ? " desktop" : ""}" href="${p.launch_url}" target="_blank" rel="noreferrer">${ctaLabel}</a>`
        : p.launchable
          ? `<button class="btn-try" type="button" data-action="consult" data-project-name="${p.name}">${ctaLabel}</button>`
          : `<button class="btn-try ghost" type="button" data-action="consult" data-project-name="${p.name}">${ctaLabel}</button>`;
      const downloadTag = isDesktop ? `<span class="download-badge" title="桌面端下载使用，不在云端托管"><span class="dl-icon">⬇</span>下载使用</span>` : "";
      return `
        <article class="app${isDesktop ? " is-desktop" : ""}">
          <img class="logo-box" src="${p.avatar}" alt="" loading="lazy" />
          <h4>${p.name}</h4>
          <div class="cat">${p.category}</div>
          ${downloadTag}
          <p>${p.description}</p>
          <div class="app-meta">
            <span class="rating">${p.rating}</span>
            <span>${p.licenseLabel}</span>
          </div>
          <div class="app-actions">
            ${tryBtn}
            <button class="detail-link" type="button" data-project-detail="${p.name}">查看评测 ↗</button>
          </div>
        </article>
      `;
    })
    .join("");

  emptyState.hidden = visible.length > 0;
  projectList.hidden = visible.length === 0;
}

function openModal(kind = "consult", projectName = "") {
  const title = document.querySelector("#modalTitle");
  const description = document.querySelector("#modalDescription");
  title.textContent = kind === "login" ? "进入会员工作台" : "申请企业咨询";
  description.textContent =
    kind === "login"
      ? "统一账号、应用实例、模型额度和企业服务都会在工作台中管理。平台登录正在接入中。"
      : projectName
        ? `你正在申请「${projectName}」的试用或部署，我们会按企业情况联系你。`
        : "留下企业情况，我们会按业务目标推荐适合的应用和部署方式。";
  contactForm.hidden = kind === "login";
  modalBackdrop.hidden = false;
  document.body.classList.add("modal-open");
  formMessage.textContent = kind === "login" ? "会员工作台正在接入，先联系九章完成企业开通。" : "";
  if (kind !== "login") document.querySelector("#contactForm input")?.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.classList.remove("modal-open");
}

function openDetail(projectName) {
  const project = projects.find((item) => item.name === projectName);
  if (!project) return;

  detailContent.innerHTML = `
    <div class="detail-topline"><span>项目案卷 / Project dossier</span><span>${project.reviewDate}</span></div>
    <div class="detail-title">
      <img src="${project.avatar}" alt="" />
      <div class="t"><span class="biz">${project.businessName}</span><h2 id="detailTitle">${project.name}</h2>${project.deploy && project.deploy.includes("桌面端") ? '<span class="download-badge" title="桌面端下载使用，不在云端托管"><span class="dl-icon">⬇</span>下载使用</span>' : ""}</div>
      <strong>九章评级 ${project.rating}</strong>
    </div>
    <p class="detail-lead">${project.description}</p>
    <div class="detail-grid">
      <div><span>适合谁</span><strong>${project.suitable}</strong></div>
      <div><span>部署建议</span><strong>${project.deploy}</strong></div>
      <div><span>许可证</span><strong>${project.licenseLabel}</strong></div>
      <div><span>九章状态</span><strong>${project.status}</strong></div>
    </div>
    <div class="detail-note"><span>已知边界</span><p>${project.risk}</p></div>
    <div class="detail-actions">
      ${(() => {
        const isDesktop = project.deploy && project.deploy.includes("桌面端");
        const desktopNote = isDesktop ? "<p class=\"detail-deploy-note\">桌面端下载使用项目，不在云端托管；本页面只做收录与许可证记录。</p>" : "";
        const cta = project.launch_url
          ? `<a class="btn primary" href="${project.launch_url}" target="_blank" rel="noreferrer">${isDesktop ? "下载使用 ↗" : "立即试用 ↗"}</a>`
          : `<button class="btn primary" type="button" data-action="consult" data-project-name="${project.name}">${isDesktop ? "申请下载指引 ↗" : "申请试用 / 部署 ↗"}</button>`;
        return cta + desktopNote;
      })()}
      <a class="btn ghost" href="${project.url}" target="_blank" rel="noreferrer">查看原项目 ↗</a>
    </div>
  `;
  detailBackdrop.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDetail() {
  detailBackdrop.hidden = true;
  document.body.classList.remove("modal-open");
}

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((item) => {
      item.classList.toggle("active", item.dataset.category === activeCategory);
    });
    renderProjects();
  });
});

searchInput.addEventListener("input", renderProjects);

licenseFilter.addEventListener("change", (event) => {
  activeLicense = event.target.value;
  renderProjects();
});

deployFilter.addEventListener("change", (event) => {
  activeDeploy = event.target.value;
  renderProjects();
});

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const projectButton = event.target.closest("[data-project-detail]");
  const projectName = event.target.closest("[data-project-name]")?.dataset.projectName || "";

  if (projectButton) openDetail(projectButton.dataset.projectDetail);
  if (action === "consult") openModal("consult", projectName);
  if (action === "login") openModal("login");
  if (action === "close-modal") closeModal();
  if (action === "close-detail") closeDetail();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".app[data-project-detail]");
  if (card) {
    event.preventDefault();
    openDetail(card.dataset.projectDetail);
  }
});

modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

detailBackdrop.addEventListener("click", (event) => {
  if (event.target === detailBackdrop) closeDetail();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeModal();
  closeDetail();
});

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "已收到，我们会按企业情况联系你。";
  event.target.reset();
});

loadCatalog();
