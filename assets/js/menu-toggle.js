(function () {
  if (typeof window === "undefined") {
    return;
  }

  function initMobileMenu() {
    const toggle = document.querySelector(".mobile-menu-toggle");
    const navigation = document.querySelector("#site-navigation");

    if (!toggle || !navigation || toggle.dataset.menuInitialized === "true") {
      return;
    }

    const closeMenu = () => {
      toggle.setAttribute("aria-expanded", "false");
      navigation.classList.remove("is-open");
    };

    const openMenu = () => {
      toggle.setAttribute("aria-expanded", "true");
      navigation.classList.add("is-open");
    };

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      if (isExpanded) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navigation.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 720) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        closeMenu();
        toggle.focus();
      }
    });

    toggle.dataset.menuInitialized = "true";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileMenu);
  } else {
    initMobileMenu();
  }
})();
