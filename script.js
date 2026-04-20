const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const rtlToggle = document.getElementById("rtlToggle");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const STORAGE_KEY = "loreal-selected-products";
const RTL_STORAGE_KEY = "loreal-rtl-mode";
const WORKER_URL = "https://loreal-routine-worker.weatherfordj.workers.dev/";

let allProducts = [];
let selectedProducts = [];
let conversationHistory = [];
let routineGenerated = false;

productsContainer.innerHTML = `
  <div class="placeholder-message">
    Loading products...
  </div>
`;

async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    const data = await response.json();
    return data.products;
  } catch (error) {
    console.error(error);
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Failed to load products.
      </div>
    `;
    return [];
  }
}

function saveSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
}

function loadSelections() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    selectedProducts = JSON.parse(saved);
  }
}

function isSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

function toggleProductSelection(product) {
  if (!product) return;

  if (isSelected(product.id)) {
    selectedProducts = selectedProducts.filter(
      (item) => item.id !== product.id,
    );
  } else {
    selectedProducts.push(product);
  }

  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function removeSelectedProduct(productId) {
  selectedProducts = selectedProducts.filter(
    (product) => product.id !== productId,
  );
  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function clearSelections() {
  selectedProducts = [];
  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function getFilteredProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  return allProducts.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const matchesSearch =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm) ||
      product.brand.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = filteredProducts
    .map(
      (product) => `
        <div class="product-card ${
          isSelected(product.id) ? "selected" : ""
        }" data-id="${product.id}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p class="brand">${product.brand}</p>
            <p class="category-label">${product.category}</p>
            <p class="product-description">${product.description}</p>
          </div>
        </div>
      `,
    )
    .join("");

  const cards = document.querySelectorAll(".product-card");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const productId = Number(card.dataset.id);
      const product = allProducts.find((item) => item.id === productId);
      toggleProductSelection(product);
    });
  });
}

function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-selection">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-chip">
          <span>${product.name}</span>
          <button
            class="remove-chip"
            data-id="${product.id}"
            aria-label="Remove ${product.name}"
            type="button"
          >
            &times;
          </button>
        </div>
      `,
    )
    .join("");

  const removeButtons = document.querySelectorAll(".remove-chip");

  removeButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const productId = Number(button.dataset.id);
      removeSelectedProduct(productId);
    });
  });
}

function addMessage(role, content, citations = []) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const paragraph = document.createElement("p");
  paragraph.textContent = content;
  messageDiv.appendChild(paragraph);

  if (citations.length > 0) {
    const citationsBlock = document.createElement("div");
    citationsBlock.className = "citations";

    citations.forEach((citation) => {
      if (!citation?.url) return;

      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.title || citation.url;
      citationsBlock.appendChild(link);
    });

    if (citationsBlock.children.length > 0) {
      messageDiv.appendChild(citationsBlock);
    }
  }

  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function callAI(messages, useWebSearch = false) {
  let response;

  try {
    response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        useWebSearch,
      }),
    });
  } catch (error) {
    throw new Error(
      "Could not reach the AI service. This is usually a browser CORS/preflight issue.",
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.reply) {
    throw new Error("AI response did not include reply text.");
  }

  return {
    reply: data.reply,
    citations: data.citations || [],
  };
}

function setRTLMode(enabled) {
  document.documentElement.dir = enabled ? "rtl" : "ltr";
  document.documentElement.lang = enabled ? "ar" : "en";
  localStorage.setItem(RTL_STORAGE_KEY, JSON.stringify(enabled));

  if (rtlToggle) {
    rtlToggle.textContent = enabled ? "LTR Mode" : "RTL Mode";
  }
}

function loadRTLMode() {
  const saved = localStorage.getItem(RTL_STORAGE_KEY);

  if (saved !== null) {
    setRTLMode(JSON.parse(saved));
  } else {
    setRTLMode(false);
  }
}

generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addMessage("assistant", "Please select at least one product first.");
    return;
  }

  addMessage("assistant", "Building your personalized routine...");

  const systemPrompt = `
You are a helpful L'Oréal beauty advisor.
Use only the selected products provided by the user when creating the routine.
Be clear, friendly, and organized.
Keep the advice limited to beauty, skincare, haircare, makeup, fragrance, and grooming.
If the user asks something unrelated, politely redirect them back to the routine or product topics.
Format the routine with simple steps such as Morning, Evening, or Usage Order.
If current information is needed about beauty trends, product usage, or routine advice, use web search and include citations when available.
  `.trim();

  const productSummary = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  conversationHistory = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Create a personalized beauty routine using only these selected products: ${JSON.stringify(
        productSummary,
      )}`,
    },
  ];

  try {
    const result = await callAI(conversationHistory, false);

    chatWindow.innerHTML = "";
    addMessage("assistant", result.reply, result.citations);

    conversationHistory.push({ role: "assistant", content: result.reply });
    routineGenerated = true;
  } catch (error) {
    console.error(error);
    chatWindow.innerHTML = "";
    addMessage(
      "assistant",
      `Sorry, I could not generate the routine right now. ${error.message}`,
    );
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  addMessage("user", message);
  userInput.value = "";

  if (!routineGenerated) {
    addMessage(
      "assistant",
      "Please generate a routine first, then ask follow-up questions.",
    );
    return;
  }

  conversationHistory.push({ role: "user", content: message });

  const shouldUseWeb =
    /latest|current|today|new|trend|trending|launch|recent|2025|2026|best now/i.test(
      message,
    );

  try {
    const result = await callAI(conversationHistory, shouldUseWeb);
    addMessage("assistant", result.reply, result.citations);
    conversationHistory.push({ role: "assistant", content: result.reply });
  } catch (error) {
    console.error(error);
    addMessage(
      "assistant",
      `Sorry, I could not respond right now. ${error.message}`,
    );
  }
});

categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);
clearSelectionsBtn.addEventListener("click", clearSelections);

if (rtlToggle) {
  rtlToggle.addEventListener("click", () => {
    const isRTL = document.documentElement.dir === "rtl";
    setRTLMode(!isRTL);
  });
}

async function init() {
  allProducts = await loadProducts();
  loadSelections();
  loadRTLMode();
  renderProducts();
  renderSelectedProducts();

  addMessage(
    "assistant",
    "Hi! Choose products, generate a routine, and then ask me follow-up beauty questions.",
  );
}

init();
