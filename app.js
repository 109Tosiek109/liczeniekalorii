const todayKey = () => new Date().toISOString().slice(0, 10);

const defaults = {
  goals: { kcal: 2400, protein: 130, fat: 70, carbs: 250 },
  meals: {},
  products: [],
};

const state = loadState();

const fields = {
  photoInput: document.querySelector("#photoInput"),
  photoPreview: document.querySelector("#photoPreview"),
  photoPlaceholder: document.querySelector("#photoPlaceholder"),
  ocrBox: document.querySelector("#ocrBox"),
  ocrText: document.querySelector("#ocrText"),
  productName: document.querySelector("#productName"),
  barcode: document.querySelector("#barcode"),
  baseAmount: document.querySelector("#baseAmount"),
  servingAmount: document.querySelector("#servingAmount"),
  kcal: document.querySelector("#kcal"),
  protein: document.querySelector("#protein"),
  fat: document.querySelector("#fat"),
  carbs: document.querySelector("#carbs"),
  favoriteToggle: document.querySelector("#favoriteToggle"),
  mealKcal: document.querySelector("#mealKcal"),
  mealProtein: document.querySelector("#mealProtein"),
  mealFat: document.querySelector("#mealFat"),
  mealCarbs: document.querySelector("#mealCarbs"),
  dailyKcal: document.querySelector("#dailyKcal"),
  dailyProtein: document.querySelector("#dailyProtein"),
  dailyFat: document.querySelector("#dailyFat"),
  dailyCarbs: document.querySelector("#dailyCarbs"),
  kcalRing: document.querySelector("#kcalRing"),
  mealList: document.querySelector("#mealList"),
  productList: document.querySelector("#productList"),
  productSearch: document.querySelector("#productSearch"),
  goalKcal: document.querySelector("#goalKcal"),
  goalProtein: document.querySelector("#goalProtein"),
  goalFat: document.querySelector("#goalFat"),
  goalCarbs: document.querySelector("#goalCarbs"),
  installDialog: document.querySelector("#installDialog"),
};

const exampleText = "Wartość odżywcza w 100 g: energia 247 kcal, tłuszcz 11 g, w tym kwasy nasycone 4.2 g, węglowodany 25 g, w tym cukry 8 g, białko 9.5 g, sól 0.8 g";

document.querySelector("#installHelpButton").addEventListener("click", () => fields.installDialog.showModal());
document.querySelector("#closeInstallDialog").addEventListener("click", () => fields.installDialog.close());
document.querySelector("#pasteModeButton").addEventListener("click", () => {
  fields.ocrBox.hidden = !fields.ocrBox.hidden;
  if (!fields.ocrBox.hidden) fields.ocrText.focus();
});
document.querySelector("#mockOcrButton").addEventListener("click", () => {
  fields.ocrBox.hidden = false;
  fields.ocrText.value = exampleText;
  applyParsedNutrition(parseNutrition(exampleText));
});
document.querySelector("#parseOcrButton").addEventListener("click", () => {
  applyParsedNutrition(parseNutrition(fields.ocrText.value));
});
document.querySelector("#saveMealButton").addEventListener("click", saveMeal);
document.querySelector("#saveProductButton").addEventListener("click", saveProduct);
document.querySelector("#clearDayButton").addEventListener("click", clearDay);
document.querySelector("#saveGoalsButton").addEventListener("click", saveGoals);
fields.productSearch.addEventListener("input", renderProducts);

[
  fields.baseAmount,
  fields.servingAmount,
  fields.kcal,
  fields.protein,
  fields.fat,
  fields.carbs,
].forEach((input) => input.addEventListener("input", renderMealPreview));

fields.photoInput.addEventListener("change", () => {
  const file = fields.photoInput.files?.[0];
  if (!file) return;
  fields.photoPreview.src = URL.createObjectURL(file);
  fields.photoPreview.hidden = false;
  fields.photoPlaceholder.textContent = "Zdjęcie dodane";
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

hydrateGoals();
renderMealPreview();
renderDay();
renderProducts();

function loadState() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("makrofoto-state")) };
  } catch {
    return structuredClone(defaults);
  }
}

function persist() {
  localStorage.setItem("makrofoto-state", JSON.stringify(state));
}

function numberValue(input) {
  return Number.parseFloat(String(input.value).replace(",", ".")) || 0;
}

function currentMealTotals() {
  const base = numberValue(fields.baseAmount);
  const serving = numberValue(fields.servingAmount);
  const factor = base > 0 ? serving / base : 0;

  return {
    kcal: Math.round(numberValue(fields.kcal) * factor),
    protein: round1(numberValue(fields.protein) * factor),
    fat: round1(numberValue(fields.fat) * factor),
    carbs: round1(numberValue(fields.carbs) * factor),
  };
}

function renderMealPreview() {
  const totals = currentMealTotals();
  fields.mealKcal.textContent = `${totals.kcal} kcal`;
  fields.mealProtein.textContent = `${totals.protein} g`;
  fields.mealFat.textContent = `${totals.fat} g`;
  fields.mealCarbs.textContent = `${totals.carbs} g`;
}

function parseNutrition(text) {
  const clean = text.toLowerCase().replace(/\s+/g, " ").replaceAll(",", ".");
  return {
    kcal: pickNumber(clean, /(energia|wartosc energetyczna|wartość energetyczna)[^0-9]{0,40}([0-9]+(?:\.[0-9]+)?)\s*kcal/),
    fat: pickNumber(clean, /(tłuszcz|tluszcz)[^0-9]{0,25}([0-9]+(?:\.[0-9]+)?)/),
    carbs: pickNumber(clean, /(węglowodany|weglowodany)[^0-9]{0,25}([0-9]+(?:\.[0-9]+)?)/),
    protein: pickNumber(clean, /(białko|bialko)[^0-9]{0,25}([0-9]+(?:\.[0-9]+)?)/),
  };
}

function pickNumber(text, regex) {
  const match = text.match(regex);
  return match ? Number.parseFloat(match[2]) : "";
}

function applyParsedNutrition(parsed) {
  if (parsed.kcal !== "") fields.kcal.value = parsed.kcal;
  if (parsed.protein !== "") fields.protein.value = parsed.protein;
  if (parsed.fat !== "") fields.fat.value = parsed.fat;
  if (parsed.carbs !== "") fields.carbs.value = parsed.carbs;
  if (!fields.productName.value) fields.productName.value = "Produkt ze zdjęcia";
  fields.baseAmount.value = "100";
  renderMealPreview();
}

function saveMeal() {
  const totals = currentMealTotals();
  if (!fields.productName.value.trim() || totals.kcal <= 0) return;

  const meal = {
    id: crypto.randomUUID(),
    date: todayKey(),
    name: fields.productName.value.trim(),
    serving: numberValue(fields.servingAmount),
    barcode: fields.barcode.value.trim(),
    ...totals,
  };

  state.meals[todayKey()] = [meal, ...(state.meals[todayKey()] || [])];
  if (fields.favoriteToggle.checked) saveProduct(false);
  persist();
  renderDay();
  renderProducts();
}

function saveProduct(shouldRender = true) {
  const name = fields.productName.value.trim();
  if (!name) return;

  const product = {
    id: crypto.randomUUID(),
    name,
    barcode: fields.barcode.value.trim(),
    baseAmount: numberValue(fields.baseAmount),
    kcal: numberValue(fields.kcal),
    protein: numberValue(fields.protein),
    fat: numberValue(fields.fat),
    carbs: numberValue(fields.carbs),
    updatedAt: Date.now(),
  };

  state.products = [
    product,
    ...state.products.filter((item) => item.name.toLowerCase() !== name.toLowerCase()),
  ].slice(0, 80);

  persist();
  if (shouldRender) renderProducts();
}

function renderDay() {
  const meals = state.meals[todayKey()] || [];
  const total = meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + meal.kcal,
      protein: sum.protein + meal.protein,
      fat: sum.fat + meal.fat,
      carbs: sum.carbs + meal.carbs,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );

  fields.dailyKcal.textContent = Math.round(total.kcal);
  fields.dailyProtein.textContent = `${round1(total.protein)} / ${state.goals.protein} g`;
  fields.dailyFat.textContent = `${round1(total.fat)} / ${state.goals.fat} g`;
  fields.dailyCarbs.textContent = `${round1(total.carbs)} / ${state.goals.carbs} g`;
  fields.kcalRing.style.setProperty("--progress", Math.min(100, Math.round((total.kcal / state.goals.kcal) * 100)));

  fields.mealList.innerHTML = meals.length
    ? meals.map((meal) => `
      <li class="meal-item">
        <div>
          <strong>${escapeHtml(meal.name)}</strong>
          <span>${meal.serving} g · ${meal.protein} B · ${meal.fat} T · ${meal.carbs} W</span>
        </div>
        <div class="item-actions">
          <strong>${meal.kcal}</strong>
          <button type="button" data-remove-meal="${meal.id}" aria-label="Usuń wpis">×</button>
        </div>
      </li>`).join("")
    : `<li class="meal-item"><div><strong>Brak wpisów</strong><span>Dodaj pierwszy produkt ze zdjęcia albo historii.</span></div></li>`;

  fields.mealList.querySelectorAll("[data-remove-meal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.meals[todayKey()] = (state.meals[todayKey()] || []).filter((meal) => meal.id !== button.dataset.removeMeal);
      persist();
      renderDay();
    });
  });
}

function renderProducts() {
  const query = fields.productSearch.value.trim().toLowerCase();
  const products = state.products.filter((item) => item.name.toLowerCase().includes(query) || item.barcode.includes(query));

  fields.productList.innerHTML = products.length
    ? products.map((product) => `
      <article class="product-item">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${product.kcal} kcal / ${product.baseAmount || 100} g · ${product.protein} B · ${product.fat} T · ${product.carbs} W</span>
        </div>
        <div class="item-actions">
          <button type="button" data-load-product="${product.id}" aria-label="Użyj produktu">↗</button>
          <button type="button" data-delete-product="${product.id}" aria-label="Usuń produkt">×</button>
        </div>
      </article>`).join("")
    : `<article class="product-item"><div><strong>Jeszcze pusto</strong><span>Zapisane produkty będą dostępne offline.</span></div></article>`;

  fields.productList.querySelectorAll("[data-load-product]").forEach((button) => {
    button.addEventListener("click", () => loadProduct(button.dataset.loadProduct));
  });
  fields.productList.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", () => {
      state.products = state.products.filter((item) => item.id !== button.dataset.deleteProduct);
      persist();
      renderProducts();
    });
  });
}

function loadProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  fields.productName.value = product.name;
  fields.barcode.value = product.barcode;
  fields.baseAmount.value = product.baseAmount || 100;
  fields.kcal.value = product.kcal;
  fields.protein.value = product.protein;
  fields.fat.value = product.fat;
  fields.carbs.value = product.carbs;
  fields.favoriteToggle.checked = true;
  renderMealPreview();
  window.scrollTo({ top: document.querySelector(".editor-panel").offsetTop - 12, behavior: "smooth" });
}

function hydrateGoals() {
  fields.goalKcal.value = state.goals.kcal;
  fields.goalProtein.value = state.goals.protein;
  fields.goalFat.value = state.goals.fat;
  fields.goalCarbs.value = state.goals.carbs;
}

function saveGoals() {
  state.goals = {
    kcal: numberValue(fields.goalKcal),
    protein: numberValue(fields.goalProtein),
    fat: numberValue(fields.goalFat),
    carbs: numberValue(fields.goalCarbs),
  };
  persist();
  renderDay();
}

function clearDay() {
  state.meals[todayKey()] = [];
  persist();
  renderDay();
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
