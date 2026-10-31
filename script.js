(function () {
  const root = document.documentElement;
  let storage;

  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }

  function preference(key) {
    try { return storage?.getItem(key); } catch { return null; }
  }

  function savePreference(key, value) {
    try { storage?.setItem(key, value); } catch { /* Theme selection still works without storage. */ }
  }

  const colors = { default: "原有配色", red: "交大红", blue: "蓝色" };
  function preferredTheme() {
    const saved = preference("site-theme");
    return ["light", "dark"].includes(saved) ? saved : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  function setColor(value) {
    const color = Object.hasOwn(colors, value) ? value : "default";
    root.dataset.color = color;
    document.querySelectorAll('input[name="site-color"]').forEach((input) => {
      input.checked = input.value === color;
    });
    const summary = document.querySelector("[data-color-picker] > summary");
    if (summary) {
      summary.setAttribute("aria-label", `选择颜色主题，当前：${colors[color]}`);
      summary.title = `颜色主题：${colors[color]}`;
    }
    setTheme(preferredTheme());
  }

  function setTheme(theme) {
    const fixedDaytime = ["red", "blue"].includes(root.dataset.color);
    if (fixedDaytime) theme = "light";
    root.dataset.theme = theme;
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const themeLabel = document.querySelector("[data-theme-label]");
    if (themeLabel) {
      themeLabel.textContent = theme === "dark" ? "日间模式" : "深夜模式";
    }
    if (themeToggle) {
      themeToggle.hidden = fixedDaytime;
      themeToggle.disabled = fixedDaytime;
      themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
      const label = theme === "dark" ? "切换日间模式" : "切换深色模式";
      themeToggle.setAttribute("aria-label", label);
      themeToggle.title = label;
    }
  }

  function mountNav() {
    const slot = document.querySelector("[data-site-nav-slot]");
    if (!slot || typeof window.SITE_NAV_HTML !== "string") {
      return;
    }
    slot.innerHTML = window.SITE_NAV_HTML;
  }

  mountNav();

  setColor(preference("site-color"));

  const colorPicker = document.querySelector("[data-color-picker]");
  document.querySelectorAll('input[name="site-color"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      setColor(input.value);
      savePreference("site-color", input.value);
    });
  });
  document.addEventListener("click", (event) => {
    if (colorPicker && !colorPicker.contains(event.target)) colorPicker.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && colorPicker?.open) {
      colorPicker.open = false;
      colorPicker.querySelector("summary").focus();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "site-color") setColor(event.newValue);
    if (event.key === "site-theme" && ["light", "dark"].includes(event.newValue)) setTheme(event.newValue);
  });

  const themeToggle = document.querySelector("[data-theme-toggle]");
  themeToggle?.addEventListener("click", () => {
    if (["red", "blue"].includes(root.dataset.color)) return;
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    savePreference("site-theme", nextTheme);
    setTheme(nextTheme);
  });

  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");
  const submenuButton = document.querySelector(".has-submenu > button");
  const submenuParent = document.querySelector(".has-submenu");

  colorPicker?.addEventListener("toggle", () => {
    if (colorPicker.open && navMenu && navToggle) {
      navMenu.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  const currentPage = document.body.dataset.page || "";
  document.querySelectorAll("[data-page-target]").forEach((item) => {
    const target = item.dataset.pageTarget;
    const active = target === currentPage;
    item.classList.toggle("is-current", active);
    if (item.tagName === "A") {
      if (active) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    }
  });

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navMenu.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        navMenu.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (submenuButton && submenuParent) {
    submenuButton.addEventListener("click", () => {
      const isOpen = submenuParent.classList.toggle("is-open");
      submenuButton.setAttribute("aria-expanded", String(isOpen));
    });
  }

  document.querySelectorAll("[data-about-carousel]").forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll("[data-about-slide]"));
    const prev = carousel.querySelector("[data-about-prev]");
    const next = carousel.querySelector("[data-about-next]");
    let activeIndex = 0;
    let timerId = null;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function showSlide(index) {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("is-active", slideIndex === activeIndex);
      });
    }

    function startAutoPlay() {
      if (prefersReducedMotion || timerId) {
        return;
      }
      timerId = window.setInterval(() => showSlide(activeIndex + 1), 5000);
    }

    function stopAutoPlay() {
      if (!timerId) {
        return;
      }
      window.clearInterval(timerId);
      timerId = null;
    }

    prev?.addEventListener("click", () => {
      stopAutoPlay();
      showSlide(activeIndex - 1);
      startAutoPlay();
    });

    next?.addEventListener("click", () => {
      stopAutoPlay();
      showSlide(activeIndex + 1);
      startAutoPlay();
    });

    carousel.addEventListener("mouseenter", stopAutoPlay);
    carousel.addEventListener("mouseleave", startAutoPlay);
    carousel.addEventListener("focusin", stopAutoPlay);
    carousel.addEventListener("focusout", startAutoPlay);
    showSlide(0);
    startAutoPlay();
  });

  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) {
    return;
  }

  const slides = Array.from(carousel.querySelectorAll("[data-slide]"));
  const dots = Array.from(carousel.querySelectorAll("[data-dot]"));
  const prev = carousel.querySelector("[data-prev]");
  const next = carousel.querySelector("[data-next]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = 0;
  let timerId = null;

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeIndex);
    });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === activeIndex);
    });
  }

  function startAutoPlay() {
    if (prefersReducedMotion || timerId) {
      return;
    }
    timerId = window.setInterval(() => showSlide(activeIndex + 1), 5000);
  }

  function stopAutoPlay() {
    if (!timerId) {
      return;
    }
    window.clearInterval(timerId);
    timerId = null;
  }

  prev?.addEventListener("click", () => {
    stopAutoPlay();
    showSlide(activeIndex - 1);
    startAutoPlay();
  });

  next?.addEventListener("click", () => {
    stopAutoPlay();
    showSlide(activeIndex + 1);
    startAutoPlay();
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      stopAutoPlay();
      showSlide(Number(dot.dataset.dot));
      startAutoPlay();
    });
  });

  carousel.addEventListener("mouseenter", stopAutoPlay);
  carousel.addEventListener("mouseleave", startAutoPlay);
  carousel.addEventListener("focusin", stopAutoPlay);
  carousel.addEventListener("focusout", startAutoPlay);

  showSlide(0);
  startAutoPlay();
})();
