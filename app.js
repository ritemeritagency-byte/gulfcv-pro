const API_BASE = window.GULFCV_RUNTIME?.apiBase || `/api`;

const form = document.getElementById("cvForm");
const resetButtons = document.querySelectorAll('[data-action="reset"]');
const printButtons = document.querySelectorAll('[data-action="print"]');
const logoutButtons = document.querySelectorAll('[data-action="logout"]');
const profileButtons = document.querySelectorAll('[data-action="profile"]');
const historyButtons = document.querySelectorAll('[data-action="history"]');
const saveRecordButtons = document.querySelectorAll('[data-action="save-record"]');
const themeSelect = document.getElementById("themeSelect");
const layoutSelect = document.getElementById("layoutSelect");
const translationSelect = document.getElementById("translationSelect");
const mobileNavToggle = document.getElementById("mobileNavToggle");
const mobileNavPanel = document.getElementById("mobileNavPanel");
const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
const mobileNavClose = document.getElementById("mobileNavClose");
const pageParams = new URLSearchParams(window.location.search);
const previewRecordId = sanitizeRecordId(pageParams.get("recordId"));
const isRecordPreviewMode = pageParams.get("view") === "preview" && Boolean(previewRecordId);
const usageChip = document.getElementById("usageChip");
const cvHistoryList = document.getElementById("cvHistoryList");
const cvHistoryStatus = document.getElementById("cvHistoryStatus");
const workingExperienceInput = document.getElementById("workingExperience");
const workRows = document.getElementById("workRows");
const agencyLogoInput = document.getElementById("agencyLogoInput");
const fraLogoInput = document.getElementById("fraLogoInput");
const passportPhotoInput = document.getElementById("passportPhotoInput");
const fullPhotoInput = document.getElementById("fullPhotoInput");
const passportZoomInput = document.getElementById("passportZoom");
const passportOffsetXInput = document.getElementById("passportOffsetX");
const passportOffsetYInput = document.getElementById("passportOffsetY");
const fullZoomInput = document.getElementById("fullZoom");
const fullOffsetXInput = document.getElementById("fullOffsetX");
const fullOffsetYInput = document.getElementById("fullOffsetY");
const phSkillsList = document.getElementById("phSkillsList");
const phExperienceList = document.getElementById("phExperienceList");
const phEnglishLevel = document.getElementById("phEnglishLevel");
const ocrInput = document.getElementById("ocrInput");
const autofillOverwriteInput = document.getElementById("autofillOverwrite");
const autoFillBtn = document.getElementById("autoFillBtn");
const autofillStatus = document.getElementById("autofillStatus");
const scanDropzone = document.getElementById("scanDropzone");
const scanFileInput = document.getElementById("scanFileInput");
const extractScanBtn = document.getElementById("extractScanBtn");
const scanFileMeta = document.getElementById("scanFileMeta");
const passportCopyInput = document.getElementById("passportCopyInput");
const certificate1Input = document.getElementById("certificate1Input");
const certificate2Input = document.getElementById("certificate2Input");
const certificate3Input = document.getElementById("certificate3Input");
const docAdjustTarget = document.getElementById("docAdjustTarget");
const docZoomInput = document.getElementById("docZoom");
const docOffsetXInput = document.getElementById("docOffsetX");
const docOffsetYInput = document.getElementById("docOffsetY");
const localModePanel = document.getElementById("localModePanel");
const localAccentSelect = document.getElementById("localAccentColor");
const phLanguageList = document.getElementById("phLanguageList");
const phCertificationList = document.getElementById("phCertificationList");
const inlineFieldEditors = [
  { targetId: "pvResumeName", inputName: "fullName", localInputName: "localFullName" },
  { targetId: "pvResumePostApplied", inputName: "postApplied", localInputName: "localTargetRole" },
  { targetId: "pvResumeNationality", inputName: "nationality", localInputName: "localNationality" },
  { targetId: "pvResumeSalary", inputName: "monthlySalary", localInputName: "localExpectedSalary" },
  { targetId: "phResumeSummary", inputName: "localSummary", localInputName: "localSummary" },
  { targetId: "phContactPhone", inputName: "contactNo", localInputName: "localPhone" },
  { targetId: "phEducationSummary", inputName: "education", localInputName: "localEducation" },
  { targetId: "phReferenceName", inputName: "emergencyPerson", localInputName: "localRef1Name" },
  { targetId: "phReferencePhone", inputName: "emergencyAddress", localInputName: "localRef1Phone" },
  { targetId: "phReferenceName2", inputName: "localRef2Name", localInputName: "localRef2Name" },
  { targetId: "phReferencePhone2", inputName: "localRef2Phone", localInputName: "localRef2Phone" },
  { targetId: "phReferenceEmail2", inputName: "localRef2Email", localInputName: "localRef2Email" }
];
const inlineListEditors = [
  { targetId: "phSkillsList", inputName: "workingExperience", localInputName: "localSkills" },
  { targetId: "phExperienceList", inputName: "localExperience", localInputName: "localExperience" },
  { targetId: "phCertificationList", inputName: "localCertifications", localInputName: "localCertifications" },
  { targetId: "phLanguageList", inputName: "localLanguages", localInputName: "localLanguages" }
];
const DRAFT_STORAGE_KEY_PREFIX = "gcc_cv_draft_";

let currentAgency = null;
let lastRecordedCvKey = "";
let selectedScanFile = null;
let tesseractLoaderPromise = null;
let draftSaveTimer = null;
const DEFAULT_DOC_ADJUST_STATE = {
  passportCopyPreview: { zoom: 100, x: 0, y: 0 },
  certificate1Preview: { zoom: 100, x: 0, y: 0 },
  certificate2Preview: { zoom: 100, x: 0, y: 0 },
  certificate3Preview: { zoom: 100, x: 0, y: 0 }
};

const docAdjustState = Object.fromEntries(
  Object.entries(DEFAULT_DOC_ADJUST_STATE).map(([key, value]) => [key, { ...value }])
);

if (isRecordPreviewMode) {
  document.body.classList.add("record-preview-mode");
}

const TEMPLATE_ENGINE = {
  defaultLayoutId: "standard",
  layouts: [
    {
      id: "standard",
      label: "Structure 1 - 2x2 + Full Body",
      dataLayout: "standard",
      market: "gcc",
      defaultTranslation: "ar"
    },
    {
      id: "full-body",
      label: "Structure 2 - Full Body Focus",
      dataLayout: "full-body",
      market: "gcc",
      defaultTranslation: "ar"
    },
    {
      id: "photo-left",
      label: "Photo Left",
      dataLayout: "photo-left",
      market: "gcc",
      defaultTranslation: "ar"
    },
    {
      id: "full-body-left",
      label: "Structure 4 - Full Body Left",
      dataLayout: "full-body-left",
      market: "gcc",
      defaultTranslation: "ar"
    },
    {
      id: "compact",
      label: "Compact One-Page",
      dataLayout: "compact",
      market: "gcc",
      defaultTranslation: "ar"
    },
    {
      id: "ph-local",
      label: "Structure 3 - PH Plain Resume",
      dataLayout: "ph-local",
      market: "ph-local",
      defaultTranslation: "en",
      lockTranslation: true
    }
  ]
};

const PLAN_THEME_FALLBACK = {
  free: ["classic"],
  starter: ["classic", "desert", "emerald", "ruby"],
  growth: ["classic", "desert", "emerald", "royal", "sunrise", "slate", "ruby", "ocean"],
  enterprise: [
    "classic",
    "desert",
    "emerald",
    "royal",
    "sunrise",
    "slate",
    "ruby",
    "midnight",
    "ocean",
    "carbon"
  ]
};

function getLayoutConfig(layoutId) {
  if (layoutId === "ph-modern") {
    layoutId = "ph-local";
  }
  return TEMPLATE_ENGINE.layouts.find((layout) => layout.id === layoutId) || TEMPLATE_ENGINE.layouts[0];
}

function renderLayoutOptions() {
  if (!layoutSelect) {
    return;
  }
  layoutSelect.innerHTML = TEMPLATE_ENGINE.layouts
    .map((layout) => `<option value="${layout.id}">${layout.label}</option>`)
    .join("");
}

function applyLayoutTranslationMode(layoutConfig) {
  if (!translationSelect) {
    return;
  }

  const control = translationSelect.closest(".theme-control");
  const shouldLock = Boolean(layoutConfig?.lockTranslation);

  translationSelect.disabled = shouldLock;
  if (control) {
    control.classList.toggle("hidden-by-template", shouldLock);
  }

  if (shouldLock) {
    applyTranslation(layoutConfig?.defaultTranslation || "en");
    return;
  }

  const current = translationSelect.value || localStorage.getItem("gcc_cv_translation") || layoutConfig?.defaultTranslation || "ar";
  applyTranslation(current);
}

const levelCells = {
  Poor: document.getElementById("lvPoor"),
  Fair: document.getElementById("lvFair"),
  Good: document.getElementById("lvGood"),
  "Very Good": document.getElementById("lvVeryGood"),
  Fluent: document.getElementById("lvFluent")
};

const mirrorTargets = {
  pvAgencyName: ["pvAgencyNamePage2", "pvAgencyNamePage3", "pvAgencyNamePage4", "pvAgencyNamePage5"],
  pvAgencyNameAr: ["pvAgencyNameArPage2", "pvAgencyNameArPage3", "pvAgencyNameArPage4", "pvAgencyNameArPage5"],
  pvAgencyPhone: ["pvAgencyPhonePage2", "pvAgencyPhonePage3", "pvAgencyPhonePage4", "pvAgencyPhonePage5"],
  pvAgencyEmail: ["pvAgencyEmailPage2", "pvAgencyEmailPage3", "pvAgencyEmailPage4", "pvAgencyEmailPage5", "phContactEmail", "phReferenceEmail"],
  pvAgencyWebsite: ["pvAgencyWebsitePage2", "pvAgencyWebsitePage3", "pvAgencyWebsitePage4", "pvAgencyWebsitePage5"],
  pvAgencySocial1: ["pvAgencySocial1Page2", "pvAgencySocial1Page3", "pvAgencySocial1Page4", "pvAgencySocial1Page5"],
  pvAgencySocial2: ["pvAgencySocial2Page2", "pvAgencySocial2Page3", "pvAgencySocial2Page4", "pvAgencySocial2Page5"],
  pvAgencyAddress: ["pvAgencyAddressPage2", "pvAgencyAddressPage3", "pvAgencyAddressPage4", "pvAgencyAddressPage5", "phContactAddress"],
  pvFullName: ["pvResumeName"],
  pvPostApplied: ["pvResumePostApplied"],
  pvContactNo: ["phContactPhone"],
  pvNationality: ["pvResumeNationality"],
  pvMonthlySalary: ["pvResumeSalary"],
  pvEducation: ["phEducationSummary"],
  pvEmergencyPerson: ["phReferenceName"],
  pvEmergencyAddress: ["phReferencePhone"]
};

const uploadBindings = [
  { input: agencyLogoInput, previewIds: ["agencyLogoPreview", "agencyLogoPreviewPage2", "agencyLogoPreviewPage3", "agencyLogoPreviewPage4", "agencyLogoPreviewPage5"], label: "PH Logo", width: 260, height: 200 },
  { input: fraLogoInput, previewIds: ["fraLogoPreview", "fraLogoPreviewPage2", "fraLogoPreviewPage3", "fraLogoPreviewPage4", "fraLogoPreviewPage5"], label: "FRA Logo", width: 260, height: 200 },
  { input: passportPhotoInput, previewIds: ["passportPhotoPreview"], label: "Passport Photo (2x2)", width: 420, height: 420 },
  { input: fullPhotoInput, previewIds: ["fullPhotoPreview", "phLocalPhotoPreview"], label: "Full Body Photo", width: 300, height: 500 },
  { input: passportCopyInput, previewIds: ["passportCopyPreview"], label: "Passport Copy", width: 600, height: 380 },
  { input: certificate1Input, previewIds: ["certificate1Preview"], label: "Certificate 1", width: 420, height: 300 },
  { input: certificate2Input, previewIds: ["certificate2Preview"], label: "Certificate 2", width: 420, height: 300 },
  { input: certificate3Input, previewIds: ["certificate3Preview"], label: "Certificate 3", width: 420, height: 300 }
];

const supportingPageBindings = [
  { input: passportCopyInput, pageId: "passportPage" },
  { input: certificate1Input, pageId: "certificate1Page" },
  { input: certificate2Input, pageId: "certificate2Page" },
  { input: certificate3Input, pageId: "certificate3Page" }
];

const TRANSLATIONS = {
  ar: {
    "Agency-ready bilingual (English + Arabic) candidate profile": "ملف مرشح ثنائي اللغة (الإنجليزية + العربية) جاهز للوكالة",
    "Application For Employee": "طلب توظيف",
    "Reference No.": "رقم المرجع",
    "Post Applied For": "الوظيفة المطلوبة",
    "Monthly Salary": "الراتب الشهري",
    "Contract Period": "مدة العقد",
    "NAME": "الاسم الكامل",
    "Details Of Applicant": "بيانات مقدم الطلب",
    "Passport Details": "بيانات جواز السفر",
    Nationality: "الجنسية",
    Religion: "الديانة",
    "Date Of Birth": "تاريخ الميلاد",
    "Place of birth": "مكان الميلاد",
    Age: "العمر",
    "Civil Status": "الحالة الاجتماعية",
    "No of Children": "عدد الأطفال",
    Weight: "الوزن",
    Height: "الطول",
    "Education Level": "المستوى التعليمي",
    "Contact No.": "رقم الاتصال",
    "Knowledge Of Language": "المهارات اللغوية",
    English: "الإنجليزية",
    Level: "المستوى",
    Arabic: "العربية",
    Poor: "ضعيف",
    Fair: "مقبول",
    Good: "جيد",
    "Very Good": "جيد جدا",
    Fluent: "ممتاز",
    "Working Experience": "الخبرة العملية",
    Cooking: "طبخ",
    Cleaning: "تنظيف",
    Washing: "غسيل",
    Ironing: "كي الملابس",
    "Baby Sitting": "رعاية الأطفال",
    Babysitting: "رعاية الأطفال",
    "Lady Driver": "سائقة",
    "Previous Employment Abroad": "خبرة العمل بالخارج السابقة",
    Emergency: "بيانات الطوارئ",
    Country: "الدولة",
    Period: "الفترة",
    "Contact Person": "شخص للطوارئ",
    Address: "العنوان",
    Number: "رقم الجواز",
    "Issue Date": "تاريخ الإصدار",
    Place: "مكان الإصدار",
    "Exp. Date": "تاريخ الانتهاء",
    "Passport Photo (2x2)": "صورة الجواز (2x2)",
    "Full Body Photo": "صورة الجسم الكامل",
    "Passport Copy": "نسخة جواز السفر",
    "Certificate 1": "الشهادة 1",
    "Certificate 2": "الشهادة 2",
    "Certificate 3": "الشهادة 3"
  },
  "zh-hk": {
    "Agency-ready bilingual (English + Arabic) candidate profile": "機構專用雙語（英文 + 中文）候選人檔案",
    "Application For Employee": "僱員申請",
    "Reference No.": "參考編號",
    "Post Applied For": "申請職位",
    "Monthly Salary": "月薪",
    "Contract Period": "合約期",
    "NAME": "姓名",
    "Details Of Applicant": "申請人資料",
    "Passport Details": "護照資料",
    Nationality: "國籍",
    Religion: "宗教",
    "Date Of Birth": "出生日期",
    "Place of birth": "出生地",
    Age: "年齡",
    "Civil Status": "婚姻狀況",
    "No of Children": "子女人數",
    Weight: "體重",
    Height: "身高",
    "Education Level": "教育程度",
    "Contact No.": "聯絡電話",
    "Knowledge Of Language": "語言能力",
    English: "英文",
    Level: "等級",
    Arabic: "中文",
    Poor: "較弱",
    Fair: "一般",
    Good: "良好",
    "Very Good": "很好",
    Fluent: "流利",
    "Working Experience": "工作經驗",
    Cooking: "烹飪",
    Cleaning: "清潔",
    Washing: "洗衣",
    Ironing: "熨燙",
    "Baby Sitting": "照顧小孩",
    Babysitting: "照顧小孩",
    "Lady Driver": "女司機",
    "Previous Employment Abroad": "海外工作經驗",
    Emergency: "緊急資料",
    Country: "國家",
    Period: "期間",
    "Contact Person": "緊急聯絡人",
    Address: "地址",
    Number: "護照號碼",
    "Issue Date": "簽發日期",
    Place: "簽發地點",
    "Exp. Date": "到期日期",
    "Passport Photo (2x2)": "護照相片 (2x2)",
    "Full Body Photo": "全身相片",
    "Passport Copy": "護照副本",
    "Certificate 1": "證書 1",
    "Certificate 2": "證書 2",
    "Certificate 3": "證書 3"
  },
  "zh-sg": {
    "Agency-ready bilingual (English + Arabic) candidate profile": "机构专用双语（英文 + 中文）候选人档案",
    "Application For Employee": "雇员申请",
    "Reference No.": "参考编号",
    "Post Applied For": "申请职位",
    "Monthly Salary": "月薪",
    "Contract Period": "合同期",
    "NAME": "姓名",
    "Details Of Applicant": "申请人资料",
    "Passport Details": "护照资料",
    Nationality: "国籍",
    Religion: "宗教",
    "Date Of Birth": "出生日期",
    "Place of birth": "出生地",
    Age: "年龄",
    "Civil Status": "婚姻状况",
    "No of Children": "子女人数",
    Weight: "体重",
    Height: "身高",
    "Education Level": "教育程度",
    "Contact No.": "联系电话",
    "Knowledge Of Language": "语言能力",
    English: "英文",
    Level: "等级",
    Arabic: "中文",
    Poor: "较弱",
    Fair: "一般",
    Good: "良好",
    "Very Good": "很好",
    Fluent: "流利",
    "Working Experience": "工作经验",
    Cooking: "烹饪",
    Cleaning: "清洁",
    Washing: "洗衣",
    Ironing: "熨烫",
    "Baby Sitting": "照顾小孩",
    Babysitting: "照顾小孩",
    "Lady Driver": "女司机",
    "Previous Employment Abroad": "海外工作经验",
    Emergency: "紧急资料",
    Country: "国家",
    Period: "期间",
    "Contact Person": "紧急联系人",
    Address: "地址",
    Number: "护照号码",
    "Issue Date": "签发日期",
    Place: "签发地点",
    "Exp. Date": "到期日期",
    "Passport Photo (2x2)": "护照相片 (2x2)",
    "Full Body Photo": "全身相片",
    "Passport Copy": "护照副本",
    "Certificate 1": "证书 1",
    "Certificate 2": "证书 2",
    "Certificate 3": "证书 3"
  },
  ms: {
    "Agency-ready bilingual (English + Arabic) candidate profile": "Profil calon dwibahasa (Inggeris + Melayu) sedia agensi",
    "Application For Employee": "Permohonan Pekerja",
    "Reference No.": "No. Rujukan",
    "Post Applied For": "Jawatan Dipohon",
    "Monthly Salary": "Gaji Bulanan",
    "Contract Period": "Tempoh Kontrak",
    "NAME": "NAMA",
    "Details Of Applicant": "Butiran Pemohon",
    "Passport Details": "Butiran Pasport",
    Nationality: "Kewarganegaraan",
    Religion: "Agama",
    "Date Of Birth": "Tarikh Lahir",
    "Place of birth": "Tempat Lahir",
    Age: "Umur",
    "Civil Status": "Status Perkahwinan",
    "No of Children": "Bilangan Anak",
    Weight: "Berat",
    Height: "Tinggi",
    "Education Level": "Tahap Pendidikan",
    "Contact No.": "No. Telefon",
    "Knowledge Of Language": "Kemahiran Bahasa",
    English: "Bahasa Inggeris",
    Level: "Tahap",
    Arabic: "Bahasa Melayu",
    Poor: "Lemah",
    Fair: "Sederhana",
    Good: "Baik",
    "Very Good": "Sangat Baik",
    Fluent: "Lancar",
    "Working Experience": "Pengalaman Kerja",
    Cooking: "Memasak",
    Cleaning: "Membersih",
    Washing: "Mencuci",
    Ironing: "Menggosok",
    "Baby Sitting": "Menjaga Kanak-kanak",
    Babysitting: "Menjaga Kanak-kanak",
    "Lady Driver": "Pemandu Wanita",
    "Previous Employment Abroad": "Pengalaman Kerja Luar Negara",
    Emergency: "Kecemasan",
    Country: "Negara",
    Period: "Tempoh",
    "Contact Person": "Orang Untuk Dihubungi",
    Address: "Alamat",
    Number: "Nombor Pasport",
    "Issue Date": "Tarikh Dikeluarkan",
    Place: "Tempat Dikeluarkan",
    "Exp. Date": "Tarikh Tamat",
    "Passport Photo (2x2)": "Foto Pasport (2x2)",
    "Full Body Photo": "Foto Seluruh Badan",
    "Passport Copy": "Salinan Pasport",
    "Certificate 1": "Sijil 1",
    "Certificate 2": "Sijil 2",
    "Certificate 3": "Sijil 3"
  },
  en: {}
};

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function t(lang, key) {
  return TRANSLATIONS[lang]?.[key] || key;
}

function applyTranslation(lang) {
  const safeLang = TRANSLATIONS[lang] ? lang : "ar";
  localStorage.setItem("gcc_cv_translation", safeLang);
  if (translationSelect) {
    translationSelect.value = safeLang;
  }

  const subtitle = document.querySelector(".header-title p");
  if (subtitle) {
    if (document.body.dataset.layout === "ph-local") {
      subtitle.textContent = "Philippines local plain resume profile";
      return;
    }
    if (document.body.dataset.layout === "ph-modern") {
      subtitle.textContent = "Philippines modern resume profile";
      return;
    }
    const pairLabelMap = {
      ar: "Arabic",
      "zh-hk": "Hong Kong Chinese",
      "zh-sg": "Mandarin Chinese (Singapore)",
      ms: "Malay (Malaysia)",
      en: "English"
    };
    const pairLabel = pairLabelMap[safeLang] || "Arabic";
    subtitle.textContent = safeLang === "en"
      ? "Agency-ready English candidate profile"
      : `Agency-ready bilingual (English + ${pairLabel}) candidate profile`;
  }

  document.querySelectorAll(".paper-head").forEach((head) => {
    const left = head.querySelector("span:not(.ar)");
    const right = head.querySelector(".ar");
    if (left && right) {
      right.textContent = t(safeLang, sanitizeText(left.textContent));
    }
  });

  document.querySelectorAll(".section-row td").forEach((cell) => {
    const left = cell.querySelector("span:not(.ar)");
    const right = cell.querySelector(".ar");
    if (left && right) {
      right.textContent = t(safeLang, sanitizeText(left.textContent));
    }
  });

  document.querySelectorAll(".cv-table tr").forEach((row) => {
    const leftCell = row.querySelector("th:not(.ar)");
    const translatedCell = row.querySelector("th.ar, td.ar");
    if (leftCell && translatedCell) {
      translatedCell.textContent = t(safeLang, sanitizeText(leftCell.textContent));
    }
  });
}

function sanitizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function sanitizeRecordId(value) {
  const clean = String(value || "").trim();
  return /^[a-zA-Z0-9-]{8,80}$/.test(clean) ? clean : "";
}

function getDraftStorageKey() {
  if (!currentAgency?.id) {
    return "";
  }
  return `${DRAFT_STORAGE_KEY_PREFIX}${currentAgency.id}`;
}

function clearDraftSaveTimer() {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }
}

function saveDraftToLocal() {
  if (isRecordPreviewMode || !currentAgency) {
    return;
  }
  const key = getDraftStorageKey();
  if (!key) {
    return;
  }
  const payload = {
    savedAt: new Date().toISOString(),
    snapshot: buildCvSnapshot()
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

function queueDraftSave() {
  if (isRecordPreviewMode || !currentAgency) {
    return;
  }
  clearDraftSaveTimer();
  draftSaveTimer = setTimeout(() => {
    saveDraftToLocal();
  }, 700);
}

function clearDraftFromLocal() {
  const key = getDraftStorageKey();
  if (key) {
    localStorage.removeItem(key);
  }
}

function restoreDraftFromLocal() {
  if (isRecordPreviewMode || !currentAgency) {
    return false;
  }
  const key = getDraftStorageKey();
  if (!key) {
    return false;
  }
  const raw = localStorage.getItem(key);
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.snapshot) {
      applyCvSnapshot(parsed.snapshot);
      return true;
    }
  } catch {
    localStorage.removeItem(key);
  }
  return false;
}

function setAutoFillStatus(text, ok = false) {
  if (!autofillStatus) {
    return;
  }
  autofillStatus.style.color = ok ? "#11623a" : "#7d1f26";
  autofillStatus.textContent = text;
}

function setScanFile(file) {
  selectedScanFile = file || null;
  if (!scanFileMeta) {
    return;
  }
  if (!selectedScanFile) {
    scanFileMeta.textContent = "No scan selected";
    return;
  }
  const sizeMb = (selectedScanFile.size / (1024 * 1024)).toFixed(2);
  scanFileMeta.textContent = `${selectedScanFile.name} (${sizeMb} MB)`;
}

function validateScanFile(file) {
  if (!file) {
    return "Choose a scan image first.";
  }
  if (!file.type.startsWith("image/")) {
    return "Only image files are supported for scan OCR.";
  }
  if (file.size > 12 * 1024 * 1024) {
    return "Scan is too large. Please use an image smaller than 12 MB.";
  }
  return "";
}

function loadTesseract() {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }
  if (tesseractLoaderPromise) {
    return tesseractLoaderPromise;
  }
  tesseractLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("Failed to load OCR engine. Check internet connection."));
    document.head.appendChild(script);
  });
  return tesseractLoaderPromise;
}

function normalizeDateValue(value) {
  const clean = sanitizeText(value);
  if (!clean) {
    return "";
  }

  const m = clean.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!m) {
    return clean.toUpperCase();
  }

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = String(Number(m[1])).padStart(2, "0");
  const monthIndex = Number(m[2]) - 1;
  const yearRaw = Number(m[3]);
  const year = yearRaw < 100 ? (yearRaw > 50 ? 1900 + yearRaw : 2000 + yearRaw) : yearRaw;
  if (monthIndex < 0 || monthIndex > 11) {
    return clean.toUpperCase();
  }
  return `${day} ${months[monthIndex]} ${year}`;
}

function parseCvDateToJs(value) {
  const v = sanitizeText(value).toUpperCase();
  if (!v) {
    return null;
  }
  const m = v.match(/^(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})$/);
  if (!m) {
    return null;
  }
  const monthMap = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11
  };
  return new Date(Number(m[3]), monthMap[m[2]], Number(m[1]));
}

function computeAgeFromDate(value) {
  const dob = parseCvDateToJs(value);
  if (!dob || Number.isNaN(dob.getTime())) {
    return "";
  }
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age > 0 && age < 100 ? String(age) : "";
}

function normalizeMrzDate(yymmdd, mode = "generic") {
  if (!/^\d{6}$/.test(yymmdd || "")) {
    return "";
  }
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return "";
  }
  const nowYY = Number(String(new Date().getFullYear()).slice(-2));
  let year = 2000 + yy;
  if (mode === "birth") {
    year = yy > nowYY ? 1900 + yy : 2000 + yy;
  }
  return normalizeDateValue(`${dd}/${mm}/${year}`);
}

function parseMrz(rawText) {
  const lines = rawText
    .toUpperCase()
    .split("\n")
    .map((line) => line.replace(/\s+/g, "").trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const l1 = lines[i];
    const l2 = lines[i + 1] || "";
    if (!l1.startsWith("P<")) {
      continue;
    }

    const namesPart = l1.slice(5);
    const [surnameRaw = "", givenRaw = ""] = namesPart.split("<<");
    const surname = surnameRaw.replace(/<+/g, " ").trim();
    const given = givenRaw.replace(/<+/g, " ").trim();
    const fullName = sanitizeText(`${given} ${surname}`).toUpperCase();

    const second = l2.replace(/[^A-Z0-9<]/g, "");
    const out = { fullName };
    if (second.length >= 27) {
      out.passportNo = second.slice(0, 9).replace(/</g, "");
      out.dateOfBirth = normalizeMrzDate(second.slice(13, 19), "birth");
      out.passportExpiry = normalizeMrzDate(second.slice(21, 27), "expiry");
      out.age = computeAgeFromDate(out.dateOfBirth);
    }
    return out;
  }
  return {};
}

function extractLabeledValue(text, labels) {
  const lineParts = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(?:${lineParts.join("|")})\\s*[:\\-]?\\s*([^\\n]{2,80})`, "i");
  const match = text.match(pattern);
  if (!match || !match[1]) {
    return "";
  }
  const value = match[1].replace(/\s{2,}/g, " ").trim();
  if (/^(?:[|:'".-]+)$/.test(value)) {
    return "";
  }
  return value;
}

function setFieldValue(name, value, overwrite = false) {
  const input = form.querySelector(`[name="${name}"]`);
  if (!input) {
    return false;
  }
  const nextValue = sanitizeText(value || "");
  if (!nextValue) {
    return false;
  }
  const currentValue = sanitizeText(input.value || "");
  if (!overwrite && currentValue) {
    return false;
  }
  input.value = nextValue;
  return true;
}

function extractByRegex(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return sanitizeText(match[1]);
    }
  }
  return "";
}

function cleanOcrText(rawText) {
  const noisyPatterns = [
    /camscanner/i,
    /whatsapp image/i,
    /@\w+/i,
    /\bfacebook\b/i,
    /\binstagram\b/i,
    /\b\d{9,}\b/i
  ];
  return rawText
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !noisyPatterns.some((pattern) => pattern.test(line)))
    .join("\n");
}

function looksLikePersonName(value) {
  const v = sanitizeText(value).toUpperCase();
  if (!v || v.length < 5 || v.length > 60) {
    return false;
  }
  if (/\d/.test(v)) {
    return false;
  }
  const banned = ["PASSPORT", "REPUBLIC", "RELAT", "CONTACT", "ADDRESS", "CAMSCANNER", "WHATSAPP"];
  if (banned.some((x) => v.includes(x))) {
    return false;
  }
  const words = v.split(/\s+/).filter(Boolean);
  return words.length >= 2;
}

function parseOcrText(rawText) {
  const text = cleanOcrText(rawText);
  const upper = text.toUpperCase();
  const out = {};

  const lineMap = {
    "reference no": "referenceNo",
    "reference number": "referenceNo",
    "post applied for": "postApplied",
    "position": "postApplied",
    "monthly salary": "monthlySalary",
    "salary": "monthlySalary",
    "contract period": "contractPeriod",
    "contract duration": "contractPeriod",
    "full name": "fullName",
    "nationality": "nationality",
    "religion": "religion",
    "date of birth": "dateOfBirth",
    "birth date": "dateOfBirth",
    "place of birth": "placeOfBirth",
    "age": "age",
    "civil status": "civilStatus",
    "no of children": "children",
    "number of children": "children",
    "weight": "weight",
    "height": "height",
    "education": "education",
    "education level": "education",
    "contact no": "contactNo",
    "contact number": "contactNo",
    "passport number": "passportNo",
    "passport no": "passportNo",
    "issue date": "passportIssue",
    "issue place": "passportPlace",
    "place of issue": "passportPlace",
    "expiry date": "passportExpiry",
    "exp date": "passportExpiry",
    "previous employment country": "prevCountry",
    "country": "prevCountry",
    "period": "prevPeriod",
    "emergency contact person": "emergencyPerson",
    "emergency address": "emergencyAddress",
    "emergency contact no": "emergencyAddress",
    "emergency phone": "emergencyAddress"
  };

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/[:\-]\s*/);
    if (parts.length < 2) {
      continue;
    }
    const key = parts[0].toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const value = parts.slice(1).join(": ").trim();
    const target = lineMap[key];
    if (target && !out[target]) {
      out[target] = value;
    }
  }

  const mrz = parseMrz(text);
  Object.assign(out, mrz);

  const labeledName = extractLabeledValue(text, ["Full Name", "Given Name", "Given Names", "Surname"]);
  if (looksLikePersonName(labeledName)) {
    out.fullName ||= labeledName;
  }
  out.passportNo ||= extractByRegex(text, [
    /passport(?:\s*no\.?|\s*number)?\s*[:\-]?\s*([A-Z0-9]{6,15})/i
  ]);
  out.passportNo ||= extractByRegex(upper, [
    /\b(P\d{7}[A-Z]?)\b/i,
    /\b([A-Z]\d{7,8}[A-Z]?)\b/i
  ]);

  out.passportIssue ||= extractLabeledValue(text, ["Issue Date", "Date of Issue", "Passport Release", "Release Date"]);
  out.passportPlace ||= extractLabeledValue(text, ["Place of Issue", "Issue Place", "Location", "Issuing Office"]);
  out.passportExpiry ||= extractLabeledValue(text, ["Expiry Date", "Expiration Date", "Exp Date", "Date of Expiry"]);

  out.dateOfBirth ||= extractLabeledValue(text, ["Date of Birth", "Birth Date", "DOB"]);
  const fallbackName = extractByRegex(text, [
    /full name\s*[:\-]\s*([^\n]+)/i,
    /given names?\s*[:\-]\s*([^\n]+)/i
  ]);
  if (!out.fullName && looksLikePersonName(fallbackName)) {
    out.fullName = fallbackName;
  }
  out.dateOfBirth ||= extractByRegex(text, [
    /date of birth\s*[:\-]\s*([^\n]+)/i,
    /\bDOB\b\s*[:\-]?\s*([^\n]+)/i
  ]);
  out.passportIssue ||= extractByRegex(text, [/issue date\s*[:\-]\s*([^\n]+)/i, /release date\s*[:\-]\s*([^\n]+)/i]);
  out.passportExpiry ||= extractByRegex(text, [/exp(?:iry)? date\s*[:\-]\s*([^\n]+)/i]);

  // Common fallback for issuing location on PH passports.
  out.passportPlace ||= extractByRegex(upper, [/\b(DFA\s+[A-Z]{3,}(?:\s+[A-Z]{3,})?)\b/i]);

  // If issue/expiry weren't labeled but two dates exist on passport page, use early/late years.
  if (!out.passportIssue || !out.passportExpiry) {
    const dateMatches = [...text.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/g)].map((m) => normalizeDateValue(m[1]));
    const parsed = dateMatches
      .map((d) => ({ cv: d, js: parseCvDateToJs(d) }))
      .filter((d) => d.js && !Number.isNaN(d.js.getTime()))
      .sort((a, b) => a.js - b.js);
    if (parsed.length >= 2) {
      out.passportIssue ||= parsed[0].cv;
      out.passportExpiry ||= parsed[parsed.length - 1].cv;
    }
  }

  if (out.dateOfBirth) {
    out.dateOfBirth = normalizeDateValue(out.dateOfBirth);
  }
  if (out.passportIssue) {
    out.passportIssue = normalizeDateValue(out.passportIssue);
  }
  if (out.passportExpiry) {
    out.passportExpiry = normalizeDateValue(out.passportExpiry);
  }
  if (!out.age && out.dateOfBirth) {
    out.age = computeAgeFromDate(out.dateOfBirth);
  }

  const englishLevelMatch = text.match(/\benglish(?:\s*level)?\s*[:\-]?\s*(poor|fair|good|very good|fluent)\b/i);
  if (englishLevelMatch) {
    out.englishLevel = englishLevelMatch[1].replace(/\s+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  const workSkills = ["Cooking", "Cleaning", "Washing", "Ironing", "Baby Sitting"];
  const foundSkills = workSkills.filter((skill) => new RegExp(`\\b${skill.replace(" ", "\\s+")}\\b`, "i").test(text));
  if (foundSkills.length) {
    out.workingExperience = foundSkills.join("\n");
  }

  return out;
}

function applyAutoFill(options = {}) {
  if (!ocrInput) {
    return { changed: 0, mappedCount: 0 };
  }
  const rawText = ocrInput.value || "";
  if (!sanitizeText(rawText)) {
    setAutoFillStatus("Paste OCR text first.");
    return { changed: 0, mappedCount: 0 };
  }

  const overwrite = options.forceOverwrite ? true : Boolean(autofillOverwriteInput?.checked);
  const mapped = parseOcrText(rawText);
  const mappedCount = Object.values(mapped).filter((value) => Boolean(sanitizeText(String(value || "")))).length;
  let changed = 0;

  const fieldNames = [
    "referenceNo",
    "postApplied",
    "monthlySalary",
    "contractPeriod",
    "fullName",
    "nationality",
    "religion",
    "dateOfBirth",
    "placeOfBirth",
    "age",
    "civilStatus",
    "children",
    "weight",
    "height",
    "education",
    "contactNo",
    "passportNo",
    "passportIssue",
    "passportPlace",
    "passportExpiry",
    "prevCountry",
    "prevPeriod",
    "emergencyPerson",
    "emergencyAddress",
    "workingExperience"
  ];

  fieldNames.forEach((name) => {
    if (setFieldValue(name, mapped[name], overwrite)) {
      changed += 1;
    }
  });

  if (mapped.englishLevel) {
    const radio = form.querySelector(`input[name="englishLevel"][value="${mapped.englishLevel}"]`);
    if (radio && (overwrite || !form.querySelector("input[name='englishLevel']:checked"))) {
      radio.checked = true;
      changed += 1;
    }
  }

  if (!mappedCount) {
    setAutoFillStatus("No clear fields detected from scan text. Try a clearer or closer image.");
    return { changed: 0, mappedCount: 0 };
  }

  if (!changed) {
    setAutoFillStatus("No new fields mapped. Try enabling overwrite or cleaner OCR text.");
    return { changed: 0, mappedCount };
  }

  lastRecordedCvKey = "";
  updateAll();
  setAutoFillStatus(`Auto-fill applied. ${changed} field(s) updated.`, true);
  return { changed, mappedCount };
}

async function extractAndAutoFillFromScan(autoApply = true) {
  const error = validateScanFile(selectedScanFile);
  if (error) {
    setAutoFillStatus(error);
    return false;
  }

  try {
    setAutoFillStatus("Loading OCR engine...");
    const Tesseract = await loadTesseract();
    setAutoFillStatus("Auto-detecting text from scan...");
    const result = await Tesseract.recognize(selectedScanFile, "eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          const pct = Math.round((message.progress || 0) * 100);
          setAutoFillStatus(`Auto-detecting text from scan... ${pct}%`);
        }
      }
    });

    const extractedText = sanitizeText(result?.data?.text || "")
      ? result.data.text
      : "";

    if (!extractedText) {
      setAutoFillStatus("No text detected. Try a clearer scan image.");
      return false;
    }

    if (ocrInput) {
      ocrInput.value = extractedText;
    }

    if (!autoApply) {
      setAutoFillStatus("Text extracted. Click Auto-Fill CV Fields.", true);
      return true;
    }

    const resultState = applyAutoFill({ forceOverwrite: true });
    if (resultState.changed > 0) {
      setAutoFillStatus(`Auto-detected and filled ${resultState.changed} field(s).`, true);
    }
    return true;
  } catch (extractError) {
    setAutoFillStatus(extractError.message || "Failed to extract text from scan.");
    return false;
  }
}

function initScanImport() {
  if (!scanDropzone || !scanFileInput || !extractScanBtn) {
    return;
  }

  scanDropzone.addEventListener("click", () => scanFileInput.click());
  scanDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      scanFileInput.click();
    }
  });

  scanDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    scanDropzone.classList.add("is-dragover");
  });
  scanDropzone.addEventListener("dragleave", () => {
    scanDropzone.classList.remove("is-dragover");
  });
  scanDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    scanDropzone.classList.remove("is-dragover");
    const file = event.dataTransfer?.files?.[0];
    const error = validateScanFile(file);
    if (error) {
      setAutoFillStatus(error);
      setScanFile(null);
      return;
    }
    setScanFile(file);
    setAutoFillStatus("Scan received. Running auto-detect...", true);
    void extractAndAutoFillFromScan(true);
  });

  scanFileInput.addEventListener("change", () => {
    const file = scanFileInput.files?.[0];
    const error = validateScanFile(file);
    if (error) {
      setAutoFillStatus(error);
      setScanFile(null);
      return;
    }
    setScanFile(file);
    setAutoFillStatus("Scan selected. Running auto-detect...", true);
    void extractAndAutoFillFromScan(true);
  });

  extractScanBtn.addEventListener("click", async () => {
    await extractAndAutoFillFromScan(true);
  });
}

function makePlaceholder(label, width, height) {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='#e8edf8'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='#5e6a84' font-family='Arial'>${label}</text></svg>`
    )
  );
}

function updateUsageChip(agency) {
  if (!usageChip || !agency) {
    return;
  }
  const status = String(agency.subscriptionStatus || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  usageChip.textContent = `${agency.planName} | ${agency.cvsCreated}/${agency.cvLimit} CV | ${status}`;
}

function formatRecordDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadCvHistory() {
  if (!cvHistoryList || !cvHistoryStatus || !currentAgency) {
    return;
  }
  try {
    cvHistoryStatus.textContent = "Loading history...";
    const { records, total } = await api("/cv-records?limit=5&offset=0");
    if (!records || !records.length) {
      cvHistoryList.innerHTML = "";
      cvHistoryStatus.textContent = "No CV history yet.";
      return;
    }
    cvHistoryList.innerHTML = records
      .map((record) => {
        const candidate = sanitizeText(record.candidateName || "-") || "-";
        const referenceNo = sanitizeText(record.referenceNo || "-") || "-";
        const source = sanitizeText(record.source || "manual") || "manual";
        const createdAt = formatRecordDate(record.createdAt);
        const recordId = sanitizeRecordId(record.id);
        const previewLink = recordId
          ? `<a class="cv-history-link" href="/dashboard?recordId=${encodeURIComponent(recordId)}&view=preview" target="_blank" rel="noopener">Open Preview</a>`
          : "";
        return `<li class="cv-history-item"><strong>${escapeHtml(candidate)}</strong><span>Ref: ${escapeHtml(referenceNo)}</span><span>${escapeHtml(source)} | ${escapeHtml(createdAt)}</span>${previewLink}</li>`;
      })
      .join("");
    cvHistoryStatus.textContent = total > records.length
      ? `Showing ${records.length} of ${total} record(s)`
      : `${records.length} record(s)`;
  } catch {
    cvHistoryStatus.textContent = "Failed to load history.";
  }
}

function applyAgencyDefaults(agency) {
  const profile = agency.profile || {};
  const map = {
    agencyName: agency.agencyName || "",
    agencyNameAr: profile.agencyNameAr || "",
    agencyTagline: profile.agencyTagline || "",
    agencyPhone: profile.agencyPhone || "",
    agencyEmail: profile.agencyEmail || "",
    agencyWebsite: profile.agencyWebsite || "",
    agencyAddress: profile.agencyAddress || "",
    agencySocial1: profile.agencySocial1 || "",
    agencySocial2: profile.agencySocial2 || ""
  };

  const previewMap = {
    pvAgencyName: map.agencyName,
    pvAgencyNameAr: map.agencyNameAr,
    pvAgencyTagline: map.agencyTagline,
    pvAgencyPhone: map.agencyPhone,
    pvAgencyEmail: map.agencyEmail,
    pvAgencyWebsite: map.agencyWebsite,
    pvAgencyAddress: map.agencyAddress,
    pvAgencySocial1: map.agencySocial1,
    pvAgencySocial2: map.agencySocial2
  };

  Object.entries(previewMap).forEach(([targetId, value]) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.textContent = value || "-";
    }

    const mirrors = mirrorTargets[targetId] || [];
    mirrors.forEach((mirrorId) => {
      const mirrorEl = document.getElementById(mirrorId);
      if (mirrorEl) {
        mirrorEl.textContent = value || "-";
      }
    });
  });

  Object.entries(map).forEach(([name, value]) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input && !input.value.trim()) {
      input.value = value;
    }
  });
}

function applyAgencyLogosFromProfile(agency) {
  const profile = agency?.profile || {};
  const leftLogo = String(profile.agencyLogo || "");
  const rightLogo = String(profile.fraLogo || "");
  const leftTargets = ["agencyLogoPreview", "agencyLogoPreviewPage2", "agencyLogoPreviewPage3", "agencyLogoPreviewPage4", "agencyLogoPreviewPage5"];
  const rightTargets = ["fraLogoPreview", "fraLogoPreviewPage2", "fraLogoPreviewPage3", "fraLogoPreviewPage4", "fraLogoPreviewPage5"];

  if (leftLogo) {
    leftTargets.forEach((id) => {
      const image = document.getElementById(id);
      if (image) {
        setPreviewSource(image, leftLogo);
      }
    });
  }

  if (rightLogo) {
    rightTargets.forEach((id) => {
      const image = document.getElementById(id);
      if (image) {
        setPreviewSource(image, rightLogo);
      }
    });
  }
}

function updateMappedFields() {
  const mappedInputs = form.querySelectorAll("[data-target]");
  mappedInputs.forEach((input) => {
    const target = document.getElementById(input.dataset.target);
    if (!target) {
      return;
    }

    const value = sanitizeText(input.value || "");
    target.textContent = value || "-";

    const mirrors = mirrorTargets[input.dataset.target] || [];
    mirrors.forEach((mirrorId) => {
      const mirrorEl = document.getElementById(mirrorId);
      if (mirrorEl) {
        mirrorEl.textContent = value || "-";
      }
    });
  });
}

function updateLanguageLevel() {
  Object.values(levelCells).forEach((cell) => {
    cell.textContent = "";
  });
  const selected = form.querySelector("input[name='englishLevel']:checked");
  if (selected && levelCells[selected.value]) {
    levelCells[selected.value].textContent = "\u2713";
  }
  if (phEnglishLevel) {
    phEnglishLevel.textContent = `English - ${selected?.value || "Good"}`;
  }
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateWorkExperience() {
  const rows = (workingExperienceInput.value || "")
    .split("\n")
    .map((line) => sanitizeText(line))
    .filter(Boolean);

  const values = rows.length ? rows : ["Cooking", "Cleaning", "Washing", "Ironing", "Baby Sitting"];
  const lang = translationSelect?.value || localStorage.getItem("gcc_cv_translation") || "ar";

  const getTranslatedSkill = (item) => {
    const direct = t(lang, item);
    if (direct !== item) {
      return direct;
    }

    const titled = item
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    const titledTranslated = t(lang, titled);
    if (titledTranslated !== titled) {
      return titledTranslated;
    }

    if (/^babysitting$/i.test(item.replace(/\s+/g, ""))) {
      return t(lang, "Babysitting");
    }
    return "-";
  };

  workRows.innerHTML = values
    .map((item) => `<tr><th>${escapeHtml(item)}</th><td>\u2713</td><th class="ar" lang="ar" dir="rtl">${escapeHtml(getTranslatedSkill(item))}</th></tr>`)
    .join("");

  if (phSkillsList) {
    phSkillsList.innerHTML = values
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  }

  if (phExperienceList) {
    phExperienceList.innerHTML = values
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  }
}

function isLocalLayout() {
  return document.body.dataset.market === "ph-local";
}

function getInputValue(name) {
  const input = form.querySelector(`[name="${name}"]`);
  return sanitizeText(input?.value || "");
}

function getInputRaw(name) {
  const input = form.querySelector(`[name="${name}"]`);
  return String(input?.value || "");
}

function getTextValue(id) {
  const node = document.getElementById(id);
  return sanitizeText(node?.textContent || "");
}

function setTextValue(id, value) {
  const node = document.getElementById(id);
  if (!node) {
    return;
  }
  node.textContent = value || "-";
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/g)
    .map((line) => sanitizeText(line))
    .filter(Boolean);
}

function renderSimpleList(target, values, emptyText = "-") {
  if (!target) {
    return;
  }
  const safeValues = values.length ? values : [emptyText];
  target.innerHTML = safeValues.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function renderExperienceList(target, values) {
  if (!target) {
    return;
  }
  const safeValues = values.length ? values : ["No experience added"];
  target.innerHTML = safeValues
    .map((line) => {
      const parts = line.split("|").map((part) => sanitizeText(part)).filter(Boolean);
      if (parts.length >= 3) {
        const role = escapeHtml(parts[0]);
        const company = escapeHtml(parts[1]);
        const period = escapeHtml(parts[2]);
        const detail = escapeHtml(parts.slice(3).join(" | "));
        return `<li><strong>${role}</strong><span>${company} | ${period}</span>${detail ? `<em>${detail}</em>` : ""}</li>`;
      }
      return `<li>${escapeHtml(line)}</li>`;
    })
    .join("");
}

function updateLocalCvFields() {
  if (!isLocalLayout()) {
    return;
  }

  const fullName = getInputValue("localFullName") || getInputValue("fullName") || getTextValue("pvResumeName");
  const targetRole = getInputValue("localTargetRole") || getInputValue("postApplied") || getTextValue("pvResumePostApplied");
  const nationality = getInputValue("localNationality") || getInputValue("nationality") || getTextValue("pvResumeNationality");
  const expectedSalary = getInputValue("localExpectedSalary") || getInputValue("monthlySalary") || getTextValue("pvResumeSalary");
  const summary = getInputRaw("localSummary").replace(/\r/g, "");
  const phone = getInputValue("localPhone") || getInputValue("contactNo") || getTextValue("phContactPhone");
  const email = getInputValue("localEmail") || getTextValue("phContactEmail");
  const address = getInputValue("localAddress") || getTextValue("phContactAddress");
  const educationLines = parseLines(getInputRaw("localEducation"));
  const skillLines = parseLines(getInputRaw("localSkills"));
  const languageLines = parseLines(getInputRaw("localLanguages"));
  const experienceLines = parseLines(getInputRaw("localExperience"));
  const certificationLines = parseLines(getInputRaw("localCertifications"));

  setTextValue("pvResumeName", fullName);
  setTextValue("pvResumePostApplied", targetRole);
  setTextValue("pvResumeNationality", nationality);
  setTextValue("pvResumeSalary", expectedSalary);
  setTextValue("phResumeSummary", summary || "Experienced office professional with strong communication and client service skills.");
  setTextValue("phContactPhone", phone);
  setTextValue("phContactEmail", email);
  setTextValue("phContactAddress", address);
  setTextValue("phEducationSummary", educationLines.join(" | "));

  renderSimpleList(phSkillsList, skillLines.length ? skillLines : parseLines(getInputRaw("workingExperience")), "No skills added");
  renderSimpleList(phLanguageList, languageLines.length ? languageLines : [phEnglishLevel?.textContent || "English - Good"], "English - Good");
  renderExperienceList(phExperienceList, experienceLines.length ? experienceLines : parseLines(getInputRaw("workingExperience")));
  renderSimpleList(phCertificationList, certificationLines, "No certification listed");

  setTextValue("phReferenceName", getInputValue("localRef1Name") || getInputValue("emergencyPerson") || getTextValue("phReferenceName"));
  setTextValue("phReferencePhone", getInputValue("localRef1Phone") || getInputValue("emergencyAddress") || getTextValue("phReferencePhone"));
  setTextValue("phReferenceEmail", getInputValue("localRef1Email") || getTextValue("phReferenceEmail"));
  setTextValue("phReferenceName2", getInputValue("localRef2Name") || "Reference 2");
  setTextValue("phReferencePhone2", getInputValue("localRef2Phone") || "-");
  setTextValue("phReferenceEmail2", getInputValue("localRef2Email") || "-");
}

function setPreviewSource(previewEl, src) {
  previewEl.src = src;
}

function updateUploadTileState(input) {
  const tile = input?.closest(".upload-tile");
  if (!tile) {
    return;
  }
  const fileNameEl = tile.querySelector(".upload-file-name");
  const emptyText = tile.dataset.emptyText || "No file selected";
  const file = input?.files && input.files[0] ? input.files[0] : null;
  if (file) {
    tile.classList.add("has-file");
    if (fileNameEl) {
      fileNameEl.textContent = file.name;
    }
    return;
  }
  tile.classList.remove("has-file");
  if (fileNameEl) {
    fileNameEl.textContent = emptyText;
  }
}

function bindFileInput(input, previewEls, label, width, height) {
  const file = input.files && input.files[0];
  if (!file) {
    const fallback = makePlaceholder(label, width, height);
    previewEls.forEach((previewEl) => setPreviewSource(previewEl, fallback));
    return;
  }

  if (!file.type.startsWith("image/")) {
    const fallback = makePlaceholder(`${label}: ${file.name}`, width, height);
    previewEls.forEach((previewEl) => setPreviewSource(previewEl, fallback));
    return;
  }

  const blobUrl = URL.createObjectURL(file);
  previewEls.forEach((previewEl) => setPreviewSource(previewEl, blobUrl));
}

function applyPhotoTransform(previewIds, zoomInput, offsetXInput, offsetYInput) {
  if (!zoomInput || !offsetXInput || !offsetYInput) {
    return;
  }
  const scale = Number(zoomInput.value || 100) / 100;
  const x = Number(offsetXInput.value || 0);
  const y = Number(offsetYInput.value || 0);

  previewIds.forEach((id) => {
    const image = document.getElementById(id);
    if (image) {
      image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  });
}

function updatePhotoAdjustments() {
  applyPhotoTransform(["passportPhotoPreview"], passportZoomInput, passportOffsetXInput, passportOffsetYInput);
  applyPhotoTransform(["fullPhotoPreview", "phLocalPhotoPreview"], fullZoomInput, fullOffsetXInput, fullOffsetYInput);
}

function applyDocumentTransform(targetId) {
  const image = document.getElementById(targetId);
  if (!image) {
    return;
  }
  const state = docAdjustState[targetId] || { zoom: 100, x: 0, y: 0 };
  const scale = Number(state.zoom || 100) / 100;
  image.style.transform = `translate(${Number(state.x || 0)}px, ${Number(state.y || 0)}px) scale(${scale})`;
}

function applyAllDocumentTransforms() {
  Object.keys(docAdjustState).forEach((targetId) => applyDocumentTransform(targetId));
}

function syncDocAdjustControls() {
  if (!docAdjustTarget || !docZoomInput || !docOffsetXInput || !docOffsetYInput) {
    return;
  }
  const targetId = docAdjustTarget.value;
  const state = docAdjustState[targetId] || { zoom: 100, x: 0, y: 0 };
  docZoomInput.value = String(state.zoom);
  docOffsetXInput.value = String(state.x);
  docOffsetYInput.value = String(state.y);
}

function initDocAdjustControls() {
  if (!docAdjustTarget || !docZoomInput || !docOffsetXInput || !docOffsetYInput) {
    return;
  }

  const onChange = () => {
    const targetId = docAdjustTarget.value;
    docAdjustState[targetId] = {
      zoom: Number(docZoomInput.value || 100),
      x: Number(docOffsetXInput.value || 0),
      y: Number(docOffsetYInput.value || 0)
    };
    applyDocumentTransform(targetId);
  };

  docAdjustTarget.addEventListener("change", syncDocAdjustControls);
  docZoomInput.addEventListener("input", onChange);
  docOffsetXInput.addEventListener("input", onChange);
  docOffsetYInput.addEventListener("input", onChange);

  syncDocAdjustControls();
  applyAllDocumentTransforms();
}

function setAllUploadFallbacks() {
  uploadBindings.forEach((binding) => {
    const previews = binding.previewIds.map((id) => document.getElementById(id)).filter(Boolean);
    const fallback = makePlaceholder(binding.label, binding.width, binding.height);
    previews.forEach((previewEl) => setPreviewSource(previewEl, fallback));
    updateUploadTileState(binding.input);
  });
}

function initUploadBindings() {
  uploadBindings.forEach((binding) => {
    if (!binding.input) {
      return;
    }
    const previews = binding.previewIds.map((id) => document.getElementById(id)).filter(Boolean);
    binding.input.addEventListener("change", () => {
      bindFileInput(binding.input, previews, binding.label, binding.width, binding.height);
      updateUploadTileState(binding.input);
      updateSupportingPagesVisibility();
    });
    updateUploadTileState(binding.input);
  });
}

function updateSupportingPagesVisibility() {
  let hasAny = false;
  supportingPageBindings.forEach(({ input, pageId }) => {
    const page = document.getElementById(pageId);
    if (!page) {
      return;
    }
    const hasFile = Boolean(input && input.files && input.files[0]);
    page.style.display = hasFile ? "block" : "none";
    if (hasFile) {
      hasAny = true;
    }
  });
  document.body.classList.toggle("has-supporting-pages", hasAny);
}

function resetDocumentAdjustments() {
  Object.keys(DEFAULT_DOC_ADJUST_STATE).forEach((targetId) => {
    docAdjustState[targetId] = { ...DEFAULT_DOC_ADJUST_STATE[targetId] };
  });
  syncDocAdjustControls();
  applyAllDocumentTransforms();
}

function updateAll() {
  if (localModePanel) {
    localModePanel.classList.toggle("is-active", isLocalLayout());
  }
  updateMappedFields();
  updateLanguageLevel();
  updateWorkExperience();
  updateLocalCvFields();
  updatePhotoAdjustments();
}

function getInlineInput(name) {
  return form.querySelector(`[name="${name}"]`);
}

function normalizeInlineValue(text) {
  const value = sanitizeText(String(text || "").replace(/\u00a0/g, " "));
  return value === "-" ? "" : value;
}

function forcePlainTextPaste(event) {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  document.execCommand("insertText", false, text);
}

function initInlineSingleFieldEditor({ targetId, inputName, localInputName }) {
  const target = document.getElementById(targetId);
  if (!target || target.dataset.inlineInit === "1") {
    return;
  }

  target.dataset.inlineInit = "1";
  target.classList.add("inline-editable", "inline-edit-single");
  target.setAttribute("contenteditable", "true");
  target.setAttribute("spellcheck", "false");
  target.setAttribute("title", "Click to edit");

  target.addEventListener("focus", () => {
    target.classList.add("is-editing");
    if (normalizeInlineValue(target.textContent) === "") {
      target.textContent = "";
    }
  });

  target.addEventListener("blur", () => {
    target.classList.remove("is-editing");
    const value = normalizeInlineValue(target.textContent);
    const input = getInlineInput(inputName);
    if (input) {
      input.value = value;
    }
    if (localInputName && isLocalLayout()) {
      const localInput = getInlineInput(localInputName);
      if (localInput) {
        localInput.value = value;
      }
    }
    updateAll();
  });

  target.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      target.blur();
    }
  });

  target.addEventListener("paste", forcePlainTextPaste);
}

function readInlineListLines(listEl) {
  return String(listEl.innerText || "")
    .split(/\r?\n/g)
    .map((line) => sanitizeText(line.replace(/^[\u2022\-*]\s*/, "")))
    .filter(Boolean);
}

function initInlineListEditor({ targetId, inputName, localInputName }) {
  const list = document.getElementById(targetId);
  if (!list || list.dataset.inlineInit === "1") {
    return;
  }

  list.dataset.inlineInit = "1";
  list.classList.add("inline-editable", "inline-edit-list");
  list.setAttribute("contenteditable", "true");
  list.setAttribute("spellcheck", "false");
  list.setAttribute("title", "Edit items, one per line");

  list.addEventListener("focus", () => {
    list.classList.add("is-editing");
  });

  list.addEventListener("blur", () => {
    list.classList.remove("is-editing");
    const lines = readInlineListLines(list);
    const input = getInlineInput(inputName);
    if (input) {
      input.value = lines.join("\n");
    }
    if (localInputName && isLocalLayout()) {
      const localInput = getInlineInput(localInputName);
      if (localInput) {
        localInput.value = lines.join("\n");
      }
    }
    updateAll();
  });

  list.addEventListener("paste", forcePlainTextPaste);
}

function initPreviewInlineEditing() {
  inlineFieldEditors.forEach(initInlineSingleFieldEditor);
  inlineListEditors.forEach(initInlineListEditor);

  const localLinkedFields = {
    phContactEmail: "localEmail",
    phContactAddress: "localAddress",
    phReferenceEmail: "localRef1Email",
    phReferenceEmail2: "localRef2Email"
  };

  Object.keys(localLinkedFields).forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.inlineInit === "1") {
      return;
    }
    el.dataset.inlineInit = "1";
    el.classList.add("inline-editable", "inline-edit-single");
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.setAttribute("title", "Click to edit");
    el.addEventListener("focus", () => el.classList.add("is-editing"));
    el.addEventListener("blur", () => {
      el.classList.remove("is-editing");
      const value = normalizeInlineValue(el.textContent);
      if (isLocalLayout()) {
        const input = getInlineInput(localLinkedFields[id]);
        if (input) {
          input.value = value;
        }
      }
      el.textContent = value || "-";
    });
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        el.blur();
      }
    });
    el.addEventListener("paste", forcePlainTextPaste);
  });
}

function buildCvSnapshot() {
  const values = {};
  const controls = form.querySelectorAll("input[name], textarea[name], select[name]");
  controls.forEach((control) => {
    const name = control.name;
    if (!name || control.type === "file") {
      return;
    }
    if (control.type === "radio") {
      if (control.checked) {
        values[name] = control.value;
      }
      return;
    }
    if (control.type === "checkbox") {
      values[name] = control.checked ? "1" : "0";
      return;
    }
    values[name] = control.value;
  });

  return {
    values,
    meta: {
      theme: document.body.dataset.theme || "classic",
      layout: document.body.dataset.layout || "standard",
      market: document.body.dataset.market || "gcc",
      translation: translationSelect?.value || localStorage.getItem("gcc_cv_translation") || "ar",
      localAccent: document.body.dataset.localAccent || "blue"
    }
  };
}

function applyCvSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const values = snapshot.values && typeof snapshot.values === "object" ? snapshot.values : {};
  Object.entries(values).forEach(([name, rawValue]) => {
    const controls = form.querySelectorAll(`[name="${name}"]`);
    if (!controls.length) {
      return;
    }
    const value = String(rawValue ?? "");
    if (controls[0].type === "radio") {
      controls.forEach((radio) => {
        radio.checked = radio.value === value;
      });
      return;
    }
    if (controls[0].type === "checkbox") {
      controls[0].checked = value === "1";
      return;
    }
    controls[0].value = value;
  });

  const meta = snapshot.meta && typeof snapshot.meta === "object" ? snapshot.meta : {};
  if (meta.theme) {
    applyTheme(String(meta.theme));
  }
  if (meta.layout) {
    applyLayout(String(meta.layout));
  }
  if (meta.translation && translationSelect && !translationSelect.disabled) {
    applyTranslation(String(meta.translation));
  }
  if (meta.localAccent) {
    applyLocalAccentColor(String(meta.localAccent));
  }

  updateAll();
}

async function loadRecordPreview(recordId) {
  if (!recordId) {
    return;
  }
  const { record } = await api(`/cv-records/${encodeURIComponent(recordId)}`);
  applyCvSnapshot(record?.snapshot || {});
}

function simpleHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function buildCvKey() {
  const parts = [];
  const data = new FormData(form);
  for (const [key, value] of data.entries()) {
    if (value instanceof File) {
      parts.push(`${key}:${value.name}:${value.size}:${value.lastModified}`);
    } else {
      parts.push(`${key}:${String(value).trim()}`);
    }
  }
  parts.sort();
  parts.push(`agency:${currentAgency?.id || ""}`);
  parts.push(`theme:${document.body.dataset.theme || "classic"}`);
  parts.push(`layout:${document.body.dataset.layout || "standard"}`);
  return `cv-${simpleHash(parts.join("|"))}`;
}

async function recordCvIfNeeded(source = "manual") {
  if (isRecordPreviewMode) {
    return { skipped: true };
  }
  if (!currentAgency) {
    return { skipped: true };
  }

  const idempotencyKey = buildCvKey();
  if (idempotencyKey === lastRecordedCvKey) {
    return { skipped: true };
  }

  const candidateName = sanitizeText(
    form.querySelector('[name="localFullName"]')?.value
    || form.querySelector('[name="fullName"]')?.value
    || ""
  );
  const referenceNo = sanitizeText(
    form.querySelector('[name="referenceNo"]')?.value
    || form.querySelector('[name="localTargetRole"]')?.value
    || ""
  );

  const { agency, alreadyCounted } = await api("/cv-records", {
    method: "POST",
    body: JSON.stringify({ idempotencyKey, source, candidateName, referenceNo, snapshot: buildCvSnapshot() })
  });

  currentAgency = agency;
  updateUsageChip(currentAgency);
  enforceTemplateAccess(currentAgency);
  void loadCvHistory();
  lastRecordedCvKey = idempotencyKey;

  return { skipped: false, alreadyCounted };
}

function isCurrentCvSaved() {
  if (isRecordPreviewMode) {
    return true;
  }
  if (!currentAgency) {
    return false;
  }
  return buildCvKey() === lastRecordedCvKey;
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  if (themeSelect) {
    themeSelect.value = theme;
  }
  localStorage.setItem("gcc_cv_theme", theme);
}

function applyLocalAccentColor(color) {
  const allowed = new Set(["blue", "emerald", "maroon", "teal", "violet"]);
  const safe = allowed.has(color) ? color : "blue";
  document.body.dataset.localAccent = safe;
  if (localAccentSelect) {
    localAccentSelect.value = safe;
  }
  localStorage.setItem("gcc_local_accent", safe);
}

function applyLayout(layout) {
  const config = getLayoutConfig(layout || TEMPLATE_ENGINE.defaultLayoutId);
  document.body.dataset.layout = config.dataLayout;
  document.body.dataset.templateId = config.id;
  document.body.dataset.market = config.market;
  if (layoutSelect) {
    layoutSelect.value = config.id;
  }
  localStorage.setItem("gcc_cv_layout", config.id);
  applyLayoutTranslationMode(config);
  updateAll();
}

function enforceTemplateAccess(agency) {
  if (!themeSelect || !agency) {
    return;
  }
  const planKey = String(agency.plan || "free").toLowerCase();
  const fallbackTemplates = PLAN_THEME_FALLBACK[planKey] || PLAN_THEME_FALLBACK.free;
  const serverTemplates = Array.isArray(agency.templates) ? agency.templates : [];
  const allowed = new Set([...serverTemplates, ...fallbackTemplates]);
  Array.from(themeSelect.options).forEach((option) => {
    option.disabled = !allowed.has(option.value);
  });
  if (!allowed.has(themeSelect.value)) {
    const firstAllowed = Array.from(themeSelect.options).find((option) => !option.disabled);
    if (firstAllowed) {
      applyTheme(firstAllowed.value);
    }
  }
}

function setMobileNavOpen(isOpen) {
  if (!mobileNavPanel || !mobileNavToggle) {
    return;
  }
  mobileNavPanel.classList.toggle("is-open", isOpen);
  mobileNavPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
  mobileNavToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function initMobileNav() {
  if (!mobileNavPanel || !mobileNavToggle || !mobileNavBackdrop || !mobileNavClose) {
    return;
  }
  mobileNavToggle.addEventListener("click", () => {
    const isOpen = mobileNavPanel.classList.contains("is-open");
    setMobileNavOpen(!isOpen);
  });
  mobileNavBackdrop.addEventListener("click", () => setMobileNavOpen(false));
  mobileNavClose.addEventListener("click", () => setMobileNavOpen(false));
  mobileNavPanel.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => setMobileNavOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMobileNavOpen(false);
    }
  });
}

form.addEventListener("input", updateAll);
form.addEventListener("change", updateAll);
form.addEventListener("input", queueDraftSave);
form.addEventListener("change", queueDraftSave);

resetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    form.reset();
    lastRecordedCvKey = "";
    setAllUploadFallbacks();
    if (currentAgency) {
      applyAgencyLogosFromProfile(currentAgency);
    }
    resetDocumentAdjustments();
    updateSupportingPagesVisibility();
    updateAll();
    clearDraftFromLocal();
  });
});

printButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await recordCvIfNeeded("print");
      saveDraftToLocal();
    } catch (error) {
      alert(error.message || "Failed to auto-record CV.");
      return;
    }
    window.print();
  });
});

saveRecordButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      const result = await recordCvIfNeeded("manual");
      if (result?.skipped) {
        alert("This CV is already saved in history.");
        return;
      }
      alert("CV saved to history. You can now print/save PDF.");
    } catch (error) {
      alert(error.message || "Failed to save CV record.");
    }
  });
});

profileButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "/profile";
  });
});

historyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "/history";
  });
});

logoutButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout API errors and continue redirect.
    }
    window.location.href = "/landing";
  });
});

initMobileNav();

if (themeSelect) {
  const savedTheme = localStorage.getItem("gcc_cv_theme") || "classic";
  applyTheme(savedTheme);
  themeSelect.addEventListener("change", (event) => {
    applyTheme(event.target.value);
  });
}

if (layoutSelect) {
  renderLayoutOptions();
  const savedLayout = localStorage.getItem("gcc_cv_layout") || TEMPLATE_ENGINE.defaultLayoutId;
  applyLayout(savedLayout);
  layoutSelect.addEventListener("change", (event) => {
    applyLayout(event.target.value);
  });
}

if (localAccentSelect) {
  const savedAccent = localStorage.getItem("gcc_local_accent") || localAccentSelect.value || "blue";
  applyLocalAccentColor(savedAccent);
  localAccentSelect.addEventListener("change", (event) => {
    applyLocalAccentColor(event.target.value);
    updateAll();
  });
}

if (translationSelect) {
  translationSelect.addEventListener("change", (event) => {
    const activeLayout = getLayoutConfig(layoutSelect?.value || TEMPLATE_ENGINE.defaultLayoutId);
    if (activeLayout.lockTranslation) {
      return;
    }
    applyTranslation(event.target.value);
  });
}

if (autoFillBtn) {
  autoFillBtn.addEventListener("click", applyAutoFill);
}

initScanImport();

async function init() {
  try {
    const { agency } = await api("/auth/me");
    currentAgency = agency;
    
    updateUsageChip(currentAgency);
    applyAgencyDefaults(currentAgency);
    enforceTemplateAccess(currentAgency);

    initUploadBindings();
    initDocAdjustControls();
    setAllUploadFallbacks();
    applyAgencyLogosFromProfile(currentAgency);
    updateSupportingPagesVisibility();
    restoreDraftFromLocal();
    initPreviewInlineEditing();
    if (isRecordPreviewMode) {
      try {
        await loadRecordPreview(previewRecordId);
      } catch {
        updateAll();
        applyTranslation(translationSelect?.value || localStorage.getItem("gcc_cv_translation") || "ar");
      }
    } else {
      updateAll();
      applyTranslation(translationSelect?.value || localStorage.getItem("gcc_cv_translation") || "ar");
    }
    await loadCvHistory();
  } catch {
    window.location.href = "/landing";
  }
}

init();

